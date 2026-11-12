import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('local PDF + synthetic CSV workflow builds source-linked editable PPTX and QA manifest',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-research-e2e-'));
 try{
  const r=spawnSync(process.execPath,[path.join(root,'scripts/run-research-workflow.mjs'),'--skip-preview','--out-dir',tmp],{cwd:root,encoding:'utf8',timeout:180000});
  assert.equal(r.status,0,r.stdout+r.stderr);
  const qa=JSON.parse(fs.readFileSync(path.join(tmp,'research-workflow.qa.json'),'utf8'));
  assert.equal(qa.slideCount,10);assert.equal(qa.editableTextSlideCount,10);assert.equal(qa.nativeChartCount,1);assert.ok(qa.nativeShapeCount>0);assert.notEqual(qa.status,'fail');
  const evidence=JSON.parse(fs.readFileSync(path.join(tmp,'evidence.json'),'utf8'));
  assert.deepEqual(evidence.entries.map(e=>e.id),['E_PAPER','E_SYN1','E_ARCH']);assert.ok(evidence.entries.every(e=>e.verified===false));
  const lineage=JSON.parse(fs.readFileSync(path.join(tmp,'research-workflow.evidence-manifest.json'),'utf8'));
  assert.ok(lineage.slides.some(s=>s.evidence_ids.includes('E_PAPER')));assert.ok(lineage.slides.some(s=>s.evidence_ids.includes('E_SYN1')));assert.ok(lineage.diagrams?.length||lineage.slides.some(s=>s.evidence_ids.includes('E_ARCH')));
  const manifest=JSON.parse(fs.readFileSync(path.join(tmp,'run-manifest.json'),'utf8'));
  assert.equal(manifest.schema_version,'1.0.0');assert.equal(manifest.workflow,'research');assert.equal(manifest.policy.network,'local-only');assert.equal(manifest.policy.paid_api_calls,0);assert.equal(manifest.policy.synthetic_data,true);assert.ok(manifest.inputs.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));assert.ok(manifest.outputs.some(x=>x.path.endsWith('.pptx')&&x.editable==='native'));
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('local CSV requires opt-in when unlabeled and always remains unverified',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-local-csv-'));
 try{
  const input=path.join(tmp,'results.csv'),output=path.join(tmp,'storyboard.json');fs.writeFileSync(input,'condition,value,unit,sample_n\nControl,1.2,ms,5\nTreatment,1.3,ms,5\n');
  const blocked=spawnSync(process.execPath,[path.join(root,'src/import-csv.mjs'),input,output,'bar'],{cwd:root,encoding:'utf8'});assert.equal(blocked.status,1);assert.match(blocked.stderr,/must explicitly label itself SYNTHETIC/);
  const accepted=spawnSync(process.execPath,[path.join(root,'src/import-csv.mjs'),input,output,'bar','--allow-unverified-local'],{cwd:root,encoding:'utf8'});assert.equal(accepted.status,0,accepted.stderr);
  const deck=JSON.parse(fs.readFileSync(output,'utf8')),evidence=JSON.parse(fs.readFileSync(output.replace(/\.json$/,'-evidence.json'),'utf8'));
  assert.equal(deck.meta.data_status,'unverified-local');assert.equal(evidence.entries[0].id,'E_CSV1');assert.equal(evidence.entries[0].verified,false);assert.match(evidence.entries[0].note,/not been independently verified/);assert.match(deck.meta.status,/VERIFICATION PENDING/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
