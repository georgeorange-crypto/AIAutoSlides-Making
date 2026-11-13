import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {defineToolAdapter} from './protocol.mjs';
import {buildSourceBundle} from '../../src/document-extractors.mjs';

const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const worker=path.join(root,'workers','pymupdf'),script=path.join(worker,'extract_pdf.py');
const defaultPython=path.join(worker,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const python=process.env.AI4SLIDES_PYMUPDF_PYTHON||defaultPython;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_TASK_BYTES=64*1024;

function invoke(args,{timeout=120000}={}){
 const result=spawnSync(python,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:12*1024*1024,windowsHide:true,env:{...process.env,PYTHONUTF8:'1'}});
 if(result.error)throw new Error(result.error.message);
 if(result.status!==0)throw new Error((result.stderr||result.stdout||`Python exited with ${result.status}`).trim().slice(-3000));
 return(result.stdout||'').trim();
}
function boundedJson(file){const resolved=path.resolve(file),info=fs.statSync(resolved);if(!info.isFile()||!info.size||info.size>MAX_TASK_BYTES)throw new Error(`Task JSON must be a regular file from 1 to ${MAX_TASK_BYTES} bytes.`);return JSON.parse(fs.readFileSync(resolved,'utf8'));}
function inside(rootDir,file){const base=fs.realpathSync(rootDir),target=fs.realpathSync(file),rel=path.relative(base,target);if(!rel||rel==='.'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel))throw new Error('PDF input must be a file inside inputDir.');return target;}

export function createPyMuPDFAdapter({runCommand=invoke}={}){
 return defineToolAdapter({
  manifest:{id:'pymupdf',version:'2.1',status:'adapter-ready',kind:'parser',invoke:'isolated Python venv worker',inputs:['local-pdf','task-json'],outputs:['source-markdown','source-manifest','evidence-entry','page-locators','embedded-images','vector-coordinates','png-preview','run-manifest'],needsNetwork:false,needsAuth:false},
  async doctor(){
   if(!fs.existsSync(script)||!fs.existsSync(python))return{ok:false,status:'blocked',reason:'Isolated PyMuPDF worker is not installed. Run npm run deps:pymupdf or set AI4SLIDES_PYMUPDF_PYTHON.',warnings:[]};
   try{const info=JSON.parse(runCommand(['-c','import json,pymupdf,sys; print(json.dumps({"python":sys.version.split()[0],"version":pymupdf.__version__}))']));if(info.version!=='2.1')throw new Error(`Expected PyMuPDF 2.1, found ${info.version}.`);return{ok:true,status:'available',version:info.version,python:info.python,warnings:['PyMuPDF and MuPDF licensing requires an approved AGPL or commercial path before distribution.','Extraction does not verify claims or grant image reuse rights; OCR is not run.']};}
   catch(error){return{ok:false,status:'blocked',reason:`PyMuPDF worker unavailable: ${error.message}`,warnings:[]};}
  },
  async probeCapabilities(){return{formats:['source-markdown','source-manifest','page-locators','embedded-images','vector-coordinates','png-preview'],pageLocators:true,selectableText:true,embeddedRasterExtraction:true,vectorDrawingCoordinates:true,ocr:false,network:false,sourceSha256:true,verification:'unverified'};},
  async smokeTest(){
   const doctor=await this.doctor();if(!doctor.ok)return{ok:false,reason:doctor.reason};
   const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-pymupdf-smoke-'));
   try{const fixture=path.join(root,'examples','research-workflow','fixtures','synthetic-paper.pdf');const result=await this.run({inputDir:path.dirname(fixture),outputDir:path.join(dir,'out'),taskFile:path.join(root,'examples','open-source-bakeoff','pymupdf-task.json')});const pages=JSON.parse(fs.readFileSync(path.join(dir,'out','pages.json'),'utf8'));const md=fs.readFileSync(path.join(dir,'out','synthetic-paper.md'),'utf8');if(!md.includes('SYNTHETIC FIXTURE PAPER')||pages.pages.length!==1)throw new Error('Synthetic PDF extraction fixture did not produce expected selectable text and page locator.');return{ok:true,version:doctor.version,pages:pages.pages.length,source_id:result.evidence.id,verification_status:result.evidence.verified?'verified':'unverified',ocr:'not-run',artifacts:result.artifacts.map(item=>path.basename(item.path)),network:'local-only'};}
   finally{fs.rmSync(dir,{recursive:true,force:true});}
  },
  async run({inputDir,outputDir,taskFile,timeoutMs=120000}={}){
   if(!inputDir||!outputDir||!taskFile)throw new TypeError('PyMuPDF run() requires inputDir, outputDir, and taskFile.');
   if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw new Error('timeoutMs must be an integer from 1000 to 300000.');
   const task=boundedJson(taskFile);if(typeof task.input!=='string'||!task.input||typeof task.evidenceId!=='string'||!/^E_[A-Z0-9][A-Z0-9_-]{1,50}$/.test(task.evidenceId))throw new Error('Task JSON requires a relative input PDF and valid E_UPPERCASE evidenceId.');
   const inputCandidate=path.resolve(inputDir,task.input),input=inside(inputDir,inputCandidate);if(path.extname(input).toLowerCase()!=='.pdf')throw new Error('Input extension must be .pdf.');
   const previews=task.previewPages??[];if(!Array.isArray(previews)||previews.length>20||previews.some(page=>!Number.isInteger(page)||page<0)||new Set(previews).size!==previews.length)throw new Error('previewPages must contain at most 20 unique nonnegative zero-based page indexes.');
   const doctor=await this.doctor();if(!doctor.ok)throw new Error(doctor.reason);
   const out=path.resolve(outputDir),sourceHash=sha256(fs.readFileSync(input));if(out===input||out.startsWith(`${input}${path.sep}`))throw new Error('Output directory cannot overwrite or contain the source PDF.');
   if(fs.existsSync(out)&&(!fs.statSync(out).isDirectory()||fs.readdirSync(out).length))throw new Error('PyMuPDF output must be absent or an empty directory; refusing to overwrite.');
   fs.mkdirSync(out,{recursive:true});
   let raw;try{raw=JSON.parse(runCommand([script,input,out,JSON.stringify(previews)],{timeout:timeoutMs}));}catch(error){throw new Error(`PyMuPDF extraction failed: ${error.message}`);}
   if(raw.tool?.id!=='pymupdf'||raw.tool.version!=='2.1'||raw.input?.sha256!==sourceHash||!Number.isInteger(raw.page_count)||raw.page_count<1||!Array.isArray(raw.artifacts))throw new Error('PyMuPDF manifest failed tool version, input hash, page count, or artifact validation.');
   for(const item of raw.artifacts){if(typeof item.path!=='string'||path.basename(item.path)!==item.path)throw new Error(`Unsafe artifact path in worker manifest: ${item.path}`);const file=path.join(out,item.path),bytes=fs.readFileSync(file);if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)throw new Error(`PyMuPDF artifact failed manifest hash: ${item.path}`);}
   const pageDoc=JSON.parse(fs.readFileSync(path.join(out,'pages.json'),'utf8'));if(pageDoc.pages.length!==raw.page_count)throw new Error('Page count mismatch between PyMuPDF manifest and pages.json.');
   const sourceBytes=fs.readFileSync(input),blocks=pageDoc.pages.map(page=>({locator:page.locator,content:page.text}));
   const bundle=buildSourceBundle({bytes:sourceBytes,filename:path.basename(input),format:'pdf',blocks,id:task.evidenceId,label:task.label||null,extractionMethod:`PyMuPDF ${doctor.version}, selectable text and page-level image/vector metadata; OCR not run`});
   const evidencePath=path.join(out,`${path.basename(input,path.extname(input))}.evidence.json`),sourcePath=path.join(out,`${path.basename(input,path.extname(input))}.source.json`),markdownPath=path.join(out,`${path.basename(input,path.extname(input))}.md`);
   fs.writeFileSync(markdownPath,bundle.markdown);fs.writeFileSync(sourcePath,JSON.stringify(bundle.manifest,null,2)+'\n');fs.writeFileSync(evidencePath,JSON.stringify({entries:[bundle.entry]},null,2)+'\n');
   raw.source_ids=[task.evidenceId];raw.verification_status='unverified';raw.input.path=path.basename(input);raw.artifacts.push(...[[markdownPath,'text/markdown'],[sourcePath,'application/json'],[evidencePath,'application/json']].map(([file,media_type])=>{const bytes=fs.readFileSync(file);return{path:path.basename(file),media_type,bytes:bytes.length,sha256:sha256(bytes)};}));
   raw.warnings.push('Evidence entry is unverified. Extracted images retain source provenance but their reuse rights remain unknown.');
   const runManifest=path.join(out,'pymupdf-manifest.json');fs.writeFileSync(runManifest,JSON.stringify(raw,null,2)+'\n');
   return{ok:true,manifest:raw,evidence:bundle.entry,artifacts:raw.artifacts.map(item=>({path:path.join(out,item.path),sha256:item.sha256,bytes:item.bytes,media_type:item.media_type})).concat([{path:runManifest,sha256:sha256(fs.readFileSync(runManifest)),bytes:fs.statSync(runManifest).size,media_type:'application/json'}]),warnings:raw.warnings};
  }
 });
}

export const pymupdfAdapter=createPyMuPDFAdapter();
