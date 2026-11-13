import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {appendFile,mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {assertValidPresentationIR} from '../core/validate-presentation.mjs';
import {pptxgenjsIRAdapter} from '../adapters/pptxgenjs-ir.mjs';
import {planPresentationIntelligence} from './intelligence.mjs';
import {critiqueRenderedPages} from './rendered-critic.mjs';

const execFileAsync=promisify(execFile);
const projectRoot=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const hashFile=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const checkAbort=signal=>{if(signal?.aborted)throw Object.assign(new Error('Job cancellation requested.'),{name:'AbortError'});};

async function previewDeck(pptxPath,{signal,timeoutMs=180_000}={}){
  checkAbort(signal);
  const script=path.join(projectRoot,'scripts','preview.mjs');
  await execFileAsync(process.execPath,[script,pptxPath],{cwd:projectRoot,windowsHide:true,timeout:timeoutMs,signal,maxBuffer:2*1024*1024});
  checkAbort(signal);
  const directory=path.dirname(pptxPath),stem=path.basename(pptxPath,'.pptx'),entries=await fs.promises.readdir(directory);
  return entries.filter(name=>name===`${stem}.pdf`||new RegExp(`^${stem}-page-\\d+\\.png$`).test(name)).map(name=>{const file=path.join(directory,name);return{path:file,format:path.extname(file).slice(1),sha256:hashFile(file),editable:'not-applicable'};});
}

export async function runPresentationWorkflow({jobId,project,presentationIR=project?.presentationIR,workspace,outputDir,preview=true,signal,onEvent=()=>{},adapter=pptxgenjsIRAdapter}){
  if(!jobId||!workspace||!outputDir)throw new TypeError('jobId, workspace and outputDir are required');
  const base=path.resolve(workspace),runDir=path.resolve(outputDir),relative=path.relative(base,runDir);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error('Workflow output must stay inside the workspace.');
  await mkdir(runDir,{recursive:true});
  const logPath=path.join(runDir,'workflow.events.jsonl'),events=[],artifacts=[];
  const stage=async(name,status,detail={})=>{const event={job_id:jobId,stage:name,status,at:new Date().toISOString(),detail};events.push(event);await appendFile(logPath,`${JSON.stringify(event)}\n`);await onEvent(name,status,detail);};
  const execute=async(name,fn)=>{checkAbort(signal);await stage(name,'running');try{const value=await fn();await stage(name,'completed',value?.summary||{});return value;}catch(error){await stage(name,error.name==='AbortError'?'cancelled':'failed',{message:error.message});throw error;}};
  try{
    const validation=await execute('import-and-validate',async()=>{assertValidPresentationIR(presentationIR);return{summary:{slides:presentationIR.slides.length,sources:presentationIR.source_ir.sources.length}};});
    const probe=await execute('research-and-evidence-inventory',async()=>{const unknownSources=presentationIR.source_ir.sources.filter(source=>source.verification_status!=='verified').map(source=>source.source_id),unknownEvidence=(presentationIR.source_ir.evidence||[]).filter(item=>item.verification_status!=='verified').map(item=>item.evidence_id),pendingClaims=(presentationIR.source_ir.claims||[]).filter(claim=>claim.review_status!=='verified').map(claim=>claim.claim_id);return{summary:{network:'disabled',sources:presentationIR.source_ir.sources.length,unverified_sources:unknownSources.length,unverified_evidence:unknownEvidence.length},report:{network:'disabled',performed:false,reason:'Phase 1 workflow inventories supplied evidence only; it does not search the web or verify claims.',unverified_source_ids:unknownSources,unverified_evidence_ids:unknownEvidence,unreviewed_claim_ids:pendingClaims}};});
    const content=await execute('content-plan',async()=>{const report=planPresentationIntelligence(presentationIR);return{summary:{slides:report.slides.length,audience_profile:report.audience_profile,total_allocated_seconds:report.total_allocated_seconds},report};});
    const visual=await execute('visual-plan-and-route',async()=>{const probeResult=await adapter.probe();if(probeResult.status!=='available')throw new Error(`Adapter '${adapter.manifest.id}' is blocked: ${probeResult.reason||'probe failed'}`);const required={nativeCharts:presentationIR.slides.some(slide=>slide.elements.some(element=>element.kind==='chart'))};const negotiation=await adapter.negotiate({formats:['pptx'],requirements:required});if(!negotiation.ok)throw new Error(`Adapter '${adapter.manifest.id}' does not satisfy this deck: ${negotiation.reasons.join('; ')}`);return{summary:{adapter:adapter.manifest.id,formats:negotiation.formats},report:{adapter:adapter.manifest.id,capabilities:negotiation.capabilities,negotiation,slides:presentationIR.slides.map(slide=>({slide_id:slide.slide_id,requested_type:slide.type,elements:slide.elements.map(element=>({kind:element.kind,source_ids:element.source_ids||[],media_role:element.kind==='chart'?'native_chart':element.kind==='table'?'native_table':element.kind==='cards'?'native_shapes':'editable_text'})),time_budget_seconds:slide.time_budget_seconds??null}))}};});
    const rendered=await execute('generate-render-and-structural-qa',async()=>{checkAbort(signal);const result=await adapter.render({presentationIR,workspace:base,outputDir:runDir,inputHash:project?.ir_sha256||null,inputPath:`project:${project?.project_id||'local'}`});artifacts.push(...result.artifacts);return{summary:{slides:result.slideCount,qa_status:result.qa.status,chart_values_exact:result.qa.chartValuesExact},result};});
    const previewArtifacts=await execute('render-preview',async()=>{if(!preview)return{summary:{status:'skipped',reason:'preview=false'},artifacts:[]};const pptx=rendered.result.artifacts.find(item=>item.format==='pptx')?.path;if(!pptx)throw new Error('Adapter completed without a PPTX artifact to preview.');const output=await previewDeck(pptx,{signal});artifacts.push(...output);return{summary:{pages:output.filter(item=>item.format==='png').length,pdf:output.some(item=>item.format==='pdf')},artifacts:output};});
    const critique=await execute('critic',async()=>{const qaArtifact=rendered.result.artifacts.find(item=>item.path.endsWith('.qa.json')),renderedQa=qaArtifact?JSON.parse(await fs.promises.readFile(qaArtifact.path,'utf8')):null,imageReview=await critiqueRenderedPages({presentationIR,pages:previewArtifacts.artifacts});const report={schema_version:'1.0.0',job_id:jobId,deck_sha256:rendered.result.artifacts.find(item=>item.format==='pptx')?.sha256,structural:{status:rendered.result.qa.status,errors:rendered.result.qa.errors,warnings:rendered.result.qa.warnings,chart_values_exact:rendered.result.qa.chartValuesExact,per_slide:renderedQa?.slides?.map((slide,index)=>({slide_id:presentationIR.slides[index]?.slide_id,text_bounds_pass:slide.textBoundsPass,text_overlaps:slide.textOverlaps?.length||0,small_text:slide.smallText?.length||0,editable_text_runs:slide.editableText,native_shapes:slide.nativeShapes,native_charts:slide.charts,native_tables:slide.tables}))||null},rendered_image_screen:imageReview,content_intelligence:{method:content.report.method,audience_profile:content.report.audience_profile,slides:content.report.slides},scientific_accuracy:'not_assessed',visual_review:preview?'pending_human':'not_rendered',source_review:presentationIR.source_ir.sources.map(source=>({source_id:source.source_id,verification_status:source.verification_status}))};const file=path.join(runDir,'workflow.critique.json');await writeFile(file,`${JSON.stringify(report,null,2)}\n`);const artifact={path:file,format:'json',sha256:hashFile(file),editable:'not-applicable'};artifacts.push(artifact);return{summary:{structural_status:report.structural.status,rendered_image_screen:imageReview.status,visual_review:report.visual_review,scientific_accuracy:report.scientific_accuracy},report,artifact};});
    const report=await execute('export-and-record',async()=>{const exportDir=path.join(runDir,'export');const exported=await adapter.export({artifacts:rendered.result.artifacts,workspace:base,outputDir:exportDir});artifacts.push(...exported.artifacts);const workflowReport={schema_version:'1.0.0',job_id:jobId,project_id:project?.project_id||null,status:'completed',created_at:events[0].at,completed_at:new Date().toISOString(),stages:events,content_plan:content.report,evidence_inventory:probe.report,visual_plan:visual.report,critique:critique.report,artifacts:artifacts.map(({path:file,format,sha256})=>({path:path.relative(base,file),format,sha256}))};const file=path.join(runDir,'workflow-report.json');await writeFile(file,`${JSON.stringify(workflowReport,null,2)}\n`);const artifact={path:file,format:'json',sha256:hashFile(file),editable:'not-applicable'};artifacts.push(artifact);return{summary:{artifacts:artifacts.length},report:workflowReport,artifact};});
    const eventArtifact={path:logPath,format:'jsonl',sha256:hashFile(logPath),editable:'not-applicable'};artifacts.push(eventArtifact);
    return{status:'completed',job_id:jobId,adapter:adapter.manifest.id,stages:events,artifacts,report:report.report,preview:previewArtifacts.artifacts.map(item=>item.path),validation:validation.summary};
  }catch(error){
    if(error.name!=='AbortError')await stage('workflow','failed',{message:error.message});
    throw error;
  }
}
