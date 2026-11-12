#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pdfjsAdapter} from '../packages/adapters/pdfjs.mjs';
import {createRunManifest} from '../packages/contracts/migrate.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),argv=process.argv.slice(2);
const option=(name,fallback)=>{const i=argv.indexOf(`--${name}`);return i<0?fallback:argv[i+1];};
if(argv.includes('--help')){console.log('Usage: npm run workflow:research -- [--paper PDF] [--csv CSV] [--architecture JSON] [--out-dir DIR] [--skip-preview]');process.exit(0);}
const paper=path.resolve(option('paper','examples/research-workflow/fixtures/synthetic-paper.pdf'));
const csv=path.resolve(option('csv','examples/from-csv/synthetic-latency.csv'));
const diagram=path.resolve(option('architecture','examples/multimodal/architecture.json'));
const outDir=path.resolve(option('out-dir','outputs/research-workflow'));
const skipPreview=argv.includes('--skip-preview');
const now=()=>Date.now(),hashFile=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const rel=file=>path.relative(root,file).replaceAll('\\','/');
function run(command,args){const start=now(),r=spawnSync(command,args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:10*1024*1024});if(r.error||r.status!==0)throw new Error(`${path.basename(command)} ${args.join(' ')} failed: ${r.error?.message||r.stderr||r.stdout}`);return{duration_ms:now()-start,stdout:r.stdout.trim()};}
function artifact(file,format,editable='not-applicable'){return{path:rel(file),format,editable,sha256:hashFile(file)};}
const started=now(),toolCalls=[],logs=[];
try{
 for(const f of [paper,csv,diagram])if(!fs.existsSync(f))throw new Error(`Missing required input: ${f}`);
 const sourceRoot=path.join(outDir,'sources'),csvOut=path.join(outDir,'csv'),taskFile=path.join(outDir,'pdf-task.json');
 fs.mkdirSync(sourceRoot,{recursive:true});fs.mkdirSync(csvOut,{recursive:true});
 const task={input:path.basename(paper),evidenceId:'E_PAPER',label:`Local source: ${path.basename(paper)}`};fs.writeFileSync(taskFile,JSON.stringify(task,null,2)+'\n');
 const pdfStarted=now(),pdfResult=await pdfjsAdapter.run({inputDir:path.dirname(paper),outputDir:sourceRoot,taskFile});
 toolCalls.push({tool_id:'pdfjs-dist',version:(await pdfjsAdapter.doctor()).version,status:'completed',duration_ms:now()-pdfStarted,warnings:pdfResult.warnings});
 const csvSb=path.join(csvOut,'storyboard.json'),csvResult=run(process.execPath,[path.join(root,'src/import-csv.mjs'),csv,csvSb,'bar','--allow-unverified-local']);
 toolCalls.push({tool_id:'csv-importer',version:'local source',status:'completed',duration_ms:csvResult.duration_ms,warnings:[]});logs.push(csvResult.stdout);
 const deck=JSON.parse(fs.readFileSync(csvSb,'utf8'));
 const csvEvidenceFile=csvSb.replace(/\.json$/,'-evidence.json'),csvEvidence=JSON.parse(fs.readFileSync(csvEvidenceFile,'utf8'));
 const paperEvidence=JSON.parse(fs.readFileSync(pdfResult.artifacts.find(f=>f.endsWith('.evidence.json')),'utf8')).entries[0];
 const paperManifest=JSON.parse(fs.readFileSync(pdfResult.artifacts.find(f=>f.endsWith('.source.json')),'utf8'));
 paperEvidence.source=rel(paper);paperEvidence.locator=`Extracted ${paperManifest.block_count} page(s); source SHA-256 ${paperManifest.source_sha256}`;
 const diagramData=JSON.parse(fs.readFileSync(diagram,'utf8'));
 const diagramEvidence={id:'E_ARCH',label:'Hypothetical architecture input',source:rel(diagram),locator:`SHA-256 ${hashFile(diagram)}; groups, nodes, and directed edges`,verified:false,note:'Architecture is an illustrative input. It is not evidence of a deployed system.'};
 const firstPage=fs.readFileSync(pdfResult.artifacts.find(f=>f.endsWith('.md')),'utf8').split(/\n## Page 0001\n/)[1]?.split(/\n## Page /)[0]||'';
 const excerpt=firstPage.replace(/^Locator:.*\n\n/,'').replace(/^> /gm,'').trim().split(/\s+/).slice(0,22).join(' ').replace(/\\([#>*+-])/g,'$1').slice(0,140).trimEnd();
 const synthetic=deck.meta.data_status==='synthetic';deck.meta.title='Local PDF + CSV research workflow';deck.meta.subtitle=synthetic?'Selectable PDF text, synthetic CSV, editable PowerPoint outputs':'Selectable PDF text, local data, verification pending';deck.meta.status=synthetic?'SYNTHETIC / HYPOTHETICAL — CSV rows are not research evidence':'LOCAL DATA — SOURCE VERIFICATION PENDING';
 deck.slides.splice(1,0,{type:'statement',kicker:'LOCAL SOURCE',title:'PDF text is extracted with page locations and remains unverified',assertion_title:'This run preserved a local PDF source and extraction locator',body:[`Extracted excerpt: “${excerpt.slice(0,220)}”`,'Text extraction does not verify scientific claims.'],evidence_ids:['E_PAPER'],speaker_notes:'The PDF text came from a local selectable-text extraction. Compare all claims with the original source; this synthetic fixture is not research evidence.'});
 deck.slides.splice(2,0,{type:'architecture',kicker:'STRUCTURED FIGURE',title:'Architecture JSON maps to editable PowerPoint shapes',diagram:diagramData,evidence_ids:['E_ARCH'],speaker_notes:'This fixture architecture is hypothetical. Its boxes and connectors are native PowerPoint objects produced from the supplied structure.'});
 deck.slides.forEach((slide,i)=>{slide.slide_id=`S${String(i+1).padStart(2,'0')}`;});
 const evidence={entries:[paperEvidence,...csvEvidence.entries,diagramEvidence]},storyboard=path.join(outDir,'storyboard.json'),evidenceFile=path.join(outDir,'evidence.json');
 fs.writeFileSync(storyboard,JSON.stringify(deck,null,2)+'\n');fs.writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+'\n');
 const deckPath=path.join(outDir,'research-workflow.pptx');
 const validation=run(process.execPath,[path.join(root,'src/cli.mjs'),'validate','--input',storyboard,'--evidence',evidenceFile]);logs.push(validation.stdout);
 const build=run(process.execPath,[path.join(root,'src/cli.mjs'),'build','--input',storyboard,'--evidence',evidenceFile,'--out',deckPath]);const pptxDoctor=await(await import('../packages/adapters/pptxgenjs.mjs')).pptxgenjsAdapter.doctor();toolCalls.push({tool_id:'pptxgenjs',version:pptxDoctor.version||'unknown',status:'completed',duration_ms:build.duration_ms,warnings:[]});logs.push(build.stdout);
 const qa=run(process.execPath,[path.join(root,'src/qa.mjs'),deckPath]);toolCalls.push({tool_id:'ooxml-inspector',version:'local source',status:'completed',duration_ms:qa.duration_ms,warnings:[]});logs.push(qa.stdout);
 const qaJson=deckPath.replace(/\.pptx$/i,'.qa.json'),review=JSON.parse(fs.readFileSync(qaJson,'utf8'));
 if(review.status==='fail'||review.slideCount!==deck.slides.length||review.nativeChartCount<1||review.nativeShapeCount<1)throw new Error(`PPTX QA did not meet expected slide/chart/shape checks (${review.status}, ${review.slideCount} slides, ${review.nativeChartCount} charts, ${review.nativeShapeCount} shapes)`);
 let previewFiles=[];
 if(!skipPreview){const preview=run(process.execPath,[path.join(root,'scripts/preview.mjs'),deckPath]);logs.push(preview.stdout);const pdf=deckPath.replace(/\.pptx$/i,'.pdf'),previewJson=deckPath.replace(/\.pptx$/i,'.preview.json'),previewInfo=JSON.parse(fs.readFileSync(previewJson,'utf8'));previewFiles=[pdf,previewJson,...fs.readdirSync(outDir).filter(f=>/^research-workflow-page-\d+\.png$/.test(f)).map(f=>path.join(outDir,f))];if(!fs.existsSync(pdf)||previewFiles.length!==deck.slides.length+2||previewInfo.status!=='rendered'||previewInfo.pages.length!==deck.slides.length)throw new Error(`Preview count/status mismatch: expected ${deck.slides.length} page PNGs and one PDF`);const rendererId=previewInfo.renderer_used==='powerpoint'?'powerpoint-com':previewInfo.renderer_used==='libreoffice'?'libreoffice':'playwright-renderer';toolCalls.push({tool_id:rendererId,version:previewInfo.renderer_version,status:'completed',duration_ms:preview.duration_ms,warnings:['Review every rendered page visually; file generation does not prove visual quality.']},{tool_id:previewInfo.rasterizer.id==='pdftoppm'?'poppler':'pdftocairo',version:previewInfo.rasterizer.version,status:'completed',duration_ms:preview.duration_ms,warnings:[]});}
 const outputFiles=[...pdfResult.artifacts,taskFile,csvSb,csvEvidenceFile,storyboard,evidenceFile,deckPath,deckPath.replace(/\.pptx$/i,'.review.json'),deckPath.replace(/\.pptx$/i,'.evidence-manifest.json'),qaJson,deckPath.replace(/\.pptx$/i,'.qa.md'),...previewFiles];
 const runManifest=createRunManifest({runId:`research-${new Date().toISOString().replace(/[:.]/g,'-')}`,workflow:'research',inputs:[paper,csv,diagram].map(file=>({path:rel(file),format:path.extname(file).slice(1),sha256:hashFile(file)})),outputs:outputFiles.filter(fs.existsSync).map(f=>artifact(f,path.extname(f).slice(1),path.extname(f)==='.pptx'?'native':path.extname(f)==='.png'?'raster':'not-applicable')),toolCalls,logs:[...logs,`Local cost: $0. External network calls: none.`,`Elapsed workflow time: ${now()-started} ms.`]});
 runManifest.completed_at=new Date().toISOString();runManifest.elapsed_ms=now()-started;runManifest.policy={network:'local-only',paid_api_calls:0,synthetic_data:synthetic,source_verification:'pending'};
 const manifestFile=path.join(outDir,'run-manifest.json');fs.writeFileSync(manifestFile,JSON.stringify(runManifest,null,2)+'\n');
 console.log(`Research workflow completed: ${deck.slides.length} slides, ${review.nativeChartCount} native chart, ${review.nativeShapeCount} native shapes.`);
 console.log(`PPTX: ${deckPath}`);console.log(`Run manifest: ${manifestFile}`);if(skipPreview)console.log('Preview skipped by request; use without --skip-preview for PDF and PNG outputs.');else console.log(`Preview: ${deckPath.replace(/\.pptx$/i,'.pdf')} plus ${deck.slides.length} page PNGs`);
}catch(error){console.error(`[research workflow failed] ${error.message}`);process.exitCode=1;}
