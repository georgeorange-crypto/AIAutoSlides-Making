import test from 'node:test';
import assert from 'node:assert/strict';
import {approveDeckPlan,approveRepresentativeSlides,assertApprovedDeckPlan,validateDeckPlan,validatePageReviews,PAGE_QUALITY_CHECKS} from '../packages/workflow/deck-gate.mjs';

const slide=(slide_id,assertion,narrative_role,extra={})=>({slide_id,assertion,evidence_ids:[],visual_type:narrative_role==='agenda'?'section list':narrative_role==='section_transition'?'section title':'paper figure',visual_source:'original',tool_id:'pptxgenjs-ir',rights_status:'original',narrative_role,importance:narrative_role==='result'?'core':'supporting',priority_ids:narrative_role==='result'?['result']:[],explanation_goal:'Orient or explain the finding',visual_rationale:'Support the planned narrative',layout_intent:narrative_role,...extra});
const plan=()=>({schema_version:'1.2.0',task:{scope:'Create a research talk with a visible outline and one named section',expected_slide_count:5,target_duration_seconds:420},quality_contract:{audience:'Research peers',purpose:'Explain a finding',language:'Chinese',style_reference:'Clean editorial research deck',content_priorities:['result'],priority_depth:[{priority_id:'result',depth_level:'standard',minimum_core_slides:3}],narrative_sections:['Finding'],avoid_patterns:['assistant-facing copy','tiny caveats'],visual_slide_ratio_min:0.5,minimum_explanation_units:28,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5},materials:[{path:'brief.md',sha256:'a'.repeat(64),read_status:'read'}],tools:[{id:'pptxgenjs-ir',status:'e2e-tested',evidence:'run-123'}],slides:[slide('S01','Agenda','agenda'),slide('S02','Finding','section_transition',{section_name:'Finding'}),...['S03','S04','S05'].map((id,index)=>slide(id,`Evidence supports the finding, step ${index+1}`,'result',{section_name:'Finding',evidence_ids:['E1']}))],representative_slides:['S02'],acceptance:{reviewer:'Human reviewer',gates:['science','visual','structure']}});

test('deck plan requires complete materials, capability evidence, page map and acceptance gates',()=>{
 const value=plan();assert.equal(validateDeckPlan(value).status,'pass');value.slides.pop();assert.equal(validateDeckPlan(value).status,'fail');
 const ungrounded=plan();ungrounded.slides[2].evidence_ids=[];assert.match(validateDeckPlan(ungrounded).errors.join(' '),/must cite at least one source\/evidence ID/);
});

test('deck plan maps every declared focus topic to enough distinct core/high pages for its depth',()=>{
 const emptyCore=plan();emptyCore.slides[2].priority_ids=[];
 assert.match(validateDeckPlan(emptyCore).errors.join('\n'),/core\/high but maps to no declared content priority/);
 const focusMissing=plan();focusMissing.quality_contract.content_priorities.push('Mechanism');
 assert.match(validateDeckPlan(focusMissing).errors.join('\n'),/content priority "Mechanism" must map to at least one core\/high slide/);
 const wrongBand=plan();wrongBand.slides[2].importance='supporting';
 wrongBand.slides[3].importance='supporting';wrongBand.slides[4].importance='supporting';
 assert.match(validateDeckPlan(wrongBand).errors.join('\n'),/content priority "result" must map to at least one core\/high slide/);
 const duplicate=plan();duplicate.slides[2].priority_ids=['result','result'];
 assert.match(validateDeckPlan(duplicate).errors.join('\n'),/priority_ids must not contain duplicate labels/);
 const deep=plan();deep.quality_contract.priority_depth[0]={priority_id:'result',depth_level:'deep',minimum_core_slides:7};
 assert.match(validateDeckPlan(deep).errors.join('\n'),/has 3 core\/high pages; its deep depth requires 7/);
 const deepEnough=plan();deepEnough.task.expected_slide_count=9;for(let index=0;index<4;index++)deepEnough.slides.push(slide(`S0${index+6}`,`Additional result step ${index+4}`,'result',{section_name:'Finding',evidence_ids:['E1']}));deepEnough.quality_contract.priority_depth[0]={priority_id:'result',depth_level:'deep',minimum_core_slides:7};
 const stages=['question','mechanism','evidence','comparison','result','implication','synthesis'];deepEnough.slides.filter(item=>item.narrative_role==='result').forEach((item,index)=>{item.explanation_stage=stages[index];});assert.equal(validateDeckPlan(deepEnough).status,'pass');
 for(const item of deepEnough.slides.filter(item=>item.narrative_role==='result'))item.explanation_stage='mechanism';assert.match(validateDeckPlan(deepEnough).errors.join('\n'),/must cover at least 4 different explanation stages/);
 const invalidDepth=plan();invalidDepth.quality_contract.priority_depth[0].minimum_core_slides=1;
 assert.match(validateDeckPlan(invalidDepth).errors.join('\n'),/at least 2 distinct core\/high slides/);
 const malformed=plan();malformed.quality_contract.priority_depth=[null];
 assert.equal(validateDeckPlan(malformed).status,'fail');
});

test('approval binds every rendered headline and evidence mapping to the approved page map',()=>{
 const approved=approveDeckPlan(plan(),{reviewer:'Reviewer',note:'Plan checked'});assert.throws(()=>assertApprovedDeckPlan(approved,{source_ir:{sources:[{source_id:'E1'}],evidence:[]},slides:[{slide_id:'S01',title:'Agenda'},{slide_id:'S03',assertion_title:'Evidence supports the finding, step 1',evidence_ids:['E1']}]}),/page count does not match/);
 assert.equal(assertApprovedDeckPlan(approved,{slides:[{slide_id:'S02',title:'Finding'}]}),true);
 const pilot={...approved,representative_review:{artifact_sha256:'b'.repeat(64)}};assert.equal(assertApprovedDeckPlan(pilot,{slides:[{slide_id:'S02',title:'Finding'}]}),true);
 const representativeApproved=approveRepresentativeSlides(approved,{reviewer:'Reviewer',note:'Pilot checked',artifact_sha256:'b'.repeat(64)}),fullIR={source_ir:{sources:[{source_id:'E1'}],evidence:[]},slides:[{slide_id:'S01',title:'Agenda'},{slide_id:'S02',title:'Finding'},{slide_id:'S03',assertion_title:'Evidence supports the finding, step 1',evidence_ids:['E1']},{slide_id:'S04',assertion_title:'Evidence supports the finding, step 2',evidence_ids:['E1']},{slide_id:'S05',assertion_title:'Evidence supports the finding, step 3',evidence_ids:['E1']}]};assert.equal(assertApprovedDeckPlan(representativeApproved,fullIR),true);
 const changedHeadline=structuredClone(fullIR);changedHeadline.slides[2].assertion_title='A different claim was generated';assert.throws(()=>assertApprovedDeckPlan(representativeApproved,changedHeadline),/Approved assertion for slide S03/);
 const missingHeadline=structuredClone(fullIR);delete missingHeadline.slides[2].assertion_title;assert.throws(()=>assertApprovedDeckPlan(representativeApproved,missingHeadline),/Approved assertion for slide S03/);
 const whitespaceOnly=structuredClone(fullIR);whitespaceOnly.slides[2].assertion_title=' Evidence   supports the finding, step 1 ';assert.equal(assertApprovedDeckPlan(representativeApproved,whitespaceOnly),true);
 const missingEvidence=structuredClone(fullIR);missingEvidence.slides[2].evidence_ids=[];assert.throws(()=>assertApprovedDeckPlan(representativeApproved,missingEvidence),/not carried into Presentation IR/);
 const unknownEvidence=structuredClone(fullIR);unknownEvidence.source_ir.sources=[];assert.throws(()=>assertApprovedDeckPlan(representativeApproved,unknownEvidence),/unknown source\/evidence IDs/);
 approved.slides[0].assertion='changed';assert.throws(()=>assertApprovedDeckPlan(approved,{slides:[{slide_id:'S01'},{slide_id:'S02'},{slide_id:'S03'},{slide_id:'S04'},{slide_id:'S05'}]}),/not approved/);
});

test('visual approval requires one passing and rechecked record for every page',()=>{
 const checked=Object.fromEntries(PAGE_QUALITY_CHECKS.map(key=>[key,{status:'pass',note:`${key}: inspected at full presentation size; the rendered page shows a distinct observation for this quality dimension`} ]));
 const good=['S01','S02'].map(slide_id=>({slide_id,status:'pass',findings:'none',rechecked:true,quality_checks:structuredClone(checked)}));assert.equal(validatePageReviews(good,['S01','S02']).status,'pass');
 assert.equal(validatePageReviews(good.slice(0,1),['S01','S02']).status,'fail');good[1].rechecked=false;assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
 good[1].rechecked=true;good[1].findings='title overlaps chart label';assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
 good[1].findings='resolved: title resized and page re-rendered';assert.equal(validatePageReviews(good,['S01','S02']).status,'pass');
 good[1].rechecked=true;delete good[1].quality_checks.visual_support;assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
 good[1].quality_checks.visual_support={status:'not_applicable',note:'N/A'};assert.equal(validatePageReviews(good,['S01','S02']).status,'fail');
 good[1].quality_checks.visual_support={status:'not_applicable',note:'N/A: this text-only section transition has no diagram or image; navigation copy was reviewed on the rendered page'};assert.equal(validatePageReviews(good,['S01','S02']).status,'pass');

 const boilerplate=structuredClone(good);for(const check of PAGE_QUALITY_CHECKS)boilerplate[0].quality_checks[check]={status:'pass',note:'Looks good'};
 const boilerplateReport=validatePageReviews(boilerplate,['S01','S02']);assert.equal(boilerplateReport.status,'fail');assert.ok(boilerplateReport.errors.some(error=>error.includes('informative text units')));assert.ok(boilerplateReport.errors.some(error=>error.includes('repeats the')));
 const copied=structuredClone(good);copied[0].quality_checks.typography.note=copied[0].quality_checks.content_density.note;
 assert.ok(validatePageReviews(copied,['S01','S02']).errors.some(error=>error.includes('each quality dimension needs its own page-specific observation')));
});

test('plan requires a real audience, narrative priorities, declared topic depth and per-slide explanation intent',()=>{
 const value=plan();delete value.quality_contract.content_priorities;assert.equal(validateDeckPlan(value).status,'fail');
 const missingDepth=plan();delete missingDepth.quality_contract.priority_depth;assert.match(validateDeckPlan(missingDepth).errors.join(' '),/missing priority_depth/);
 const value2=plan();delete value2.slides[1].explanation_goal;assert.equal(validateDeckPlan(value2).status,'fail');
});

test('plan requires one agenda, a transition for every section, and assigned section content',()=>{
 const missingAgenda=plan();missingAgenda.slides[0].narrative_role='opening';assert.match(validateDeckPlan(missingAgenda).errors.join('\n'),/exactly one agenda/);
 const missingTransition=plan();missingTransition.slides[1].section_name='Other';assert.match(validateDeckPlan(missingTransition).errors.join('\n'),/Finding.*section-transition/);
 const missingContent=plan();for(const item of missingContent.slides.filter(item=>item.narrative_role==='result'))item.section_name='Other';assert.match(validateDeckPlan(missingContent).errors.join('\n'),/Finding.*content slide/);
 const lateAgenda=plan();lateAgenda.slides.reverse();assert.match(validateDeckPlan(lateAgenda).errors.join('\n'),/agenda must follow/);
 const missingAssignment=plan();missingAssignment.slides.push(slide('S06','Unassigned detail','result'));missingAssignment.task.expected_slide_count=6;assert.match(validateDeckPlan(missingAssignment).errors.join('\n'),/content must have section_name/);
 const coverBeforeAgenda=plan();coverBeforeAgenda.slides.unshift(slide('S00','Title','cover'));coverBeforeAgenda.task.expected_slide_count=6;assert.equal(validateDeckPlan(coverBeforeAgenda).status,'pass');
 const repeatedOpening=plan();repeatedOpening.slides.push(slide('S06','More opening','opening',{section_name:'Finding'}));repeatedOpening.task.expected_slide_count=6;assert.match(validateDeckPlan(repeatedOpening).errors.join('\n'),/at most one cover\/opening/);
 const lateOpening=plan();lateOpening.slides.splice(2,0,slide('S06','Late opening','opening',{section_name:'Finding'}));lateOpening.task.expected_slide_count=6;assert.match(validateDeckPlan(lateOpening).errors.join('\n'),/first page/);
 const extraEnding=plan();extraEnding.slides.splice(2,0,slide('S06','Premature close','closing'));extraEnding.task.expected_slide_count=6;assert.match(validateDeckPlan(extraEnding).errors.join('\n'),/closing\/conclusion\/summary.*last/);
 const unknownDivider=plan();unknownDivider.slides.push(slide('S06','Appendix divider','section_transition',{section_name:'Appendix'}));unknownDivider.task.expected_slide_count=6;assert.match(validateDeckPlan(unknownDivider).errors.join('\n'),/exactly one section-transition page/);
 const transitionAfterContent=plan();[transitionAfterContent.slides[1],transitionAfterContent.slides[2]]=[transitionAfterContent.slides[2],transitionAfterContent.slides[1]];assert.match(validateDeckPlan(transitionAfterContent).errors.join('\n'),/must precede its content/);
 const duplicateSections=plan();duplicateSections.quality_contract.narrative_sections.push('Finding');assert.match(validateDeckPlan(duplicateSections).errors.join('\n'),/narrative_sections must be unique/);
});

test('plan requires a talk duration and bounded priority page/time shares',()=>{
 const legacy=plan();legacy.schema_version='1.1.0';assert.match(validateDeckPlan(legacy).errors.join(' '),/schema_version must be 1\.2\.0/);
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
