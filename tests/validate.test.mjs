import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateDeck,loadEvidence,normalizeDeck} from '../src/validate.mjs';
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
