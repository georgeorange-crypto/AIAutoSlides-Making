import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync,strFromU8} from 'fflate';
import {assertValidPresentationIR} from '../packages/core/validate-presentation.mjs';
import {mapPresentationIRToLegacy,pptxgenjsIRAdapter} from '../packages/adapters/pptxgenjs-ir.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'examples/phase1/pptxgenjs-assets-diagram.json'),'utf8'));

test('PptxGenJS IR maps a licensed local asset, native structured diagram, and process steps',()=>{
 const result=mapPresentationIRToLegacy(fixture);
 assert.equal(result.deck.slides[0].type,'architecture');
 assert.equal(result.deck.slides[0].diagram.nodes.length,3);
 assert.equal(result.deck.slides[0].visuals[0].asset_id,'A_TOPOLOGY');
 assert.deepEqual(result.deck.slides[1].steps,['Read input','Validate evidence','Render deck']);
 assertValidPresentationIR(fixture);
});

test('IR render embeds the local SVG and preserves native diagram/process editability and lineage',async()=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-ir-visuals-'));
 try{
  fs.mkdirSync(path.join(workspace,'assets'),{recursive:true});
  fs.copyFileSync(path.join(root,'examples/phase1/assets/synthetic-topology.svg'),path.join(workspace,'assets/synthetic-topology.svg'));
  const result=await pptxgenjsIRAdapter.render({presentationIR:fixture,workspace,outputDir:workspace,inputPath:'pptxgenjs-assets-diagram.json'});
  assert.equal(result.status,'completed');assert.equal(result.slideCount,2);assert.equal(result.qa.status,'warning');
  const pptx=result.artifacts.find(item=>item.path.endsWith('.pptx'));
  const qa=JSON.parse(fs.readFileSync(result.artifacts.find(item=>item.path.endsWith('.qa.json')).path,'utf8'));
  const taggedGroups=qa.slides.flatMap(slide=>slide.visualGroupBounds);
  assert.ok(taggedGroups.some(group=>group.kind==='diagram'&&group.area_ratio>=0.03&&group.bounds_area_ratio>=0.06),JSON.stringify(taggedGroups));assert.ok(taggedGroups.some(group=>group.kind==='process'&&group.area_ratio>=0.08&&group.bounds_area_ratio>=0.06),JSON.stringify(taggedGroups));
  const files=unzipSync(new Uint8Array(fs.readFileSync(pptx.path)));
  const media=Object.keys(files).filter(name=>/^ppt\/media\/.*\.svg$/i.test(name));assert.equal(media.length,1);
  const architecture=strFromU8(files['ppt/slides/slide1.xml']);
  assert.match(architecture,/Client/);assert.match(architecture,/API gateway/);assert.match(architecture,/<p:pic>/);
  assert.ok((architecture.match(/<a:prstGeom prst="line"/g)||[]).length>=2);
  const process=strFromU8(files['ppt/slides/slide2.xml']);assert.match(process,/Read input/);assert.match(process,/Validate evidence/);assert.match(process,/Render deck/);
  const notes=strFromU8(files['ppt/notesSlides/notesSlide2.xml']);assert.match(notes,/Keep source IDs and verification state/);
  const lineage=JSON.parse(fs.readFileSync(result.artifacts.find(item=>item.path.endsWith('.lineage.json')).path,'utf8'));
  assert.deepEqual(lineage.slides[0].elements.map(item=>item.kind),['diagram','image']);
  assert.equal(lineage.sources[0].verification_status,'unverified');
 }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('diagram and process IR reject invalid edges, bounds, and step counts before rendering',()=>{
 const badEdge=structuredClone(fixture);badEdge.slides[0].elements[0].edges[0].to='missing';
 assert.throws(()=>assertValidPresentationIR(badEdge),/must connect two distinct known nodes/);
 const badBounds=structuredClone(fixture);badBounds.slides[0].elements[0].nodes[0].x=13;
 assert.throws(()=>assertValidPresentationIR(badBounds),/in-bounds geometry/);
 const badSteps=structuredClone(fixture);badSteps.slides[1].elements[0].steps=['Only one'];
 assert.throws(()=>assertValidPresentationIR(badSteps),/process requires 2–6 labeled steps/);
});

test('IR image embedding rejects restricted rights and a local hash mismatch',async()=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-ir-asset-negative-'));
 try{
  fs.mkdirSync(path.join(workspace,'assets'),{recursive:true});
  fs.copyFileSync(path.join(root,'examples/phase1/assets/synthetic-topology.svg'),path.join(workspace,'assets/synthetic-topology.svg'));
  const restricted=structuredClone(fixture);restricted.assets[0].rights_status='restricted';
  await assert.rejects(pptxgenjsIRAdapter.render({presentationIR:restricted,workspace,outputDir:workspace}),/is restricted/);
  const mismatched=structuredClone(fixture);mismatched.assets[0].sha256='0'.repeat(64);
  await assert.rejects(pptxgenjsIRAdapter.render({presentationIR:mismatched,workspace,outputDir:workspace}),/SHA-256 does not match/);
 }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
