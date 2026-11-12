import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {summarize} from '../src/benchmark-statistics.mjs';
import {startRepairSession,stopRepairSession} from '../src/repair-timer.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('timing summary reports median and nearest-rank p90 without hiding sample count',()=>{
 assert.deepEqual(summarize([5,1,4,2,3]),{n:5,min_ms:1,median_ms:3,p90_ms:5,max_ms:5,mean_ms:3});
 assert.throws(()=>summarize([]),/non-empty/);assert.throws(()=>summarize([1,NaN]),/finite/);
});
test('synthetic update benchmark accepts repeated samples and writes per-sample timing summaries',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-benchmark-')),prefix=path.join(dir,'repeat');
 try{const r=spawnSync(process.execPath,[path.join(root,'src/benchmark-update.mjs'),'--samples','2','--out-prefix',prefix],{cwd:root,encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+r.stderr);const result=JSON.parse(fs.readFileSync(`${prefix}.benchmark.json`,'utf8'));assert.equal(result.timing.sample_count,2);assert.equal(result.timing.samples.length,2);assert.equal(result.timing.first_run_summary.n,2);assert.ok(result.timing.update_summary.median_ms>0);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('manual repair timer records elapsed time, edit count and only deck hashes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-repair-')),deck=path.join(dir,'sample.pptx'),session=path.join(dir,'session.json');fs.writeFileSync(deck,'before');
 try{startRepairSession({sessionPath:session,deckPath:deck,label:'fixture edit',now:new Date('2026-11-12T10:00:00Z')});fs.writeFileSync(deck,'after');const result=stopRepairSession({sessionPath:session,deckPath:deck,edits:2,now:new Date('2026-11-12T10:02:30Z')});assert.equal(result.elapsed_seconds,150);assert.equal(result.elapsed_minutes,2.5);assert.equal(result.repair_count,2);assert.equal(result.deck_changed,true);const text=fs.readFileSync(session,'utf8');assert.doesNotMatch(text,/before deck content|after deck content/);assert.match(text,/deck_sha256_before/);assert.throws(()=>stopRepairSession({sessionPath:session,edits:0}),/already been stopped/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
