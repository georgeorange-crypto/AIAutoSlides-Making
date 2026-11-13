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
import {slidevPresentationAdapter} from '../adapters/slidev-presentation.mjs';

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

export async function runPresentationWorkflow({jobId,project,presentationIR=project?.presentationIR,workspace,outputDir,preview=true,allowDegradedFallback=true,signal,onEvent=()=>{},adapter=null,adapters=null}){
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
    const required={nativeCharts:presentationIR.slides.some(slide=>slide.elements.some(element=>element.kind==='chart'))};
    const candidates=adapters||(adapter?[adapter]:[pptxgenjsIRAdapter,slidevPresentationAdapter]);
    const route=await execute('visual-plan-and-route',async()=>{
      const attempts=[];
      for(const candidate of candidates){
        const probeResult=await candidate.probe();if(probeResult.status!=='available'){attempts.push({adapter:candidate.manifest.id,status:'blocked',reason:probeResult.reason||'probe failed'});continue;}
        const negotiation=await candidate.negotiate({formats:['pptx'],requirements:{}});
        if(!negotiation.formats.includes('pptx')){attempts.push({adapter:candidate.manifest.id,status:'unsupported',reasons:negotiation.reasons});continue;}
        const degraded=required.nativeCharts&&negotiation.capabilities?.nativeCharts!==true;
        if(degraded&&!allowDegradedFallback){attempts.push({adapter:candidate.manifest.id,status:'quality-requirement-failed',reason:'native PowerPoint charts are required'});continue;}
        return{adapter:candidate,negotiation,attempts:[...attempts,{adapter:candidate.manifest.id,status:'selected',degraded,capabilities:negotiation.capabilities}],degraded};
      }
      throw new Error(`No presentation adapter satisfies the request: ${attempts.map(item=>`${item.adapter}: ${item.reason||item.reasons?.join(', ')||item.status}`).join('; ')}`);
    });
    const rendered=await execute('generate-render-and-structural-qa',async()=>{
      const attempts=[...route.attempts],ordered=[route.adapter,...candidates.filter(item=>item!==route.adapter)];let lastError;
      for(const candidate of ordered){
        checkAbort(signal);
        if(candidate!==route.adapter){if(!allowDegradedFallback)break;const probeResult=await candidate.probe();if(probeResult.status!=='available'){attempts.push({adapter:candidate.manifest.id,status:'blocked',reason:probeResult.reason||'probe failed'});continue;}const negotiation=await candidate.negotiate({formats:['pptx'],requirements:{}});if(!negotiation.formats.includes('pptx')){attempts.push({adapter:candidate.manifest.id,status:'unsupported',reasons:negotiation.reasons});continue;}attempts.push({adapter:candidate.manifest.id,status:'fallback-selected',degraded:true,capabilities:negotiation.capabilities});}
        try{
          const result=await candidate.render({presentationIR,workspace:base,outputDir:runDir,inputHash:project?.ir_sha256||null,inputPath:`project:${project?.project_id||'local'}`});
          if(result.slideCount!==presentationIR.slides.length)throw new Error(`Rendered slide count ${result.slideCount} does not match input ${presentationIR.slides.length}.`);
          const degraded=route.degraded||candidate!==route.adapter;const warnings=degraded?['Output capability was degraded by adapter routing/fallback; review editability and chart limitations before delivery.']:[];result.warnings.push(...warnings);result.qa.warnings.push(...warnings);artifacts.push(...result.artifacts);
          return{summary:{slides:result.slideCount,qa_status:result.qa.status,chart_values_exact:result.qa.chartValuesExact,adapter:candidate.manifest.id},result,adapter:candidate,route:{...route,adapter:candidate,attempts,degraded}};
        }catch(error){lastError=error;attempts.push({adapter:candidate.manifest.id,status:'failed',reason:error.message});}
      }
      throw new Error(`All compatible presentation adapters failed: ${attempts.map(item=>`${item.adapter}: ${item.reason||item.status}`).join('; ')}${lastError?` (last: ${lastError.message})`:''}`);
    });
    const previewArtifacts=await execute('render-preview',async()=>{if(!preview)return{summary:{status:'skipped',reason:'preview=false'},artifacts:[]};const pptx=rendered.result.artifacts.find(item=>item.format==='pptx')?.path;if(!pptx)throw new Error('Adapter completed without a PPTX artifact to preview.');const output=await previewDeck(pptx,{signal});artifacts.push(...output);return{summary:{pages:output.filter(item=>item.format==='png').length,pdf:output.some(item=>item.format==='pdf')},artifacts:output};});
    const critique=await execute('critic',async()=>{const qaArtifact=rendered.result.artifacts.find(item=>item.path.endsWith('.qa.json')),renderedQa=qaArtifact?JSON.parse(await fs.promises.readFile(qaArtifact.path,'utf8')):null,imageReview=await critiqueRenderedPages({presentationIR,pages:previewArtifacts.artifacts});const required={science:[...new Set([...presentationIR.source_ir.sources.map(item=>item.source_id),...(presentationIR.source_ir.evidence||[]).map(item=>item.evidence_id),...(presentationIR.source_ir.claims||[]).map(item=>item.claim_id)])].sort(),visual:preview?presentationIR.slides.map(slide=>slide.slide_id).sort():[]};const report={schema_version:'1.0.0',job_id:jobId,deck_sha256:rendered.result.artifacts.find(item=>item.format==='pptx')?.sha256,structural:{status:rendered.result.qa.status,errors:rendered.result.qa.errors,warnings:rendered.result.qa.warnings,chart_values_exact:rendered.result.qa.chartValuesExact,per_slide:renderedQa?.slides?.map((slide,index)=>({slide_id:presentationIR.slides[index]?.slide_id,text_bounds_pass:slide.textBoundsPass,text_overlaps:slide.textOverlaps?.length||0,small_text:slide.smallText?.length||0,editable_text_runs:slide.editableText,native_shapes:slide.nativeShapes,native_charts:slide.charts,native_tables:slide.tables}))||null},rendered_image_screen:imageReview,content_intelligence:{method:content.report.method,audience_profile:content.report.audience_profile,slides:content.report.slides},scientific_accuracy:'not_assessed',visual_review:preview?'pending_human':'not_rendered',source_review:presentationIR.source_ir.sources.map(source=>({source_id:source.source_id,verification_status:source.verification_status})),review_requirements:required};const file=path.join(runDir,'workflow.critique.json');await writeFile(file,`${JSON.stringify(report,null,2)}\n`);const artifact={path:file,format:'json',sha256:hashFile(file),editable:'not-applicable'};artifacts.push(artifact);return{summary:{structural_status:report.structural.status,rendered_image_screen:imageReview.status,visual_review:report.visual_review,scientific_accuracy:report.scientific_accuracy},report,artifact};});
    const report=await execute('export-and-record',async()=>{const exportDir=path.join(runDir,'export');const exported=await rendered.adapter.export({artifacts:rendered.result.artifacts,workspace:base,outputDir:exportDir});artifacts.push(...exported.artifacts);const workflowReport={schema_version:'1.0.0',job_id:jobId,project_id:project?.project_id||null,status:'awaiting_review',created_at:events[0].at,completed_at:null,stages:events,content_plan:content.report,evidence_inventory:probe.report,visual_plan:{selected_adapter:rendered.adapter.manifest.id,degraded:rendered.route.degraded,attempts:rendered.route.attempts,capabilities:rendered.route.negotiation.capabilities},critique:critique.report,artifacts:artifacts.map(({path:file,format,sha256})=>({path:path.relative(base,file),format,sha256}))};const file=path.join(runDir,'workflow-report.json');await writeFile(file,`${JSON.stringify(workflowReport,null,2)}\n`);const artifact={path:file,format:'json',sha256:hashFile(file),editable:'not-applicable'};artifacts.push(artifact);return{summary:{artifacts:artifacts.length,status:'awaiting_review'},report:workflowReport,artifact};});
    const eventArtifact={path:logPath,format:'jsonl',sha256:hashFile(logPath),editable:'not-applicable'};artifacts.push(eventArtifact);
    return{status:'awaiting_review',job_id:jobId,adapter:rendered.adapter.manifest.id,stages:events,artifacts,report:report.report,preview:previewArtifacts.artifacts.map(item=>item.path),validation:validation.summary,review_context:{deck_sha256:critique.report.deck_sha256,required:critique.report.review_requirements}};
  }catch(error){
    if(error.name!=='AbortError')await stage('workflow','failed',{message:error.message});
    throw error;
  }
}
