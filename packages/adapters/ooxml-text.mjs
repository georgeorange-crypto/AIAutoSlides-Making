import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
import {defineToolAdapter} from './protocol.mjs';

const require=createRequire(import.meta.url),root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
function invoke(script,args){const r=spawnSync(process.execPath,[path.join(root,script),...args],{cwd:root,encoding:'utf8',timeout:120000,windowsHide:true});if(r.error||r.status!==0)throw new Error(r.error?.message||r.stderr||r.stdout||`exit ${r.status}`);return r.stdout.trim();}
export const ooxmlTextAdapter=defineToolAdapter({
 manifest:{id:'ooxml-text-replacer',version:'1.0.0',status:'e2e-tested',kind:'editor',invoke:'library+local-cli',inputs:['pptx','exact-text-edit-request'],outputs:['pptx','edit-report'],needsNetwork:false,needsAuth:false},
 async doctor(){try{const fflate=require.resolve('fflate');return{ok:true,status:'available',version:JSON.parse(fs.readFileSync(require.resolve('fflate/package.json'),'utf8')).version,path:fflate,warnings:[]};}catch{return{ok:false,status:'blocked',reason:'Install project dependencies with npm ci to enable the local OOXML text editor.',warnings:[]};}},
 async probeCapabilities(){return{exactSingleRunTextReplacement:true,preservesUntouchedSlideXml:true,chartsAndImagesSemanticallyEditable:false,visualComparisonRequiresRenderer:true};},
 async smokeTest(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-ooxml-edit-smoke-')),input=path.join(dir,'source.pptx'),request=path.join(dir,'request.json'),output=path.join(dir,'edited.pptx');
  try{invoke('scripts/create-existing-pptx-fixture.mjs',[input]);fs.writeFileSync(request,JSON.stringify({edits:[{slide:2,find:'Draft finding: replace this placeholder.',replace:'Smoke test replacement text.'}]}));invoke('src/edit-existing-pptx.mjs',['--input',input,'--request',request,'--out',output]);const parts=unzipSync(new Uint8Array(fs.readFileSync(output))),report=JSON.parse(fs.readFileSync(output.replace(/\.pptx$/i,'.edit-report.json'),'utf8'));if(!strFromU8(parts['ppt/slides/slide2.xml']).includes('Smoke test replacement text.')||!report.untouched_slides_identical_xml)throw new Error('Text edit or untouched-slide verification failed');return{ok:true,slides:report.slide_count,edited_slides:report.edited_slides,untouched_slides_identical_xml:report.untouched_slides_identical_xml,cleaned_up:true};}finally{fs.rmSync(dir,{recursive:true,force:true});}
 },
 async run({inputFile,requestFile,outputFile}){if(!inputFile||!requestFile||!outputFile)throw new Error('run() requires inputFile, requestFile, and outputFile.');const log=invoke('src/edit-existing-pptx.mjs',['--input',path.resolve(inputFile),'--request',path.resolve(requestFile),'--out',path.resolve(outputFile)]),reportFile=path.resolve(outputFile).replace(/\.pptx$/i,'.edit-report.json');return{artifacts:[path.resolve(outputFile),reportFile],report:JSON.parse(fs.readFileSync(reportFile,'utf8')),logs:[log],warnings:['Render and inspect edited pages; run workflow:existing-pptx for before/after visual comparison.']};}
});
