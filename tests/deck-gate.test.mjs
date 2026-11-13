import test from 'node:test';
import assert from 'node:assert/strict';
import {approveDeckPlan,approveRepresentativeSlides,assertApprovedDeckPlan,validateDeckPlan,validatePageReviews,PAGE_QUALITY_CHECKS} from '../packages/workflow/deck-gate.mjs';

const slide=(slide_id,assertion,narrative_role,extra={})=>({slide_id,assertion,evidence_ids:[],visual_type:narrative_role==='agenda'?'section list':narrative_role==='section_transition'?'section title':'paper figure',visual_source:'original',tool_id:'pptxgenjs-ir',rights_status:'original',narrative_role,importance:narrative_role==='result'?'core':'supporting',explanation_goal:'Orient or explain the finding',visual_rationale:'Support the planned narrative',layout_intent:narrative_role,...extra});
const plan=()=>({schema_version:'1.1.0',task:{scope:'Create a research talk with a visible outline and one named section',expected_slide_count:3,target_duration_seconds:420},quality_contract:{audience:'Research peers',purpose:'Explain a finding',language:'Chinese',style_reference:'Clean editorial research deck',content_priorities:['method','result'],narrative_sections:['Finding'],avoid_patterns:['assistant-facing copy','tiny caveats'],visual_slide_ratio_min:0.5,minimum_explanation_units:28,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5},materials:[{path:'brief.md',sha256:'a'.repeat(64),read_status:'read'}],tools:[{id:'pptxgenjs-ir',status:'e2e-tested',evidence:'run-123'}],slides:[slide('S01','Agenda','agenda'),slide('S02','Finding','section_transition',{section_name:'Finding'}),slide('S03','Evidence supports the finding','result',{section_name:'Finding',evidence_ids:['E1']})],representative_slides:['S02'],acceptance:{reviewer:'Human reviewer',gates:['science','visual','structure']}});

test('deck plan requires complete materials, capability evidence, page map and acceptance gates',()=>{
 const value=plan();assert.equal(validateDeckPlan(value).status,'pass');value.slides.pop();assert.equal(validateDeckPlan(value).status,'fail');
});

test('approval is bound to the exact plan and the Presentation IR page map',()=>{
 const approved=approveDeckPlan(plan(),{reviewer:'Reviewer',note:'Plan checked'});assert.throws(()=>assertApprovedDeckPlan(approved,{slides:[{slide_id:'S01'},{slide_id:'S02'}]}),/page count does not match/);
 assert.equal(assertApprovedDeckPlan(approved,{slides:[{slide_id:'S02'}]}),true);
 const pilot={...approved,representative_review:{artifact_sha256:'b'.repeat(64)}};assert.equal(assertApprovedDeckPlan(pilot,{slides:[{slide_id:'S02'}]}),true);
 const representativeApproved=approveRepresentativeSlides(approved,{reviewer:'Reviewer',note:'Pilot checked',artifact_sha256:'b'.repeat(64)});assert.equal(assertApprovedDeckPlan(representativeApproved,{slides:[{slide_id:'S01'},{slide_id:'S02'},{slide_id:'S03'}]}),true);
 approved.slides[0].assertion='changed';assert.throws(()=>assertApprovedDeckPlan(approved,{slides:[{slide_id:'S01'},{slide_id:'S02'},{slide_id:'S03'}]}),/not approved/);
});

test('visual approval requires one passing and rechecked record for every page',()=>{
 const checked=Object.fromEntries(PAGE_QUALITY_CHECKS.map(key=>[key,{status:'pass',note:`Checked ${key} at presentation size`} ]));
 const good=['S01','S02'].map(slide_id=>({slide_id,status:'pass',findings:'none',rechecked:true,quality_checks:structuredClone(checked)}));assert.equal(validatePageReviews(good,['S01','S02']).status,'pass');
 assert.equal(validatePageReviews(good.slice(0,1),['S01','S02']).status,'fail');good[1].rechecked=false;assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
 good[1].rechecked=true;good[1].findings='title overlaps chart label';assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
 good[1].findings='resolved: title resized and page re-rendered';assert.equal(validatePageReviews(good,['S01','S02']).status,'pass');
 good[1].rechecked=true;delete good[1].quality_checks.visual_support;assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
 good[1].quality_checks.visual_support={status:'not_applicable',note:'N/A'};assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
 good[1].quality_checks.visual_support={status:'not_applicable',note:'N/A: this is a text-only transition page'};assert.equal(validatePageReviews(good,['S01','S02']).status,'pass');
});

test('plan requires a real audience, narrative priorities and per-slide explanation intent',()=>{
 const value=plan();delete value.quality_contract.content_priorities;assert.equal(validateDeckPlan(value).status,'fail');
 const value2=plan();delete value2.slides[1].explanation_goal;assert.equal(validateDeckPlan(value2).status,'fail');
});

test('plan requires one agenda, a transition for every section, and assigned section content',()=>{
 const missingAgenda=plan();missingAgenda.slides[0].narrative_role='opening';assert.match(validateDeckPlan(missingAgenda).errors.join('\n'),/exactly one agenda/);
 const missingTransition=plan();missingTransition.slides[1].section_name='Other';assert.match(validateDeckPlan(missingTransition).errors.join('\n'),/Finding.*section-transition/);
 const missingContent=plan();missingContent.slides[2].section_name='Other';assert.match(validateDeckPlan(missingContent).errors.join('\n'),/Finding.*content slide/);
 const lateAgenda=plan();lateAgenda.slides.reverse();assert.match(validateDeckPlan(lateAgenda).errors.join('\n'),/agenda must follow/);
 const missingAssignment=plan();missingAssignment.slides.push(slide('S04','Unassigned detail','result'));missingAssignment.task.expected_slide_count=4;assert.match(validateDeckPlan(missingAssignment).errors.join('\n'),/content must have section_name/);
 const coverBeforeAgenda=plan();coverBeforeAgenda.slides.unshift(slide('S00','Title','cover'));coverBeforeAgenda.task.expected_slide_count=4;assert.equal(validateDeckPlan(coverBeforeAgenda).status,'pass');
 const transitionAfterContent=plan();[transitionAfterContent.slides[1],transitionAfterContent.slides[2]]=[transitionAfterContent.slides[2],transitionAfterContent.slides[1]];assert.match(validateDeckPlan(transitionAfterContent).errors.join('\n'),/must precede its content/);
 const duplicateSections=plan();duplicateSections.quality_contract.narrative_sections.push('Finding');assert.match(validateDeckPlan(duplicateSections).errors.join('\n'),/narrative_sections must be unique/);
});

test('plan requires a talk duration and bounded priority page/time shares',()=>{
 const legacy=plan();legacy.schema_version='1.0.0';assert.match(validateDeckPlan(legacy).errors.join(' '),/schema_version must be 1\.1\.0/);
 const missingDuration=plan();delete missingDuration.task.target_duration_seconds;assert.match(validateDeckPlan(missingDuration).errors.join(' '),/target_duration_seconds/);
 const weakPageShare=plan();weakPageShare.quality_contract.minimum_priority_slide_share=0.2;assert.match(validateDeckPlan(weakPageShare).errors.join(' '),/minimum_priority_slide_share/);
 const weakTimeShare=plan();weakTimeShare.quality_contract.minimum_priority_time_share=0.4;assert.match(validateDeckPlan(weakTimeShare).errors.join(' '),/minimum_priority_time_share/);
 const unknownImportance=plan();unknownImportance.slides[2].importance='kind of important';assert.match(validateDeckPlan(unknownImportance).errors.join(' '),/importance must be one of/);
});

test('formal plan cannot lower visual coverage below half of content pages',()=>{
 const value=plan();value.quality_contract.visual_slide_ratio_min=0.49;
 assert.match(validateDeckPlan(value).errors.join('\n'),/visual_slide_ratio_min must be between 0\.50 and 1/);
 value.quality_contract.visual_slide_ratio_min=0.5;
 assert.equal(validateDeckPlan(value).status,'pass');
});
