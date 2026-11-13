import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {graphvizAdapter} from '../packages/adapters/graphviz.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=path.join(root,'examples','open-source-bakeoff','graphviz-synthetic.json');
const ledger=path.join(root,'examples','open-source-bakeoff','synthetic-evidence.json');

test('Graphviz rejects unknown source IDs, invalid shapes and arbitrary input properties before CLI execution',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'graphviz-contract-'));
 try{
  const spec=JSON.parse(fs.readFileSync(fixture,'utf8')),input=path.join(dir,'spec.json');
  fs.writeFileSync(input,JSON.stringify({...spec,source_ids:['E_UNKNOWN']}));
  await assert.rejects(graphvizAdapter.run({inputFile:input,evidenceFile:ledger,outputDir:path.join(dir,'out')}),/Unknown or missing Graphviz source IDs/);
  fs.writeFileSync(input,JSON.stringify({...spec,nodes:[{...spec.nodes[0],shape:'image'}]}));
  await assert.rejects(graphvizAdapter.run({inputFile:input,evidenceFile:ledger,outputDir:path.join(dir,'out')}),/unsupported shape/);
  fs.writeFileSync(input,JSON.stringify({...spec,dot:'digraph { "../../private" }'}));
  await assert.rejects(graphvizAdapter.run({inputFile:input,evidenceFile:ledger,outputDir:path.join(dir,'out')}),/Unsupported Graphviz spec property/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('installed Graphviz renders the synthetic source-linked graph to SVG and PNG with hashes',async t=>{
 const doctor=await graphvizAdapter.doctor();if(!doctor.ok){t.skip(doctor.reason);return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'graphviz-e2e-'));
 try{
  const result=await graphvizAdapter.run({inputFile:fixture,evidenceFile:ledger,outputDir:path.join(dir,'out')});
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'out','graphviz-synthetic.diagram.json'),'utf8'));
  const svg=fs.readFileSync(path.join(dir,'out','graphviz-synthetic.svg'),'utf8'),png=fs.readFileSync(path.join(dir,'out','graphviz-synthetic.png'));
  assert.equal(manifest.tool.version,'16.1.1');assert.equal(manifest.node_count,3);assert.equal(manifest.edge_count,2);
  assert.deepEqual(manifest.source_ids,['E_SYN_01']);assert.equal(manifest.verification_status,'unverified');
  assert.match(svg,/<svg\b/);assert.match(svg,/Gateway/);assert.match(svg,/Worker/);
  assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  assert.ok(result.artifacts.every(item=>fs.statSync(item.path).size===item.bytes));
  await assert.rejects(graphvizAdapter.run({inputFile:fixture,evidenceFile:ledger,outputDir:path.join(dir,'out')}),/output must be absent or an empty directory/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
