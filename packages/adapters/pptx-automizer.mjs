import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {strFromU8,unzipSync} from 'fflate';
import pptxgen from 'pptxgenjs';
import {defineToolAdapter} from './protocol.mjs';

const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const worker=path.join(root,'workers','pptx-automizer');
const require=createRequire(path.join(worker,'package.json'));
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function run(command,args,{timeout=300000,cwd=root,acceptedStatuses=[0]}={}){const result=spawnSync(command,args,{cwd,encoding:'utf8',timeout,maxBuffer:4*1024*1024,windowsHide:true});if(result.error||!acceptedStatuses.includes(result.status))throw new Error(result.error?.message||result.stderr||result.stdout||`${command} exited with ${result.status}`);return result.stdout.trim();}
function installedVersion(){try{return JSON.parse(fs.readFileSync(require.resolve('pptx-automizer/package.json'),'utf8')).version;}catch{return null;}}

export const pptxAutomizerAdapter=defineToolAdapter({
 manifest:{id:'pptx-automizer',version:'0.9.4',status:'adapter-ready',kind:'editor',invoke:'isolated local Node worker',inputs:['pptx','slide-number','exact-shape-name','replacement-text'],outputs:['pptx','edit-manifest'],needsNetwork:false,needsAuth:false},
 async doctor(){const version=installedVersion();return version?{ok:version==='0.9.4',status:version==='0.9.4'?'available':'blocked',version,executable:worker,reason:version==='0.9.4'?undefined:`Pinned pptx-automizer 0.9.4; found ${version}. Run npm run deps:pptx-automizer.`,warnings:[]}:{ok:false,status:'blocked',reason:'Optional pptx-automizer worker is not installed. Run npm run deps:pptx-automizer.',warnings:[]};},
 async probeCapabilities(){return{formats:['pptx'],importsExistingDecks:true,modifyExistingTextShape:true,nativeChartsPreserved:'fixture-verified',nativeChartModification:false,sourceImmutable:true,network:false,localOnly:true,requiresRenderReview:true};},
 async run({inputFile,outputFile,slideNumber,elementName,text,timeoutMs=300000}={}){
  if(!inputFile||!outputFile||!Number.isInteger(slideNumber)||!elementName||typeof text!=='string')throw new Error('run() requires inputFile, outputFile, slideNumber, elementName, and text.');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw new Error('timeoutMs must be an integer from 1000 to 300000.');
  const input=path.resolve(inputFile),output=path.resolve(outputFile);if(path.extname(output).toLowerCase()!=='.pptx')throw new Error('outputFile must end in .pptx.');if(input===output)throw new Error('outputFile must differ from inputFile.');
  const manifestPath=`${output}.automizer.json`;if(fs.existsSync(output)||fs.existsSync(manifestPath))throw new Error('Output PPTX or edit manifest already exists; refusing to overwrite.');
  const version=installedVersion();if(version!=='0.9.4')throw new Error('Run npm run deps:pptx-automizer to install the pinned local worker.');
  fs.mkdirSync(path.dirname(output),{recursive:true});const requestDir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-automizer-')),requestPath=path.join(requestDir,'request.json');
  try{fs.writeFileSync(requestPath,JSON.stringify({schema_version:'1.0.0',inputFile:input,outputFile:output,slide_number:slideNumber,element_name:elementName,replacement_text:text}),{flag:'wx'});run(process.execPath,[path.join(worker,'worker.mjs'),requestPath],{timeout:timeoutMs});if(!fs.existsSync(output)||!fs.existsSync(manifestPath))throw new Error('Worker returned without both PPTX and edit manifest.');const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));if(manifest.input.sha256!==sha256(fs.readFileSync(input))||manifest.output.sha256!==sha256(fs.readFileSync(output)))throw new Error('Worker manifest hashes do not match the input/output files.');return{artifacts:[output,manifestPath],manifest,warnings:manifest.warnings};}
  catch(error){fs.rmSync(output,{force:true});fs.rmSync(manifestPath,{force:true});throw error;}
  finally{fs.rmSync(requestDir,{recursive:true,force:true});}
 },
 async smokeTest(){const doctor=await this.doctor();if(!doctor.ok)return{ok:false,reason:doctor.reason};const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-automizer-smoke-')),input=path.join(dir,'source.pptx'),output=path.join(dir,'edited.pptx');
  try{const deck=new pptxgen();deck.layout='LAYOUT_WIDE';for(const title of ['Untouched first slide','Editable target text','Untouched last slide']){const slide=deck.addSlide();slide.addText(title,{x:1,y:1,w:9,h:1,fontFace:'Arial',fontSize:24});}deck.addSlide().addChart(deck.ChartType.bar,[{name:'Synthetic series',labels:['A','B'],values:[1,2]}],{x:1,y:1,w:7,h:4});await deck.writeFile({fileName:input});
   const result=await this.run({inputFile:input,outputFile:output,slideNumber:2,elementName:'Text 0',text:'Changed title from local worker'});const sourceHash=sha256(fs.readFileSync(input));if(result.manifest.input.sha256!==sourceHash||result.manifest.summary.slide_count!==4||result.manifest.summary.native_chart_count!==1)throw new Error('PPTX preservation smoke checks failed.');
   const parts=unzipSync(new Uint8Array(fs.readFileSync(output))),slideParts=Object.keys(parts).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));const texts=slideParts.map(name=>strFromU8(parts[name]));if(slideParts.length!==4||texts[1]?.includes('Changed title from local worker')!==true||Object.keys(parts).filter(name=>/^ppt\/charts\/chart\d+\.xml$/.test(name)).length!==1)throw new Error('Output OOXML QA did not find the exact replacement text, all slides, and the native chart.');
   return{ok:true,version:doctor.version,slides:result.manifest.summary.slide_count,native_charts:result.manifest.summary.native_chart_count,source_unchanged:result.manifest.input.sha256===sourceHash,output:result.manifest.output.sha256,network:'local-only'};
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 }
});
