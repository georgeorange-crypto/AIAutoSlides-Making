import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {definePresentationAdapter} from './protocol.mjs';
import {assertValidPresentationIR} from '../core/validate-presentation.mjs';
import {validateDeck} from '../../src/validate.mjs';
import {generatePresentation} from '../../src/render.mjs';
import {createRunManifest} from '../contracts/migrate.mjs';
import {patchPresentationSlide} from '../core/patch-slide.mjs';
import {parseMermaidFlowchart} from '../core/mermaid-flowchart.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url);
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const digestFile=file=>digest(fs.readFileSync(file));
const sourceLabel=source=>source.label||source.uri||source.source_id;
const IMAGE_TYPES={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'};
const MAX_ASSET_BYTES=25*1024*1024;

function resolveContained(workspace,candidate,label){
  const base=path.resolve(workspace),target=path.resolve(candidate),relative=path.relative(base,target);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error(`${label} must be inside the adapter workspace`);
  return target;
}
function loadIRAssets(ir,workspace){
  const declared=Array.isArray(ir.assets)?ir.assets:[],byId=new Map(declared.map(asset=>[asset.asset_id,asset])),used=new Map(),warnings=[],loaded=new Map();
  for(const slide of ir.slides)for(const element of slide.elements)if(element.kind==='image')used.set(element.asset_id,[...(used.get(element.asset_id)||[]),slide.slide_id]);
  const base=path.resolve(workspace),realBase=fs.realpathSync(base);
  for(const [assetId,slideIds] of used){
    const asset=byId.get(assetId);if(!asset)throw new Error(`Image references unknown asset '${assetId}'`);
    if(asset.rights_status==='restricted')throw new Error(`Asset '${assetId}' is restricted and cannot be embedded`);
    if(!asset.uri||!asset.sha256||!asset.source_id)throw new Error(`Embedded asset '${assetId}' requires a local uri, SHA-256, and source_id`);
    if(asset.uri.startsWith('http:')||asset.uri.startsWith('https:')||asset.uri.startsWith('data:'))throw new Error(`Asset '${assetId}' must be a local workspace file; remote/data URLs are not fetched`);
    let candidate=asset.uri.startsWith('file:')?fileURLToPath(asset.uri):path.resolve(base,asset.uri);
    candidate=resolveContained(base,candidate,`Asset '${assetId}'`);
    if(!fs.existsSync(candidate)||!fs.statSync(candidate).isFile())throw new Error(`Asset '${assetId}' file does not exist: ${asset.uri}`);
    const resolved=fs.realpathSync(candidate),relative=path.relative(realBase,resolved);
    if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error(`Asset '${assetId}' resolves outside the adapter workspace through a symlink`);
    const ext=path.extname(resolved).toLowerCase(),mediaType=IMAGE_TYPES[ext];
    if(!mediaType||asset.media_type!==mediaType)throw new Error(`Asset '${assetId}' has unsupported or mismatched image media_type`);
    const bytes=fs.readFileSync(resolved);if(bytes.length>MAX_ASSET_BYTES)throw new Error(`Asset '${assetId}' exceeds the 25 MB image limit`);
    const sha256=digest(bytes);if(sha256.toLowerCase()!==asset.sha256.toLowerCase())throw new Error(`Asset '${assetId}' SHA-256 does not match its local file`);
    if(mediaType==='image/svg+xml'){
      const svg=bytes.toString('utf8');
      if(/<\s*(script|foreignObject)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|data:|file:|\/\/)|url\(\s*["']?(?!#)/i.test(svg))throw new Error(`Asset '${assetId}' SVG contains executable or external references`);
    }
    loaded.set(assetId,{...asset,mime_type:mediaType,type:mediaType,source:asset.source_id,license:asset.license||'unknown',verified:asset.rights_status==='approved',sha256,resolved_path:resolved,slides:slideIds});
    if(asset.rights_status!=='approved')warnings.push(`Asset ${assetId} rights status is ${asset.rights_status}; embedding does not establish permission.`);
    if(!asset.license)warnings.push(`Asset ${assetId} has no license metadata; verify reuse rights before distribution.`);
  }
  return{assets:loaded,warnings};
}
function installedPackage(name){
  let current=path.dirname(require.resolve(name));
  while(current!==path.dirname(current)){
    const candidate=path.join(current,'package.json');
    if(fs.existsSync(candidate)){const pkg=JSON.parse(fs.readFileSync(candidate,'utf8'));if(pkg.name===name)return pkg;}
    current=path.dirname(current);
  }
  throw new Error(`Cannot locate ${name} package metadata`);
}

export function mapPresentationIRToLegacy(ir){
  const check=assertValidPresentationIR(ir),sources=ir.source_ir.sources;
  const sourceEntries=sources.map(source=>({id:source.source_id,label:sourceLabel(source),source:source.uri||source.source_id,locator:source.locator||null,verified:source.verification_status==='verified',note:source.verification_status==='verified'?'':'IR source is not marked verified; rendering does not verify it.'}));
  const sourceById=new Map(sources.map(source=>[source.source_id,source]));
  const evidenceEntries=(ir.source_ir.evidence||[]).map(item=>{const source=sourceById.get(item.source_id);return{id:item.evidence_id,label:item.label||item.title||item.excerpt.slice(0,120),source:source?.uri||item.source_id,locator:item.locator||source?.locator||null,verified:item.verification_status==='verified',note:item.verification_status==='verified'?'':'Evidence remains unverified/pending; rendering does not verify it.'};});
  const evidence={entries:[...sourceEntries,...evidenceEntries]};
  const warnings=[...check.warnings];
  const slides=ir.slides.map(slide=>{
    const body=[],sourceIds=new Set(slide.evidence_ids||[]),mapped={slide_id:slide.slide_id,type:slide.type,title:slide.title,assertion_title:slide.assertion_title||undefined,evidence_ids:[],speaker_notes:slide.speaker_notes||'',kicker:slide.role||slide.kicker||slide.type,layout:slide.design?.legacy_layout||undefined,figure_description:slide.design?.visual_description||undefined};
    for(const element of slide.elements){
      for(const id of element.source_ids||[])sourceIds.add(id);
      switch(element.kind){
        case 'text': body.push(String(element.text??element.value)); break;
        case 'callout': body.push(String(element.text??element.value)); break;
        case 'image':
          mapped.visuals||=[];
          mapped.visuals.push({asset_id:element.asset_id,x:element.x,y:element.y,w:element.w,h:element.h});
          mapped.speaker_notes=[mapped.speaker_notes,`Image description: ${element.alt}`].filter(Boolean).join('\n\n');
          break;
        case 'bullets': body.push(...element.items.map(String)); break;
        case 'table':
          if(mapped.table)throw new Error(`${slide.slide_id}: PptxGenJS mapping supports one native table per slide`);
          mapped.table={headers:element.headers,rows:element.rows,caption:element.caption};
          break;
        case 'cards':
          if(mapped.metrics)throw new Error(`${slide.slide_id}: PptxGenJS mapping supports one metric-card group per slide`);
          mapped.metrics=element.items.map(item=>({label:item.title,value:String(item.value??item.body),detail:item.detail||''}));
          break;
        case 'chart': {
          if(mapped.chart)throw new Error(`${slide.slide_id}: PptxGenJS mapping supports one chart per slide`);
          const scatter=['scatter','cdf'].includes(element.chart_kind);
          mapped.chart={kind:element.chart_kind,unit:element.y_unit||element.y_axis_label,y_axis_label:element.y_axis_label,x_axis_label:element.x_axis_label,x_unit:element.x_unit||element.x_axis_label,series_name:element.series[0]?.name,categories:element.categories||element.x_values.map(String),x_values:element.x_values,values:element.series[0]?.values,series:element.series,raw_values:element.raw_values,sample_size:element.sample_size};
          if(scatter&&!element.x_unit)warnings.push(`${slide.slide_id}/${element.element_id}: x-axis unit is not separately specified; using the axis label as its description`);
          break;
        }
        case 'process':
          if(mapped.steps)throw new Error(`${slide.slide_id}: PptxGenJS mapping supports one process per slide`);
          {
            const steps=element.steps||element.items;
            mapped.steps=steps.map(step=>typeof step==='string'?step:step.title);
            const details=steps.filter(step=>typeof step==='object'&&step.detail).map((step,index)=>`${index+1}. ${step.detail}`);
            if(details.length)mapped.speaker_notes=[mapped.speaker_notes,`Process details:\n${details.join('\n')}`].filter(Boolean).join('\n\n');
          }
          break;
        case 'diagram':
          if(mapped.diagram)throw new Error(`${slide.slide_id}: PptxGenJS mapping supports one structured diagram per slide`);
          mapped.diagram={groups:element.groups,nodes:element.nodes,edges:element.edges};
          break;
        case 'mermaid':
          try{
            if(mapped.diagram||mapped.chart||mapped.steps)throw new Error('a Mermaid flowchart cannot share a slide with another structured visual');
            mapped.diagram=parseMermaidFlowchart(element.source);
            mapped.type='architecture';
            mapped.speaker_notes=[mapped.speaker_notes,`Mermaid source (native-shape subset):\n${element.source}`].filter(Boolean).join('\n\n');
          }catch(error){
            body.push(`Diagram source (editable text; native rendering unavailable):\n${element.source}`);
            warnings.push(`${slide.slide_id}/${element.element_id}: Mermaid source was preserved as text because native conversion was unavailable (${error.message})`);
          }
          break;
        default: throw new Error(`${slide.slide_id}/${element.element_id}: unsupported PptxGenJS IR element '${element.kind}'`);
      }
    }
    mapped.evidence_ids=[...sourceIds];
    if(slide.type!=='cover'&&slide.type!=='closing'&&!mapped.evidence_ids.length)throw new Error(`${slide.slide_id}: factual slide needs source/evidence IDs`);
    if(body.length)mapped.body=body;
    if(slide.type==='cards')mapped.type='metrics';
    if(slide.type==='architecture'&&slide.elements.some(element=>element.kind==='mermaid')&&!mapped.diagram)mapped.type='statement';
    if(mapped.type==='architecture'&&!mapped.diagram)throw new Error(`${slide.slide_id}: architecture slide requires one structured diagram element`);
    // AI planner diagrams use a panel with a separate relationship legend.
    // Midpoint labels on the legacy architecture renderer can collide with nodes
    // in branching layouts, so route described visuals through that panel renderer.
    if(slide.type==='architecture'&&mapped.figure_description)mapped.type='statement';
    if(slide.type==='process'&&!mapped.steps?.length)throw new Error(`${slide.slide_id}: process slide requires process.steps or process.items`);
    if(slide.type==='chart'&&!mapped.chart)throw new Error(`${slide.slide_id}: chart slide has no chart element`);
    if(slide.type==='table'&&!mapped.table)throw new Error(`${slide.slide_id}: table slide has no table element`);
    if(slide.type==='metrics'&&!mapped.metrics)throw new Error(`${slide.slide_id}: metrics slide has no cards element`);
    if(mapped.chart&&slide.type!=='chart')throw new Error(`${slide.slide_id}: chart element requires slide type 'chart'`);
    if(mapped.table&&slide.type!=='table')throw new Error(`${slide.slide_id}: table element requires slide type 'table'`);
    if(mapped.metrics&&!['cards','metrics'].includes(slide.type))throw new Error(`${slide.slide_id}: cards element requires slide type 'cards' or 'metrics'`);
    if(mapped.steps&&slide.type!=='process')throw new Error(`${slide.slide_id}: process element requires slide type 'process'`);
    return mapped;
  });
  const theme=ir.meta.theme||ir.design_tokens?.theme_id||'academic-light';
  if(!['academic-light','tech-dark','keynote-minimal'].includes(theme))throw new Error(`Unsupported PptxGenJS theme '${theme}'`);
  const deck={meta:{...ir.meta,title:ir.meta.title,theme,status:ir.meta.status||'IR DRAFT',aspect_ratio:'16:9'},slides};
  return{deck,evidence,warnings,theme};
}

async function renderIR({presentationIR,workspace,outputDir,outputName='presentation.pptx',inputHash=null,inputPath='presentation-ir.json'}){
  if(!presentationIR)throw new TypeError('render request requires presentationIR');
  if(!workspace||!outputDir)throw new TypeError('render request requires explicit workspace and outputDir');
  if(path.basename(outputName)!==outputName||!outputName.toLowerCase().endsWith('.pptx'))throw new Error('outputName must be a local .pptx filename');
  const outDir=resolveContained(workspace,outputDir,'outputDir');
  await mkdir(path.resolve(workspace),{recursive:true});
  await mkdir(outDir,{recursive:true});
  const realWorkspace=fs.realpathSync(path.resolve(workspace)),realOutput=fs.realpathSync(outDir),realRelative=path.relative(realWorkspace,realOutput);
  if(realRelative==='..'||realRelative.startsWith(`..${path.sep}`)||path.isAbsolute(realRelative))throw new Error('outputDir resolves outside the adapter workspace through a symlink');
  const {deck,evidence,warnings,theme}=mapPresentationIRToLegacy(presentationIR),assetLoad=loadIRAssets(presentationIR,workspace);
  warnings.push(...assetLoad.warnings);
  const validation=validateDeck(deck,evidence);
  if(validation.errors.length)throw new Error(`Mapped storyboard invalid: ${validation.errors.join('; ')}`);
  warnings.push(...validation.warnings);
  const pptxPath=path.join(outDir,outputName),stem=pptxPath.replace(/\.pptx$/i,''),storyboardPath=`${stem}.storyboard.json`,evidencePath=`${stem}.evidence.json`;
  await Promise.all([writeFile(storyboardPath,JSON.stringify(deck,null,2)+'\n'),writeFile(evidencePath,JSON.stringify(evidence,null,2)+'\n')]);
  const themeObject=JSON.parse(await readFile(path.join(root,'themes',`${theme}.json`),'utf8'));
  await generatePresentation(deck,evidence,themeObject,pptxPath,assetLoad.assets);
  const inputSha256=inputHash||digest(Buffer.from(JSON.stringify(presentationIR)));
  const evidenceParent=new Map((presentationIR.source_ir.evidence||[]).map(item=>[item.evidence_id,item.source_id]));
  const lineage={schema_version:'1.0.0',deck_id:presentationIR.deck_id||null,source_ir_sha256:inputSha256,sources:presentationIR.source_ir.sources.map(source=>({source_id:source.source_id,type:source.type,uri:source.uri||null,sha256:source.sha256||null,locator:source.locator||null,verification_status:source.verification_status})),evidence:presentationIR.source_ir.evidence||[],claims:presentationIR.source_ir.claims||[],assets:[...assetLoad.assets.values()].map(asset=>({asset_id:asset.asset_id,source_id:asset.source_id,uri:path.basename(asset.uri),sha256:asset.sha256,media_type:asset.media_type,license:asset.license,rights_status:asset.rights_status,slide_ids:asset.slides})),slides:presentationIR.slides.map((slide,index)=>({slide_id:slide.slide_id,slide_number:index+1,evidence_ids:[...new Set([...slide.evidence_ids,...slide.elements.flatMap(element=>element.source_ids||[])])],elements:slide.elements.map(element=>({element_id:element.element_id,kind:element.kind,...(element.kind==='image'?{asset_id:element.asset_id,alt:element.alt,placement:{x:element.x,y:element.y,w:element.w,h:element.h}}:{}),source_ids:[...new Set(element.source_ids?.length?element.source_ids:slide.evidence_ids.map(id=>evidenceParent.get(id)||id))]}))}))};
  const lineagePath=`${stem}.lineage.json`;
  await writeFile(lineagePath,JSON.stringify(lineage,null,2)+'\n');
  const review={ok:true,theme,source:storyboardPath,evidence:evidencePath,slides:deck.slides.length,warnings};
  const reviewPath=`${stem}.review.json`;
  await writeFile(reviewPath,JSON.stringify(review,null,2)+'\n');
  const qaResult=spawnSync(process.execPath,[path.join(root,'src/qa.mjs'),pptxPath],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});
  if(qaResult.error||qaResult.status!==0)throw new Error(qaResult.stderr||qaResult.stdout||qaResult.error?.message||'PPTX structural QA failed');
  const qaPath=`${stem}.qa.json`,qa=JSON.parse(await readFile(qaPath,'utf8'));
  const outputs=[pptxPath,storyboardPath,evidencePath,lineagePath,reviewPath,qaPath].map(file=>({path:path.basename(file),format:path.extname(file).slice(1),sha256:digestFile(file),editable:file===pptxPath?'native':'not-applicable'}));
  const manifest=createRunManifest({runId:`pptxgenjs-ir-${Date.now()}`,workflow:'presentation-ir-render',inputs:[{path:path.basename(inputPath),sha256:inputSha256,format:'json'},...[...assetLoad.assets.values()].map(asset=>({path:`assets/${asset.asset_id}/${path.basename(asset.uri)}`,sha256:asset.sha256,format:asset.media_type}))],outputs,status:'completed',toolCalls:[{tool_id:'pptxgenjs-ir',version:'1.0.0',status:'completed',warnings}],logs:[]});
  const verificationStates=presentationIR.source_ir.sources.map(source=>source.verification_status);
  const sourceVerification=verificationStates.length&&verificationStates.every(status=>status==='verified')?'verified':verificationStates.some(status=>status==='verified'||status==='contradicted')?'partial':'pending';
  manifest.policy={network:'local-only',paid_api_calls:0,synthetic_data:/SYNTHETIC/i.test(deck.meta.status||''),source_verification:sourceVerification};
  const runPath=`${stem}.run-manifest.json`;
  await writeFile(runPath,JSON.stringify(manifest,null,2)+'\n');
  outputs.push({path:path.basename(runPath),format:'json',sha256:digestFile(runPath),editable:'not-applicable'});
  const slideEditability=qa.slides.map((item,index)=>({slide_id:deck.slides[index].slide_id,text:item.editableText>0,native_shapes:item.nativeShapes,native_charts:item.charts,native_tables:item.tables,images:item.images}));
  return{status:'completed',adapter:'pptxgenjs-ir',backendVersion:'1.0.0',slideCount:deck.slides.length,slideEditability,qa:{status:qa.status,errors:qa.errors,warnings:qa.warnings,chartValuesExact:qa.chartData.exactMatch},artifacts:outputs.map(item=>({...item,path:path.join(outDir,item.path)})),warnings:[...warnings,...qa.warnings]};
}

export const pptxgenjsIRAdapter=definePresentationAdapter({
  manifest:{id:'pptxgenjs-ir',version:'1.0.0',status:'e2e-tested',kind:'deck-backend',invoke:'local-library',capabilities:['presentation-ir-1.0.0','native-editable-pptx','native-charts','source-lineage','structural-qa','run-manifest','slide-ir-patch','artifact-export'],platforms:['windows','linux','macos'],inputs:['presentation-ir-1.0.0'],outputs:['editable-pptx','lineage-manifest','qa-report','run-manifest'],locality:'local',needsNetwork:false,needsAuth:false,price:'free-local',canEdit:true,canNativeCharts:true,dependencies:['PptxGenJS 4.x root dependency'],terms:'MIT project code; verify runtime and transitive dependencies for distribution'},
  async doctor(){try{const pkg=installedPackage('pptxgenjs');return{ok:true,status:'available',version:pkg.version,warnings:[]};}catch{return{ok:false,status:'blocked',reason:'Run npm ci to install PptxGenJS.',warnings:[]};}},
  async probe(){const result=await this.doctor();return{status:result.ok?'available':'blocked',version:result.version,reason:result.reason};},
  async probeCapabilities(){return{formats:['pptx'],editableObjects:['text','shapes','tables','charts'],nativeCharts:true,localOnly:true,legacyCliPreserved:true,slideIRPatch:true,incrementalSlideEdit:false,cancelDuringInProcessRender:false};},
  async capabilities(){return this.probeCapabilities();},
  async run(request){return renderIR(request);},
  async render(request){return renderIR(request);},
  async edit({presentationIR,slideId,patch}){const updated=patchPresentationSlide(presentationIR,slideId,patch);return{presentationIR:updated,slideId,rendered:false,scope:'validated-slide-ir-patch',limitations:['The adapter returns a validated IR revision. A subsequent render rebuilds the full deck; untouched-slide hash stability is not guaranteed.']};},
  async export({artifacts,workspace,outputDir}){if(!Array.isArray(artifacts)||!workspace||!outputDir)throw new TypeError('export requires artifacts[], workspace and outputDir');const base=path.resolve(workspace),out=resolveContained(base,outputDir,'export outputDir');await mkdir(out,{recursive:true});const realBase=fs.realpathSync(base),realOut=fs.realpathSync(out),rel=path.relative(realBase,realOut);if(rel==='..'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel))throw new Error('export outputDir resolves outside workspace');const exported=[];for(const item of artifacts){const source=resolveContained(base,item.path,'export source'),realSource=fs.realpathSync(source);if(!fs.statSync(realSource).isFile())throw new Error('export source must be a file');const target=path.join(out,path.basename(realSource));if(fs.existsSync(target))throw new Error(`Refusing to overwrite exported artifact '${path.basename(target)}'`);await fs.promises.copyFile(realSource,target,fs.constants.COPYFILE_EXCL);exported.push({path:target,format:path.extname(target).slice(1),sha256:digestFile(target)});}return{status:'completed',artifacts:exported};},
  async cancel(){return{cancelled:false,supported:false,reason:'PptxGenJS renders in-process and cannot be interrupted safely; workflow cancellation is honored between stages.'};},
  async smokeTest(){
    const dir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'aiautoslides-pptxgenjs-ir-'));
    try{
      const fixture=JSON.parse(await readFile(path.join(root,'examples/phase1/pptxgenjs-ir.json'),'utf8'));
      const result=await renderIR({presentationIR:fixture,workspace:dir,outputDir:dir});
      if(result.slideCount!==3||result.qa.chartValuesExact!==true||result.qa.errors.length)throw new Error('IR deck failed native chart or source-data QA');
      return{ok:true,slides:result.slideCount,editable_text_slides:result.slideEditability.filter(slide=>slide.text).length,native_charts:result.slideEditability.reduce((n,slide)=>n+slide.native_charts,0),chart_values_exact:result.qa.chartValuesExact,unverified_source_preserved:result.warnings.some(w=>w.includes('E_PHASE1_SYN remains unverified')),qa_status:result.qa.status};
    }finally{await rm(dir,{recursive:true,force:true});}
  }
});
