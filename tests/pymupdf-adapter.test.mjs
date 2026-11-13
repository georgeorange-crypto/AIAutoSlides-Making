import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pymupdfAdapter,createPyMuPDFAdapter} from '../packages/adapters/pymupdf.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=path.join(root,'examples','research-workflow','fixtures','synthetic-paper.pdf');
const taskFile=path.join(root,'examples','open-source-bakeoff','pymupdf-task.json');

test('PyMuPDF adapter rejects unsafe paths, unsupported inputs and invalid task contracts before worker execution',async()=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'pymupdf-contract-')),outside=fs.mkdtempSync(path.join(os.tmpdir(),'pymupdf-outside-'));
 try{
  const pdf=path.join(base,'paper.pdf'),task=path.join(base,'task.json');fs.copyFileSync(fixture,pdf);fs.copyFileSync(fixture,path.join(outside,'paper.pdf'));
  let calls=0;const adapter=createPyMuPDFAdapter({runCommand:()=>{calls++;return JSON.stringify({python:'3.12.0',version:'2.1'});}});
  const taskValue={input:'paper.pdf',evidenceId:'E_VALID_SOURCE'};fs.writeFileSync(task,JSON.stringify(taskValue));
  fs.writeFileSync(task,JSON.stringify({...taskValue,input:path.relative(base,path.join(outside,'paper.pdf'))}));
  await assert.rejects(adapter.run({inputDir:base,outputDir:path.join(base,'out'),taskFile:task}),/inside inputDir/);
  fs.copyFileSync(fixture,path.join(base,'paper.exe'));fs.writeFileSync(task,JSON.stringify({...taskValue,input:'paper.exe'}));await assert.rejects(adapter.run({inputDir:base,outputDir:path.join(base,'out'),taskFile:task}),/extension must be \.pdf/);
  fs.writeFileSync(task,JSON.stringify({...taskValue,evidenceId:'evidence-1'}));await assert.rejects(adapter.run({inputDir:base,outputDir:path.join(base,'out'),taskFile:task}),/valid E_UPPERCASE/);
  fs.writeFileSync(task,JSON.stringify({...taskValue,previewPages:[-1]}));await assert.rejects(adapter.run({inputDir:base,outputDir:path.join(base,'out'),taskFile:task}),/previewPages/);
  assert.equal(calls,0,'invalid tasks must be rejected before invoking Python');
 }finally{fs.rmSync(base,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}
});

test('installed PyMuPDF extracts local synthetic PDF text, page provenance and selected preview offline',async()=>{
 const doctor=await pymupdfAdapter.doctor();if(!doctor.ok){assert.match(doctor.reason,/npm run deps:pymupdf/);return;}
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'pymupdf-e2e-'));
 try{
  const result=await pymupdfAdapter.run({inputDir:path.dirname(fixture),outputDir:path.join(out,'result'),taskFile});
  const pages=JSON.parse(fs.readFileSync(path.join(out,'result','pages.json'),'utf8'));
  const evidence=JSON.parse(fs.readFileSync(path.join(out,'result','synthetic-paper.evidence.json'),'utf8')).entries[0];
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'result','pymupdf-manifest.json'),'utf8'));
  assert.match(fs.readFileSync(path.join(out,'result','synthetic-paper.md'),'utf8'),/SYNTHETIC FIXTURE PAPER/);
  assert.equal(pages.pages[0].locator,'page:1');assert.equal(manifest.tool.version,'2.1');
  assert.equal(manifest.source_ids[0],'E_PYMUPDF_SYNTHETIC');assert.equal(manifest.verification_status,'unverified');
  assert.equal(evidence.verified,false);assert.equal(manifest.ocr,'not-run');
  assert.ok(result.artifacts.some(item=>path.basename(item.path)==='page-0001.png'));
  assert.equal(fs.existsSync(path.join(out,'result','page-0001.png')),true);
  assert.ok(manifest.artifacts.every(item=>fs.existsSync(path.join(out,'result',item.path))));
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});

test('PyMuPDF preserves image bounding boxes/assets and vector drawing coordinates',async()=>{
 const doctor=await pymupdfAdapter.doctor();if(!doctor.ok)return;
 const python=process.env.AI4SLIDES_PYMUPDF_PYTHON||path.join(root,'workers','pymupdf','.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pymupdf-image-vector-')),pdf=path.join(dir,'figure.pdf'),task=path.join(dir,'task.json');
 try{
  const code='import pymupdf,sys; d=pymupdf.open(); p=d.new_page(width=300,height=200); p.insert_text((20,30),"SYNTHETIC IMAGE AND VECTOR FIXTURE"); p.draw_rect(pymupdf.Rect(20,50,140,120),color=(1,0,0),fill=(1,0.8,0.8)); pix=pymupdf.Pixmap(pymupdf.csRGB,pymupdf.IRect(0,0,4,4),0); pix.clear_with(0x00ff00); p.insert_image(pymupdf.Rect(160,50,240,130),pixmap=pix); d.save(sys.argv[1]); d.close()';
  const created=spawnSync(python,['-c',code,pdf],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(created.status,0,created.stderr||created.stdout);
  fs.writeFileSync(task,JSON.stringify({input:'figure.pdf',evidenceId:'E_PYMUPDF_IMAGE_VECTOR',previewPages:[]}));
  const result=await pymupdfAdapter.run({inputDir:dir,outputDir:path.join(dir,'out'),taskFile:task});
  const pages=JSON.parse(fs.readFileSync(path.join(dir,'out','pages.json'),'utf8')).pages;
  assert.ok(pages[0].vector_drawing_count>0);assert.ok(pages[0].vector_drawings.some(item=>item.bbox_points?.length===4));
  assert.ok(pages[0].images.some(item=>item.asset_path));const image=pages[0].images.find(item=>item.asset_path).asset_path;
  assert.ok(result.artifacts.some(item=>path.basename(item.path)===image));assert.ok(fs.statSync(path.join(dir,'out',image)).size>0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
