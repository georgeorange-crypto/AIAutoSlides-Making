import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateDeck,loadEvidence,normalizeDeck} from '../src/validate.mjs';
import {auditThemeContrast} from '../src/contrast.mjs';
import {empiricalCdfStep} from '../src/statistics.mjs';
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
 const d=deepCopy(sample);d.slides[3].chart.values=[1,2,Number.NaN];assert.match(validateDeck(d,ledger).errors.join(' '),/valid axes/);
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
 const d=deepCopy(sample);d.slides[3].chart.values=[];assert.match(validateDeck(d,ledger).errors.join(' '),/valid axes/);
 const q=deepCopy(sample);delete q.slides[3].chart.y_axis_label;assert.match(validateDeck(q,ledger).errors.join(' '),/valid axes/);
});
test('native line charts allow finite signed series and a nonzero range',()=>{
 const d=deepCopy(sample);d.slides[3].chart.kind='line';d.slides[3].chart.values=[-1,0,2];d.slides[3].chart.min_value=0.2;assert.deepEqual(validateDeck(d,ledger).errors,[]);
});
test('multi-series charts require aligned finite values for every named series',()=>{
 const d=deepCopy(sample);d.slides[3].chart.series=[{name:'Raw',values:[1,2,3]},{name:'Compressed',values:[2,3,4]}];delete d.slides[3].chart.values;assert.deepEqual(validateDeck(d,ledger).errors,[]);d.slides[3].chart.series[1].values.pop();assert.match(validateDeck(d,ledger).errors.join(' '),/valid axes, 1–6 finite series/);
});
test('scatter charts preserve paired signed x/y observations and explicit units',()=>{
 const d=deepCopy(sample);d.slides[3].chart={kind:'scatter',unit:'ms',x_unit:'GB',x_axis_label:'Model size (GB)',y_axis_label:'Latency (ms)',x_values:[-1,0,2],values:[3,1,4]};assert.deepEqual(validateDeck(d,ledger).errors,[]);delete d.slides[3].chart.x_unit;assert.match(validateDeck(d,ledger).errors.join(' '),/valid axes/);
});
test('CDF validation requires sorted x and bounded nondecreasing cumulative probabilities',()=>{
 const d=deepCopy(sample),raw=[1,2,3],step=empiricalCdfStep(raw);d.slides[3].chart={kind:'cdf',unit:'ms',x_unit:'ms',x_axis_label:'Latency (ms)',y_axis_label:'Cumulative probability',raw_values:raw,...step,sample_size:3};assert.deepEqual(validateDeck(d,ledger).errors,[]);d.slides[3].chart.values[1]=0.8;assert.match(validateDeck(d,ledger).errors.join(' '),/CDF/);
});
test('CDF CSV import sorts observations and computes rank divided by raw n',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-cdf-')),out=path.join(dir,'deck.json');
 try{const r=spawnSync(process.execPath,['src/import-csv.mjs','examples/from-csv/synthetic-cdf.csv',out,'cdf'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const c=JSON.parse(fs.readFileSync(out,'utf8')).slides[3].chart;assert.equal(c.raw_values.length,12);assert.deepEqual(c.x_values.slice(0,6),[2.8,2.8,3.1,3.1,3.4,3.4]);assert.deepEqual(c.values.slice(0,6),[0,1/12,1/12,3/12,3/12,4/12]);assert.equal(c.sample_size,12);assert.equal(c.values.at(-1),1);assert.ok(c.values.every((v,i)=>i===0||v>=c.values[i-1]));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unsupported types and non-16:9 aspect ratios are rejected',()=>{
 const d=deepCopy(sample);d.meta.aspect_ratio='4:3';d.slides[1].type='unknown';const errors=validateDeck(d,ledger).errors.join(' ');assert.match(errors,/Only 16:9/);assert.match(errors,/unsupported type/);
});
test('visual asset placements are bounded by the 16:9 slide canvas',()=>{const d=deepCopy(sample);d.slides[1].visuals=[{asset_id:'A1',x:12.8,y:2,w:1,h:1}];assert.match(validateDeck(d,ledger).errors.join(' '),/within 16:9 slide bounds/);d.slides[1].visuals[0]={asset_id:'A1',x:8,y:2,w:4,h:3};assert.deepEqual(validateDeck(d,ledger).errors,[]);});
test('excessive text is surfaced as a readability warning',()=>{
 const d=deepCopy(sample);d.slides[1].body=['Readable start. '+'x'.repeat(195)];assert.ok(validateDeck(d,ledger).warnings.some(w=>/long body item/.test(w)));
});
test('CSV talk contains stable slide IDs and a traceable native-chart input',()=>{
 const csv=fs.readFileSync('examples/from-csv/synthetic-latency.csv','utf8');assert.match(csv,/SYNTHETIC/);
 const script=fs.readFileSync('src/import-csv.mjs','utf8');assert.match(script,/slide_id:'S08'/);assert.match(script,/\['bar','line','scatter','cdf'\]/);assert.match(script,/chart=\{kind:'cdf'/);
});
test('all supplied themes meet the 4.5:1 text contrast floor on their surfaces',()=>{
 for(const name of ['academic-light','tech-dark','keynote-minimal']){const theme=JSON.parse(fs.readFileSync(`themes/${name}.json`,'utf8'));assert.deepEqual(auditThemeContrast(theme).pairsBelowMinimum,[],name);}
});
test('missing runtime dependencies fail with an actionable message',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-missing-deps-'));
 try{fs.copyFileSync('src/check-deps.mjs',path.join(dir,'check-deps.mjs'));const r=spawnSync(process.execPath,[path.join(dir,'check-deps.mjs')],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/Missing runtime dependencies: pptxgenjs, fflate/);assert.match(r.stderr,/Run npm ci/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
