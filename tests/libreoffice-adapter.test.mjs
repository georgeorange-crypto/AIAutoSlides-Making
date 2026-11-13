import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {libreOfficeAdapter} from '../packages/adapters/libreoffice.mjs';

test('LibreOffice adapter rejects unsupported format and existing outputs',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'libreoffice-contract-')),input=path.join(dir,'bad.pdf');fs.writeFileSync(input,'%PDF-');
 try{await assert.rejects(libreOfficeAdapter.run({inputFile:input,outputDir:path.join(dir,'out')}),/only \.pptx/);await assert.rejects(libreOfficeAdapter.run({inputFile:input.replace(/bad\.pdf$/,'missing.pptx'),outputDir:path.join(dir,'out')}));}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('installed LibreOffice renders a real two-slide PPTX to bounded PDF and page PNGs',async t=>{
 const doctor=await libreOfficeAdapter.doctor();if(!doctor.ok){t.skip(doctor.reason);return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'libreoffice-e2e-'));
 try{const result=await libreOfficeAdapter.smokeTest();assert.equal(result.ok,true);assert.equal(result.pages,2);assert.equal(result.png_pages,2);const output=path.join(dir,'render');await fs.rmSync(output,{recursive:true,force:true});
  const PptxGenJS=(await import('pptxgenjs')).default,deck=new PptxGenJS();deck.layout='LAYOUT_WIDE';deck.addSlide().addText('source slide one',{x:1,y:1,w:6,h:1,fontSize:24});deck.addSlide().addText('source slide two',{x:1,y:1,w:6,h:1,fontSize:24});const input=path.join(dir,'source.pptx');await deck.writeFile({fileName:input});
  const rendered=await libreOfficeAdapter.run({inputFile:input,outputDir:output});assert.equal(rendered.manifest.renderer,'libreoffice');assert.equal(rendered.manifest.outputs.page_count,2);assert.ok(rendered.artifacts.some(file=>file.media_type==='application/pdf'));assert.equal(rendered.artifacts.filter(file=>file.media_type==='image/png').length,2);assert.ok(rendered.artifacts.every(file=>fs.statSync(file.path).size===file.bytes));await assert.rejects(libreOfficeAdapter.run({inputFile:input,outputDir:output}),/must not already exist/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
