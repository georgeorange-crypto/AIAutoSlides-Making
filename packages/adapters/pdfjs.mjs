import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {defineToolAdapter} from './protocol.mjs';
import {extractPdfPages,buildSourceBundle} from '../../src/document-extractors.mjs';

const require=createRequire(import.meta.url);
function packageInfo(name){let dir=path.dirname(require.resolve(name));while(dir!==path.dirname(dir)){const file=path.join(dir,'package.json');if(fs.existsSync(file)){const pkg=JSON.parse(fs.readFileSync(file,'utf8'));if(pkg.name===name)return pkg;}dir=path.dirname(dir);}throw new Error(`Cannot find ${name} package metadata`);}
function safeResolve(base,relative){const target=path.resolve(base,relative),rel=path.relative(path.resolve(base),target);if(!rel||rel==='.'||rel.startsWith(`..${path.sep}`)||path.isAbsolute(rel))throw new Error('PDF input must be a file inside inputDir');return target;}
export const pdfjsAdapter=defineToolAdapter({
 manifest:{id:'pdfjs-dist',version:'5.x',status:'adapter-ready',kind:'parser',invoke:'library',inputs:['pdf'],outputs:['source-markdown','source-manifest','evidence-entry'],needsNetwork:false,needsAuth:false},
 async doctor(){try{const pkg=packageInfo('pdfjs-dist');return{ok:true,status:'available',version:pkg.version,warnings:['Text extraction only; scanned pages are not OCRed.']};}catch{return{ok:false,status:'blocked',reason:'Run npm ci to install the local PDF.js dependency.',warnings:[]};}},
 async probeCapabilities(){return{selectablePdfText:true,pageLocators:true,sourceSha256:true,ocr:false,network:false};},
 async smokeTest(){const fixture=new URL('../../examples/research-workflow/fixtures/synthetic-paper.pdf',import.meta.url);if(!fs.existsSync(fixture))return{ok:false,reason:'Generate the checked-in synthetic PDF fixture first.'};const blocks=await extractPdfPages(fs.readFileSync(fixture));return{ok:blocks.length===1&&blocks[0].content.includes('SYNTHETIC FIXTURE PAPER'),pages:blocks.length,selectable_text:true,ocr:false};},
 async run({inputDir,outputDir,taskFile}){
  if(!inputDir||!outputDir||!taskFile)throw new TypeError('pdfjs adapter needs inputDir, outputDir, and taskFile');
  const task=JSON.parse(fs.readFileSync(taskFile,'utf8'));if(!task.input||!task.evidenceId)throw new Error('Task JSON requires input and evidenceId');
  const input=safeResolve(inputDir,task.input),bytes=fs.readFileSync(input),blocks=await extractPdfPages(bytes),bundle=buildSourceBundle({bytes,filename:path.relative(inputDir,input).replaceAll('\\','/'),format:'pdf',blocks,id:task.evidenceId,label:task.label||null,extractionMethod:'PDF.js (pdfjs-dist), selectable text only'});
  await mkdir(outputDir,{recursive:true});const stem=path.basename(input,path.extname(input)),markdown=path.join(outputDir,`${stem}.md`),manifest=path.join(outputDir,`${stem}.source.json`),evidence=path.join(outputDir,`${stem}.evidence.json`);
  await Promise.all([writeFile(markdown,bundle.markdown),writeFile(manifest,JSON.stringify(bundle.manifest,null,2)+'\n'),writeFile(evidence,JSON.stringify({entries:[bundle.entry]},null,2)+'\n')]);
  return{artifacts:[markdown,manifest,evidence],warnings:['Extracted text and source identity are not scientific verification.']};
 }
});
