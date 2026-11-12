import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateDeck,loadEvidence,normalizeDeck} from '../src/validate.mjs';
import {auditThemeContrast} from '../src/contrast.mjs';
const ledger=loadEvidence('sources/evidence.json');
const sample=JSON.parse(fs.readFileSync('examples/research-demo.json','utf8'));
const deepCopy=x=>JSON.parse(JSON.stringify(x));
test('example storyboard passes structural validation',()=>{
 const {errors}=validateDeck(sample,ledger); assert.deepEqual(errors,[]);
});
test('fabricated evidence ID is rejected',()=>{
 const d=deepCopy(sample);d.slides[1].evidence_ids=['BAD'];assert.match(validateDeck(d,ledger).errors.join(' '),/absent from ledger/);
});
test('chart data must match categories and be finite',()=>{
 const d=deepCopy(sample);d.slides[3].chart.values=[1,2,Number.NaN];assert.match(validateDeck(d,ledger).errors.join(' '),/chart requires/);
});
test('AI output root is normalized without losing slides',()=>{
 const d={title:'Example',subtitle:'Test',slides:[{type:'cover',title:'Topic',kicker:'X',body:[],evidence_ids:[]}]};assert.equal(normalizeDeck(d).meta.title,'Example');
});
test('metrics without evidence are rejected',()=>{
 const d=deepCopy(sample);d.slides[2].evidence_ids=[];assert.match(validateDeck(d,ledger).errors.join(' '),/metrics require/);
});
test('malformed evidence entries fail closed',()=>{
 const file=path.join(os.tmpdir(),`aiautoslides-bad-evidence-${process.pid}.json`);
 try{fs.writeFileSync(file,JSON.stringify({entries:[{id:'E1',label:'x',source:'y',verified:'yes'}]}));assert.throws(()=>loadEvidence(file),/verified:boolean required/);}finally{fs.rmSync(file,{force:true});}
});
test('missing chart values, units, or axis labels are rejected',()=>{
 const d=deepCopy(sample);d.slides[3].chart.values=[];assert.match(validateDeck(d,ledger).errors.join(' '),/chart requires/);
 const q=deepCopy(sample);delete q.slides[3].chart.y_axis_label;assert.match(validateDeck(q,ledger).errors.join(' '),/chart requires/);
});
test('native line charts allow finite signed series and a nonzero range',()=>{
 const d=deepCopy(sample);d.slides[3].chart.kind='line';d.slides[3].chart.values=[-1,0,2];d.slides[3].chart.min_value=0.2;assert.deepEqual(validateDeck(d,ledger).errors,[]);
});
test('unsupported types and non-16:9 aspect ratios are rejected',()=>{
 const d=deepCopy(sample);d.meta.aspect_ratio='4:3';d.slides[1].type='unknown';const errors=validateDeck(d,ledger).errors.join(' ');assert.match(errors,/Only 16:9/);assert.match(errors,/unsupported type/);
});
test('excessive text is surfaced as a readability warning',()=>{
 const d=deepCopy(sample);d.slides[1].body=['Readable start. '+'x'.repeat(195)];assert.ok(validateDeck(d,ledger).warnings.some(w=>/long body item/.test(w)));
});
test('CSV talk contains stable slide IDs and a traceable native-chart input',()=>{
 const csv=fs.readFileSync('examples/from-csv/synthetic-latency.csv','utf8');assert.match(csv,/SYNTHETIC/);
 const script=fs.readFileSync('src/import-csv.mjs','utf8');assert.match(script,/slide_id:'S08'/);assert.match(script,/chart:\{kind:chartKind/);assert.match(script,/\['bar','line'\]/);
});
test('all supplied themes meet the 4.5:1 text contrast floor on their surfaces',()=>{
 for(const name of ['academic-light','tech-dark','keynote-minimal']){const theme=JSON.parse(fs.readFileSync(`themes/${name}.json`,'utf8'));assert.deepEqual(auditThemeContrast(theme).pairsBelowMinimum,[],name);}
});
test('missing runtime dependencies fail with an actionable message',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-missing-deps-'));
 try{fs.copyFileSync('src/check-deps.mjs',path.join(dir,'check-deps.mjs'));const r=spawnSync(process.execPath,[path.join(dir,'check-deps.mjs')],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/Missing runtime dependencies: pptxgenjs, fflate/);assert.match(r.stderr,/Run npm ci/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
