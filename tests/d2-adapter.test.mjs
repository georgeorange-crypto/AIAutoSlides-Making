import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {d2Adapter} from '../packages/adapters/d2.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=path.join(root,'examples','open-source-bakeoff','d2-synthetic.json');
const ledger=path.join(root,'examples','open-source-bakeoff','synthetic-evidence.json');

test('D2 rejects missing evidence, imports, external references and unknown contract fields',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d2-contract-')),input=path.join(dir,'spec.json'),base=JSON.parse(fs.readFileSync(fixture,'utf8'));
 try{
  for(const change of [{source_ids:['E_UNKNOWN']},{dsl:'... private.d2'},{dsl:'A: icon: local.svg'},{extra:'not allowed'}]){
   fs.writeFileSync(input,JSON.stringify({...base,...change}));
   await assert.rejects(d2Adapter.run({inputFile:input,evidenceFile:ledger,outputDir:path.join(dir,'out')}));
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('installed D2 renders source-linked synthetic SVG and PNG with hashes',async t=>{
 const doctor=await d2Adapter.doctor();if(!doctor.ok){t.skip(doctor.reason);return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d2-e2e-'));
 try{
  const result=await d2Adapter.run({inputFile:fixture,evidenceFile:ledger,outputDir:path.join(dir,'out')}),manifest=JSON.parse(fs.readFileSync(path.join(dir,'out','d2-synthetic.diagram.json'),'utf8'));
  const svg=fs.readFileSync(path.join(dir,'out','d2-synthetic.svg'),'utf8'),png=fs.readFileSync(path.join(dir,'out','d2-synthetic.png'));
  assert.equal(manifest.tool.version,'0.9.0');assert.deepEqual(manifest.source_ids,['E_SYN_01']);assert.equal(manifest.verification_status,'unverified');assert.match(svg,/<svg\b/i);for(const label of ['API gateway','Request scheduler','Worker pool','request','dispatch'])assert.ok(svg.includes(label),`missing SVG label: ${label}`);assert.ok(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.ok(result.artifacts.every(file=>fs.statSync(file.path).size===file.bytes));
  await assert.rejects(d2Adapter.run({inputFile:fixture,evidenceFile:ledger,outputDir:path.join(dir,'out')}),/output must be absent or an empty directory/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
