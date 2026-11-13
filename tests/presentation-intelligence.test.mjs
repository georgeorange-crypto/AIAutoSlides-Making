import test from 'node:test';
import assert from 'node:assert/strict';
import {planPresentationIntelligence} from '../packages/workflow/intelligence.mjs';

const deck=audience=>({meta:{title:'Synthetic system study',audience_profile:audience,duration_seconds:300},slides:[
 {slide_id:'S01',type:'cover',title:'System study',evidence_ids:[],elements:[]},
 {slide_id:'S02',type:'statement',title:'The method enables comparison',evidence_ids:['E1'],elements:[{element_id:'M1',kind:'process'}]},
 {slide_id:'S03',type:'statement',title:'Observed latency differs',evidence_ids:['E2'],elements:[{element_id:'C1',kind:'chart',source_ids:['E2']}]},
 {slide_id:'S04',type:'closing',title:'Next action',evidence_ids:['E2'],elements:[]}
]});

test('audience profiles create different deterministic narrative roles from the same IR',()=>{
 const research=planPresentationIntelligence(deck('research_group'));
 const conference=planPresentationIntelligence(deck('academic_conference'));
 const investment=planPresentationIntelligence(deck('investment_committee'));
 assert.notEqual(research.slides[1].narrative_role,conference.slides[1].narrative_role);
 assert.notEqual(conference.slides[1].narrative_role,investment.slides[1].narrative_role);
 assert.equal(research.slides[0].narrative_role,'research_question');
 assert.equal(investment.slides[3].narrative_role,'decision_request');
});

test('content plan preserves evidence, explains media selection, and allocates target time',()=>{
 const plan=planPresentationIntelligence(deck('research_group'));
 assert.equal(plan.total_allocated_seconds,300);
 assert.ok(plan.slides.every(slide=>slide.time_budget_seconds>0));
 assert.deepEqual(plan.slides[2].evidence_refs,['E2']);
 assert.equal(plan.slides[2].selected_media_type,'data_chart');
 assert.match(plan.slides[2].selection_reason,/numeric series/);
 assert.equal(plan.slides[0].takeaway,'System study');
 assert.ok(plan.limitations.some(item=>item.includes('does not assess factual accuracy')));
});

test('authored role and timing are preserved; missing duration stays explicitly unknown',()=>{
 const input=deck('research_group');input.meta.duration_seconds=undefined;input.slides[1].role='authored_role';input.slides[1].time_budget_seconds=42;
 const plan=planPresentationIntelligence(input);
 assert.equal(plan.slides[1].narrative_role,'authored_role');
 assert.equal(plan.slides[1].time_budget_seconds,42);
 assert.equal(plan.slides[1].time_budget_origin,'authored');
 assert.equal(plan.total_allocated_seconds,null);
});

test('approved priority levels steer estimated talk time toward core material',()=>{
 const input=deck('research_group');
 const qualityPlan={task:{target_duration_seconds:300},slides:input.slides.map((slide,index)=>({slide_id:slide.slide_id,importance:index===1?'supporting':index===2?'core':'standard'}))};
 const report=planPresentationIntelligence(input,{qualityPlan});
 const method=report.slides.find(slide=>slide.slide_id==='S02'),result=report.slides.find(slide=>slide.slide_id==='S03');
 assert.equal(method.importance,'supporting');assert.equal(result.importance,'core');
 assert.ok(result.time_budget_seconds>method.time_budget_seconds);
 assert.equal(report.total_allocated_seconds,300);
});

test('media plan carries declared asset rights without approving them',()=>{
 const input=deck('academic_conference');input.assets=[{asset_id:'A1',source_id:'SRC1',media_type:'image/png',license:'CC BY 4.0',rights_status:'pending'}];input.slides[1].elements=[{element_id:'I1',kind:'image',asset_id:'A1'}];
 const image=planPresentationIntelligence(input).slides[1].media_candidates[0];
 assert.equal(image.asset_id,'A1');assert.equal(image.license,'CC BY 4.0');assert.equal(image.rights_status,'pending');
});

test('local profile language, tone and density preferences reach the plan with explicit IR overrides',()=>{
 const input=deck('research_group');input.meta.profile_preferences={language:'zh-CN',tone:'precise',slide_density:'low'};
 let plan=planPresentationIntelligence(input);
 assert.deepEqual(plan.authoring_preferences,{language:'zh-CN',tone:'precise',slide_density:'low'});
 input.meta.tone='conversational';input.meta.slide_density='high';
 plan=planPresentationIntelligence(input);
 assert.deepEqual(plan.authoring_preferences,{language:'zh-CN',tone:'conversational',slide_density:'high'});
 assert.ok(plan.limitations.some(item=>item.includes('does not translate or rewrite slide content')));
});
