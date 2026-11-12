import test from 'node:test';
import assert from 'node:assert/strict';
import {recordVisualDecision} from '../src/visual-review-state.mjs';

const base={schema_version:1,pptx_sha256:'abc',allowed_slide_ids:['S01','S02'],slides:[]};
test('visual decisions stay pending until every rendered slide is reviewed',()=>{
 const first=recordVisualDecision(base,{pptx_sha256:'abc',slide_id:'S01',decision:'approve',reviewer:'Reviewer',note:'Checked layout',reviewed_at:'2026-01-01T00:00:00Z'});assert.equal(first.status,'in_progress');
 const final=recordVisualDecision(first,{pptx_sha256:'abc',slide_id:'S02',decision:'approve',reviewer:'Reviewer',note:'Checked chart',reviewed_at:'2026-01-01T00:01:00Z'});assert.equal(final.status,'approved');assert.equal(final.slides.length,2);
});
test('stale, missing-note, unknown-slide, and rejected visual decisions fail closed',()=>{
 assert.throws(()=>recordVisualDecision(base,{pptx_sha256:'other',slide_id:'S01',decision:'approve',reviewer:'A',note:'ok'}),/different PPTX hash/);
 assert.throws(()=>recordVisualDecision(base,{pptx_sha256:'abc',slide_id:'S09',decision:'approve',reviewer:'A',note:'ok'}),/Unknown slide/);
 assert.throws(()=>recordVisualDecision(base,{pptx_sha256:'abc',slide_id:'S01',decision:'approve',reviewer:'A',note:''}),/review note/);
 const first=recordVisualDecision(base,{pptx_sha256:'abc',slide_id:'S01',decision:'approve',reviewer:'A',note:'Checked'});
 const final=recordVisualDecision(first,{pptx_sha256:'abc',slide_id:'S02',decision:'changes_requested',reviewer:'A',note:'Text overlap'});assert.equal(final.status,'changes_requested');
});
