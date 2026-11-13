import test from 'node:test';
import assert from 'node:assert/strict';
import {approveDeckPlan,approveRepresentativeSlides,assertApprovedDeckPlan,validateDeckPlan,validatePageReviews} from '../packages/workflow/deck-gate.mjs';

const plan=()=>({schema_version:'1.0.0',task:{scope:'Create two research slides',expected_slide_count:2},materials:[{path:'brief.md',sha256:'a'.repeat(64),read_status:'read'}],tools:[{id:'pptxgenjs-ir',status:'e2e-tested',evidence:'run-123'}],slides:[{slide_id:'S01',assertion:'Opening context',evidence_ids:[],visual_type:'cover illustration',visual_source:'original',tool_id:'pptxgenjs-ir',rights_status:'original'},{slide_id:'S02',assertion:'Finding',evidence_ids:['E1'],visual_type:'paper figure',visual_source:'paper p.2 fig.1',tool_id:'pptxgenjs-ir',rights_status:'pending'}],representative_slides:['S02'],acceptance:{reviewer:'Human reviewer',gates:['science','visual','structure']}});

test('deck plan requires complete materials, capability evidence, page map and acceptance gates',()=>{
 const value=plan();assert.equal(validateDeckPlan(value).status,'pass');value.slides.pop();assert.equal(validateDeckPlan(value).status,'fail');
});

test('approval is bound to the exact plan and the Presentation IR page map',()=>{
 const approved=approveDeckPlan(plan(),{reviewer:'Reviewer',note:'Plan checked'});assert.throws(()=>assertApprovedDeckPlan(approved,{slides:[{slide_id:'S01'},{slide_id:'S02'}]}),/representative-slide review/);
 assert.equal(assertApprovedDeckPlan(approved,{slides:[{slide_id:'S02'}]}),true);
 const pilot={...approved,representative_review:{artifact_sha256:'b'.repeat(64)}};assert.equal(assertApprovedDeckPlan(pilot,{slides:[{slide_id:'S02'}]}),true);
 const representativeApproved=approveRepresentativeSlides(approved,{reviewer:'Reviewer',note:'Pilot checked',artifact_sha256:'b'.repeat(64)});assert.equal(assertApprovedDeckPlan(representativeApproved,{slides:[{slide_id:'S01'},{slide_id:'S02'}]}),true);
 approved.slides[0].assertion='changed';assert.throws(()=>assertApprovedDeckPlan(approved,{slides:[{slide_id:'S01'},{slide_id:'S02'}]}),/not approved/);
});

test('visual approval requires one passing and rechecked record for every page',()=>{
 const good=['S01','S02'].map(slide_id=>({slide_id,status:'pass',findings:'none',rechecked:true}));assert.equal(validatePageReviews(good,['S01','S02']).status,'pass');
 assert.equal(validatePageReviews(good.slice(0,1),['S01','S02']).status,'fail');good[1].rechecked=false;assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
});
