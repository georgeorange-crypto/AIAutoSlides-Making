import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

test('run refresh records first and second generation timings, source diff, and rebuilt QA',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-refresh-')),csv=path.join(dir,'runs.csv'),pptx=path.join(dir,'deck.pptx'),report=`${pptx}.refresh.json`;
 try{
  fs.copyFileSync('examples/from-csv/synthetic-repeated-runs.csv',csv);
  const first=spawnSync(process.execPath,['src/refresh-runs.mjs',csv,pptx],{encoding:'utf8'});assert.equal(first.status,0,first.stderr);const a=JSON.parse(fs.readFileSync(report,'utf8'));assert.equal(a.status,'first-run');assert.ok(a.production_ms>0);assert.equal(a.first_run_ms,a.production_ms);assert.equal(a.second_run_ms,null);const firstPptxHash=a.build.pptx_sha256;
  fs.writeFileSync(csv,fs.readFileSync(csv,'utf8').replace('obs-b01,Baseline,latency,52,ms','obs-b01,Baseline,latency,53,ms'));
  const second=spawnSync(process.execPath,['src/refresh-runs.mjs',csv,pptx,report,'2.5'],{encoding:'utf8'});assert.equal(second.status,0,second.stderr);const b=JSON.parse(fs.readFileSync(report,'utf8'));assert.equal(b.status,'updated');assert.equal(b.diff.changed.length,1);assert.equal(b.diff.added.length,0);assert.equal(b.diff.removed.length,0);assert.equal(b.first_run_ms,a.first_run_ms);assert.ok(b.second_run_ms>0);assert.equal(b.manual_repair_minutes,2.5);assert.match(b.manual_repair_status,/operator-supplied/);assert.equal(b.build.performed,true);assert.notEqual(b.build.pptx_sha256,firstPptxHash);
  const qa=JSON.parse(fs.readFileSync(path.join(dir,'deck.qa.json'),'utf8'));assert.deepEqual(qa.errors,[]);assert.equal(qa.errorBarsMatch,true);
  const third=spawnSync(process.execPath,['src/refresh-runs.mjs',csv,pptx,report],{encoding:'utf8'});assert.equal(third.status,0,third.stderr);const c=JSON.parse(fs.readFileSync(report,'utf8'));assert.equal(c.status,'unchanged');assert.equal(c.build.performed,false);assert.equal(c.build.pptx_sha256,b.build.pptx_sha256);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
