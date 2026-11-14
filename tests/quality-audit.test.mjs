import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDeckQuality} from '../packages/workflow/quality-audit.mjs';

const longText='这一页解释研究方法如何影响测量结果，并结合原始证据说明关键机制、适用范围、比较关系及其对结论的具体影响。读者可以据此理解数据从哪里来、为什么这样分析，以及结果支持到什么程度。';
const distinctPageCopy=[
 '这一页沿着测量流程追踪样本如何进入分析、指标如何计算，以及每一步留下哪些可复核记录。把处理顺序写清楚，才能区分采集误差、转换误差与最终读数之间的关系。',
 '这一页比较两个观察指标各自回答的问题，并说明它们在什么条件下会同向变化、何时会给出不同信号。读者应先确认指标定义，再判断差异来自对象变化还是测量口径。',
 '这一页拆解实验分组和对照条件如何影响可观察差异，指出比较成立所需的前提。若组间起点或资源状态不一致，结果变化就不能直接归因于单一处理因素。',
 '这一页定位误差沿数据链路的传播位置，从输入噪声、聚合过程到最终估计逐层说明。每个环节都要对应可检查的记录，避免把误差来源混成一个无法诊断的总量。',
 '这一页界定方法适用的样本、时间范围和运行条件，并指出超出这些条件后需要重新验证什么。适用边界决定结论可以迁移到哪些对象，不能由当前样例自动推出。'
];
const contract={content_priorities:['Results'],priority_depth:[{priority_id:'Results',depth_level:'standard',minimum_core_slides:2}],visual_slide_ratio_min:0.4,minimum_explanation_units:28,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5,language:'Chinese',narrative_sections:['Results']};
function fixture({count=5,visualEvery=2,body=longText,role='result'}={}){
  const agenda={slide_id:'AGENDA',type:'bullets',title:'Contents',elements:[{element_id:'A1',kind:'text',text:'Results'}]};
  const divider={slide_id:'DIV-RESULTS',type:'statement',title:'Results',role:'section_transition',section_name:'Results',section_topics:[],elements:[{element_id:'DIV-T01',kind:'text',text:'本节先解释关键机制及其作用，再说明这一机制如何连接到观察结果。'}]};
  const contentSlides=Array.from({length:count},(_,index)=>({slide_id:`S${index+1}`,type:'statement',title:`Claim ${index+1}`,role,evidence_ids:['E1'],elements:[{element_id:`T${index+1}`,kind:'text',text:body===longText?distinctPageCopy[index%distinctPageCopy.length]:body},...(index%visualEvery===0?[{element_id:`D${index+1}`,kind:'diagram',groups:[{label:'System'}],nodes:[{id:'a',label:'Input'},{id:'b',label:'Output'}],edges:[{from:'a',to:'b',label:'maps'}]}]:[])]}));
  const slides=[agenda,divider,...contentSlides];
  divider.section_topics=contentSlides.slice(0,3).map(slide=>({slide_id:slide.slide_id,title:slide.assertion_title||slide.title}));
  const plannedSlides=[{slide_id:'AGENDA',narrative_role:'agenda'}, {slide_id:'DIV-RESULTS',narrative_role:'section_transition',section_name:'Results'},...contentSlides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'opening_context':role,section_name:'Results',importance:index%2===0?'core':'supporting',priority_ids:index%2===0?['Results']:[],visual_type:index%visualEvery===0?'diagram':'text',layout_intent:index%visualEvery===0?'diagram':'text',evidence_ids:['E1']}))];
  const contentPlan={slides:plannedSlides.map(slide=>({slide_id:slide.slide_id,time_budget_seconds:slide.importance==='core'?60:slide.importance==='supporting'?20:5}))};
  const plan={quality_contract:{...contract},slides:plannedSlides};
  return{plan,presentationIR:{slides},contentPlan,renderedQa:{theme:{headFontFace:'Aptos Display',bodyFontFace:'Aptos'},slides:slides.map(slide=>({textBoundsPass:true,textOverlaps:[],smallText:[],fontFaces:['Aptos Display','Aptos'],unmeasuredFonts:[],visualGroupBounds:slide.elements.filter(element=>element.kind==='diagram').map(()=>({group_id:`${slide.slide_id}:diagram`,kind:'diagram',area_ratio:0.2,bounds_area_ratio:0.2,member_count:5,ok:true}))}))},imageReview:{status:'text_detected',pages:slides.map((slide,index)=>({slide_id:slide.slide_id,page:index+1,status:'text_detected',matched_text:slide.section_topics?.map(topic=>topic.title)||[],visible_text_occupancy_ratio:slide.elements.some(element=>element.kind==='diagram')?0.055:0.07,visible_text_line_count:4}))}};
}

test('formal quality audit passes a deck meeting the declared visual, explanation, language, layout, and render constraints',()=>{
  const result=auditDeckQuality(fixture());assert.equal(result.status,'pass',JSON.stringify(result.blockers));assert.equal(result.visual_slide_ratio,0.6);assert.deepEqual(result.blockers,[]);
  assert.equal(result.priority_allocation.priority_slide_share,0.6);assert.equal(result.priority_allocation.priority_time_share,0.818);
});

test('formal quality audit blocks font families outside the selected theme and missing font measurements',()=>{
 const input=fixture();input.renderedQa.slides[2].fontFaces=['Aptos Display','Comic Sans MS'];
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_FONT_MISMATCH'&&item.slide_id==='S1'));
 input.renderedQa.slides[2].fontFaces=['Aptos'];input.renderedQa.slides[2].unmeasuredFonts=[{shape:4,text:'Inherited font'}];
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_FONT_UNMEASURED'&&item.slide_id==='S1'));
 input.renderedQa.theme={};assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_THEME_FONTS_UNMEASURED'));
});

test('opening-context pages and repeated opening labels cannot bypass content and priority audits',()=>{
 const input=fixture({count:5,visualEvery:2});input.plan.quality_contract.minimum_priority_slide_share=0.5;
 for(let index=0;index<3;index++){
  const id=`HIDDEN-${index+1}`,slide={slide_id:id,type:'statement',title:'Unimportant filler',role:'opening_context',section_name:'Results',evidence_ids:['E1'],elements:[{element_id:`${id}-T`,kind:'text',text:'少量文字。'}]},planned={slide_id:id,narrative_role:'opening_context',section_name:'Results',importance:'supporting',visual_type:'text',evidence_ids:['E1']};
 input.presentationIR.slides.push(slide);input.plan.slides.push(planned);input.contentPlan.slides.push({slide_id:id,time_budget_seconds:20});input.renderedQa.slides.push({textBoundsPass:true,textOverlaps:[],smallText:[]});input.imageReview.pages.push({slide_id:id,page:input.imageReview.pages.length+1,status:'text_detected',visible_text_occupancy_ratio:0.07,visible_text_line_count:2});
 }
 const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
 assert.equal(result.content_slide_count,8,'opening_context is substantive content, not a transition role');
 assert.ok(codes.has('QUALITY_PRIORITY_SLIDE_SHARE'),'extra low-priority pages must dilute the actual core-page share');
 assert.ok(codes.has('QUALITY_CONTENT_TOO_THIN'),'opening_context copy must meet the normal content floor');
});

test('formal quality audit blocks planned evidence that is absent from the rendered content page',()=>{
 const input=fixture(),slide=input.presentationIR.slides.find(item=>item.slide_id==='S2');slide.evidence_ids=[];
 const result=auditDeckQuality(input),finding=result.blockers.find(item=>item.code==='QUALITY_EVIDENCE_LINEAGE_MISSING'&&item.slide_id==='S2');
 assert.deepEqual(finding?.missing_evidence_ids,['E1']);
});

test('formal quality audit blocks unplanned or missing pages even when rendered and planned counts match',()=>{
 const input=fixture(),index=input.presentationIR.slides.findIndex(item=>item.slide_id==='S5');input.presentationIR.slides[index]={...input.presentationIR.slides[index],slide_id:'UNPLANNED'};
 const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
 assert.ok(codes.has('QUALITY_PLAN_SLIDE_MISSING'));assert.ok(codes.has('QUALITY_PLAN_SLIDE_UNPLANNED'));
});

test('formal quality audit distinguishes a declared representative pilot from an incomplete full-deck run',()=>{
 const input=fixture(),missing=input.presentationIR.slides.pop();input.renderedQa.slides.pop();input.imageReview.pages.pop();
 const result=auditDeckQuality(input);
 assert.ok(result.blockers.some(item=>item.code==='QUALITY_PLAN_PAGE_MAP_MISMATCH'));
 assert.ok(!result.warnings.some(item=>item.code==='QUALITY_NARRATIVE_STRUCTURE_DEFERRED'));
 input.plan.representative_slides=[missing.slide_id];input.presentationIR.slides=[missing];input.renderedQa.slides=[{textBoundsPass:true,textOverlaps:[],smallText:[]}];input.imageReview.pages=[{slide_id:missing.slide_id,page:1,status:'text_detected',visible_text_occupancy_ratio:0.07,visible_text_line_count:4}];
 const pilot=auditDeckQuality(input);assert.ok(!pilot.blockers.some(item=>item.code==='QUALITY_PLAN_PAGE_MAP_MISMATCH'));assert.ok(pilot.warnings.some(item=>item.code==='QUALITY_NARRATIVE_STRUCTURE_DEFERRED'));
});

test('formal quality audit blocks too few core pages and too little talk time for priority content',()=>{
 const fewPages=fixture();fewPages.plan.quality_contract.minimum_priority_slide_share=0.5;
 for(const item of fewPages.plan.slides)if(item.narrative_role==='result')item.importance='supporting';
 fewPages.plan.slides.find(item=>item.narrative_role==='result').importance='core';
 assert.ok(auditDeckQuality(fewPages).blockers.some(item=>item.code==='QUALITY_PRIORITY_SLIDE_SHARE'));

 const littleTime=fixture();
 for(const item of littleTime.contentPlan.slides){const planned=littleTime.plan.slides.find(slide=>slide.slide_id===item.slide_id);if(planned?.narrative_role==='result')item.time_budget_seconds=planned.importance==='core'?15:90;}
 assert.ok(auditDeckQuality(littleTime).blockers.some(item=>item.code==='QUALITY_PRIORITY_TIME_SHARE'));
});

test('formal quality audit requires every declared focus topic to have a core/high owner',()=>{
 const input=fixture({count:6,visualEvery:2});input.plan.quality_contract.content_priorities=['Mechanism','Result'];input.plan.quality_contract.priority_depth=[{priority_id:'Mechanism',depth_level:'standard',minimum_core_slides:2},{priority_id:'Result',depth_level:'standard',minimum_core_slides:2}];
 for(const slide of input.plan.slides.filter(item=>item.slide_id.startsWith('S'))){
  slide.priority_ids=slide.importance==='core'?['Mechanism']:slide.slide_id==='S2'?['Result']:[];
 }
 const finding=auditDeckQuality(input).blockers.find(item=>item.code==='QUALITY_PRIORITY_UNCOVERED'&&item.priority==='Result');
 assert.ok(finding,'a declared result priority carried only by supporting pages must be blocked even when aggregate page/time shares pass');
 input.plan.slides.find(item=>item.slide_id==='S1').priority_ids=['Mechanism','Mechanism'];
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_PRIORITY_TAGS_DUPLICATE'));
 input.plan.slides.find(item=>item.slide_id==='S1').priority_ids=['Mechanism'];input.plan.quality_contract.content_priorities=['Mechanism','Mechanism'];
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_PRIORITY_MAP_INVALID'));
});

test('formal quality audit requires per-topic core pages to match declared standard or deep explanation depth',()=>{
 const input=fixture({count:5,visualEvery:2});input.plan.quality_contract.priority_depth=[{priority_id:'Results',depth_level:'deep',minimum_core_slides:7}];
 const result=auditDeckQuality(input),finding=result.blockers.find(item=>item.code==='QUALITY_PRIORITY_DEPTH_UNDERALLOCATED'&&item.priority==='Results');
 assert.ok(finding);assert.equal(finding.actual_core_slide_count,3);assert.equal(finding.minimum_core_slides,7);
 input.plan.quality_contract.priority_depth=[{priority_id:'Results',depth_level:'standard',minimum_core_slides:2}];
 assert.ok(!auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_PRIORITY_DEPTH_UNDERALLOCATED'));
 input.plan.quality_contract.priority_depth=[null];
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_PRIORITY_DEPTH_UNMEASURED'));
});

test('formal quality audit blocks deep priorities whose core pages repeat one explanation stage',()=>{
 const input=fixture({count:13,visualEvery:2});input.plan.quality_contract.priority_depth=[{priority_id:'Results',depth_level:'deep',minimum_core_slides:7}];
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_PRIORITY_STAGE_MISSING'),'deep pages without stage declarations must fail the independent final audit');
 for(const planned of input.plan.slides.filter(item=>item.importance==='core'))planned.explanation_stage='mechanism';
 const result=auditDeckQuality(input),finding=result.blockers.find(item=>item.code==='QUALITY_PRIORITY_STAGE_DIVERSITY');
 assert.ok(finding,'seven core pages with one declared stage must not count as a progressive deep explanation');assert.equal(finding.stages.length,1);assert.equal(finding.minimum_distinct_stages,4);
 for(const [index,planned] of input.plan.slides.filter(item=>item.importance==='core').entries())planned.explanation_stage=['question','mechanism','evidence','comparison','result','implication','synthesis'][index];
 assert.ok(!auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_PRIORITY_STAGE_DIVERSITY'));
});

test('formal quality audit blocks exact and near-verbatim repeated explanations across core pages',()=>{
 const input=fixture({count:5,visualEvery:2}),first=input.presentationIR.slides.find(slide=>slide.slide_id==='S1'),duplicate=input.presentationIR.slides.find(slide=>slide.slide_id==='S3');
 duplicate.elements[0].text=first.elements[0].text;
 const finding=auditDeckQuality(input).blockers.find(item=>item.code==='QUALITY_PRIORITY_EXPLANATION_DUPLICATED');
 assert.ok(finding);assert.equal(finding.priority,'Results');assert.deepEqual(finding.slide_ids,['S1','S3']);
 const paraphrased=fixture({count:5,visualEvery:2}),base=paraphrased.presentationIR.slides.find(slide=>slide.slide_id==='S1').elements[0].text,target=paraphrased.presentationIR.slides.find(slide=>slide.slide_id==='S3');
 target.elements[0].text=base.replace('测量流程','分析流程').replace('可复核记录','可追溯记录');
 const near=auditDeckQuality(paraphrased).blockers.find(item=>item.code==='QUALITY_PRIORITY_EXPLANATION_NEAR_DUPLICATED');
 assert.ok(near,'small synonym substitutions must not count as a second distinct explanation');assert.deepEqual(near.slide_ids,['S1','S3']);assert.ok(near.lexical_overlap_ratio>=0.9);
 const bullets=fixture({count:5,visualEvery:2}),bulletBase=bullets.presentationIR.slides.find(slide=>slide.slide_id==='S1').elements[0].text,bulletTarget=bullets.presentationIR.slides.find(slide=>slide.slide_id==='S3');
 bulletTarget.elements[0]={element_id:'T3-BULLETS',kind:'bullets',items:[bulletBase.replace('测量流程','分析流程').replace('可复核记录','可追溯记录')]};
 assert.ok(auditDeckQuality(bullets).blockers.some(item=>item.code==='QUALITY_PRIORITY_EXPLANATION_NEAR_DUPLICATED'),'bullet text must use the same repeat gate as prose paragraphs');
 const english=fixture({count:5,visualEvery:2}),englishBase='The research pipeline collects observations, normalizes identifiers, validates schema, aligns timestamps, filters invalid records, computes latency percentiles, aggregates independent runs, estimates uncertainty, compares baselines, checks regressions, preserves provenance, documents assumptions, exports charts, records confidence intervals, tracks exclusions, distinguishes throughput, request size, hardware generation, cache reuse, batching, scheduling, network traffic, memory pressure, warmup, steady state, repeated trials, measurement noise, sample counts, missing values, outliers, control groups, validation splits, deployment conditions, and reproducible seeds.';
 english.presentationIR.slides.find(slide=>slide.slide_id==='S1').elements[0].text=englishBase;
 english.presentationIR.slides.find(slide=>slide.slide_id==='S3').elements[0].text=englishBase.replace('collects observations','gathers measurements').replace('preserves provenance','keeps lineage');
 assert.ok(auditDeckQuality(english).blockers.some(item=>item.code==='QUALITY_PRIORITY_EXPLANATION_NEAR_DUPLICATED'),'English word-token overlap must also block small rewrites');
});

test('formal quality audit blocks thin text, low visual coverage, repeated layouts, assistant voice, and English blocks',()=>{
  const input=fixture({count:6,visualEvery:99,body:'You can use this result. Please provide your feedback. This is a very long English only paragraph that should not appear inside a Chinese report.'});
  input.plan.quality_contract.visual_slide_ratio_min=0.6;input.plan.quality_contract.minimum_explanation_units=35;
  input.plan.slides=input.presentationIR.slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'agenda':index===1?'section_transition':'result',section_name:index===1?'Results':'Results',visual_type:'image or diagram',layout_intent:'same-grid'}));
  const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
  for(const code of ['QUALITY_CONTENT_TOO_THIN','QUALITY_VISUAL_COVERAGE','QUALITY_LAYOUT_REPETITION','QUALITY_ASSISTANT_VOICE','QUALITY_LONG_ENGLISH_BLOCK','QUALITY_PLANNED_VISUAL_MISSING'])assert.ok(codes.has(code),code);
});

test('formal visual coverage ignores Mermaid elements that the renderer preserved as text',()=>{
 const input=fixture({count:4,visualEvery:1});
 for(const slide of input.presentationIR.slides.slice(2))for(const element of slide.elements)if(element.kind==='diagram'){element.kind='mermaid';element.source='flowchart LR\\nA -.- B';delete element.groups;delete element.nodes;delete element.edges;}
 const renderWarnings=input.presentationIR.slides.slice(2).map(slide=>`${slide.slide_id}/${slide.elements[1].element_id}: Mermaid source was preserved as text because native conversion was unavailable (unsupported syntax)`);
 const result=auditDeckQuality({...input,renderWarnings}),finding=result.blockers.find(item=>item.code==='QUALITY_VISUAL_COVERAGE');
 assert.ok(finding);assert.equal(result.visual_slide_count,0);assert.equal(finding.unmaterialized_visuals.length,4);assert.ok(finding.unmaterialized_visuals.every(item=>item.kind==='mermaid'));
});

test('formal visual coverage has a non-lowerable 50 percent floor',()=>{
 const input=fixture({count:6,visualEvery:3});input.plan.quality_contract.visual_slide_ratio_min=0.3;
 const result=auditDeckQuality(input),finding=result.blockers.find(item=>item.code==='QUALITY_VISUAL_COVERAGE');
 assert.equal(result.visual_slide_ratio,0.333);assert.equal(result.minimum_visual_slide_ratio,0.5);assert.ok(finding);assert.equal(finding.minimum_ratio,0.5);
});

test('layout diversity signatures use the rendered text fallback when Mermaid cannot materialize',()=>{
 const input=fixture({count:6,visualEvery:99}),content=input.presentationIR.slides.slice(2);
 input.plan.slides.slice(2).forEach(slide=>{slide.narrative_role='result';});
 const renderWarnings=[];
 for(const [index,slide] of content.entries())if(index%2===0){const original=slide.elements[0];slide.elements=[{...original,element_id:`${slide.slide_id}-M`,kind:'mermaid',source:'flowchart LR\\nA -.- B'}];if(index>=2)slide.type='architecture';renderWarnings.push(`${slide.slide_id}/${slide.elements[0].element_id}: Mermaid source was preserved as text because native conversion was unavailable (unsupported syntax)`);}
 const result=auditDeckQuality({...input,renderWarnings});
 assert.equal(result.layout_diversity.distinct_signature_count,1);assert.ok(result.blockers.some(item=>item.code==='QUALITY_LAYOUT_DIVERSITY'));
});

test('full-deck layout diversity gate catches alternating repeated templates even when plan labels differ',()=>{
 const alternating=fixture({count:8,visualEvery:2});
 alternating.plan.slides=alternating.plan.slides.map((slide,index)=>({...slide,narrative_role:slide.slide_id==='AGENDA'?'agenda':slide.slide_id==='DIV-RESULTS'?'section_transition':'result',layout_intent:`supposedly-unique-${index}`}));
 const result=auditDeckQuality(alternating),finding=result.blockers.find(item=>item.code==='QUALITY_LAYOUT_DIVERSITY');
 assert.ok(finding,'A/B/A/B repeated composition must not evade the full-deck gate');
 assert.equal(finding.distinct_signature_count,2);assert.equal(finding.unique_signature_share,0.25);assert.equal(result.layout_diversity.status,'fail');

 const varied=fixture({count:5,visualEvery:2});
 const kinds=['statement','chart','table','architecture','process'];
 varied.presentationIR.slides.slice(2).forEach((slide,index)=>{slide.type=kinds[index];});
 varied.plan.slides.slice(2).forEach((slide,index)=>{slide.layout_intent='same-plan-label';});
 const variedResult=auditDeckQuality(varied);
 assert.equal(variedResult.layout_diversity.status,'pass');assert.ok(!variedResult.blockers.some(item=>item.code==='QUALITY_LAYOUT_DIVERSITY'));
});

test('assistant voice screen catches common Chinese and English user-facing phrases without flagging research narration',()=>{
 for(const phrase of ['如果您愿意，可以先看这张图。','你会发现结果随着样本量增加而变化。','希望这能对您有帮助。','If you would like, please tell me what you think.','I will now show you the main result.','You should review this slide.']){
  const input=fixture();input.presentationIR.slides[3].elements[0].text=`${longText} ${phrase}`;
  assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_ASSISTANT_VOICE'),`expected assistant voice blocker for: ${phrase}`);
 }
 const researchNarration=fixture();researchNarration.presentationIR.slides[3].elements[0].text='We demonstrate that the measured effect increases consistently across the three reported conditions.';
 assert.ok(!auditDeckQuality(researchNarration).blockers.some(item=>item.code==='QUALITY_ASSISTANT_VOICE'));
});

test('assistant voice screen also blocks conversational prompts hidden in speaker notes',()=>{
 const input=fixture();input.presentationIR.slides[3].speaker_notes='如果您愿意，请告诉我是否要补充其他内容。';
 const finding=auditDeckQuality(input).blockers.find(item=>item.code==='QUALITY_ASSISTANT_VOICE');
 assert.equal(finding.location,'speaker_notes');assert.equal(finding.slide_id,'S2');
});

test('formal quality audit blocks stacked or copy-pasted disclaimer clauses while allowing one specific limitation',()=>{
 const focused=fixture();focused.presentationIR.slides[3].elements[0].text=`${longText} 当前样本不能证明所有场景都适用。`;
 assert.ok(!auditDeckQuality(focused).blockers.some(item=>item.code.startsWith('QUALITY_CAVEAT_')),'one specific limitation should remain allowed');

 const stacked=fixture();stacked.presentationIR.slides[3].elements[0].text=`${longText} 该结果不代表因果关系。当前样本不能证明其他人群也适用。该结论不意味着部署后效果相同。`;
 assert.ok(auditDeckQuality(stacked).blockers.some(item=>item.code==='QUALITY_CAVEAT_OVERLOAD'));

 const repeated=fixture({count:4});
 for(const slide of repeated.presentationIR.slides.slice(3))slide.elements[0].text=`${longText} 该结果不代表因果关系。`;
 const issue=auditDeckQuality(repeated).blockers.find(item=>item.code==='QUALITY_CAVEAT_REPETITION');
 assert.deepEqual(issue.slide_ids,['S2','S3','S4']);
});

test('caveat gates include section transitions while ignoring the navigation-only agenda',()=>{
 const stacked=fixture();stacked.presentationIR.slides[1].elements[0].text+=' 本结论不代表因果关系。不表明适用于所有样本。不能证明其他机制不存在。';
 assert.ok(auditDeckQuality(stacked).blockers.some(item=>item.code==='QUALITY_CAVEAT_OVERLOAD'&&item.slide_id==='DIV-RESULTS'));

 const repeated=fixture();
 for(const id of ['DIV-RESULTS','S2','S3'])repeated.presentationIR.slides.find(slide=>slide.slide_id===id).elements[0].text+=' 本结论不代表因果关系。';
 const finding=auditDeckQuality(repeated).blockers.find(item=>item.code==='QUALITY_CAVEAT_REPETITION');
 assert.deepEqual(finding?.slide_ids,['DIV-RESULTS','S2','S3']);

 const agenda=fixture();agenda.presentationIR.slides[0].elements[0].text='本结论不代表因果关系。不表明适用于所有样本。不能证明其他机制不存在。';
 assert.ok(!auditDeckQuality(agenda).blockers.some(item=>item.code.startsWith('QUALITY_CAVEAT_')),'navigation-only agenda copy is outside the caveat content screen');
});

test('formal quality audit blocks a text-unit-compliant page with sparse rendered body copy and missing density evidence',()=>{
 const sparse=fixture({count:2,visualEvery:99});sparse.imageReview.pages[3].visible_text_occupancy_ratio=0.034;sparse.imageReview.pages[3].visible_text_line_count=3;
 assert.ok(auditDeckQuality(sparse).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'));
 const sparseWithDiagram=fixture({count:2,visualEvery:1});sparseWithDiagram.imageReview.pages[3].visible_text_occupancy_ratio=0.02;sparseWithDiagram.imageReview.pages[3].visible_text_line_count=1;
 assert.ok(auditDeckQuality(sparseWithDiagram).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'),'a small amount of copy must not pass merely because a diagram is present');
 const legibleWithDiagram=fixture({count:2,visualEvery:1});legibleWithDiagram.imageReview.pages[3].visible_text_occupancy_ratio=0.055;legibleWithDiagram.imageReview.pages[3].visible_text_line_count=2;
 assert.ok(!auditDeckQuality(legibleWithDiagram).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'),'a visual page at the 5.5% floor with two explanatory lines should pass');
 legibleWithDiagram.imageReview.pages[3].visible_text_occupancy_ratio=0.0549;assert.ok(auditDeckQuality(legibleWithDiagram).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'),'a visual page just below the 5.5% floor should fail');
 const legibleTextOnly=fixture({count:2,visualEvery:99});legibleTextOnly.imageReview.pages[3].visible_text_occupancy_ratio=0.07;legibleTextOnly.imageReview.pages[3].visible_text_line_count=2;
 assert.ok(!auditDeckQuality(legibleTextOnly).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'),'a text-only page at the 7% floor with two explanatory lines should pass');
 legibleTextOnly.imageReview.pages[3].visible_text_occupancy_ratio=0.0699;assert.ok(auditDeckQuality(legibleTextOnly).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'),'a text-only page just below the 7% floor should fail');
 legibleTextOnly.imageReview.pages[3].body_text_overflow_word_count=2;assert.ok(auditDeckQuality(legibleTextOnly).blockers.some(item=>item.code==='QUALITY_RENDERED_TEXT_OVERFLOW'),'OCR words outside the body text boxes must block even when the density floor passes');
 delete sparse.imageReview.pages[3].visible_text_occupancy_ratio;delete sparse.imageReview.pages[3].visible_text_line_count;
 assert.ok(auditDeckQuality(sparse).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_UNMEASURED'));
});

test('formal quality audit blocks an ending with no substantive copy, sparse rendered explanation, or missing OCR evidence',()=>{
 const input=fixture(),closing={slide_id:'CLOSE',type:'closing',title:'The result changes how the system should be designed.',elements:[{element_id:'CLOSE-T1',kind:'text',text:'实验结果显示，缓存复用显著降低重复计算开销，同时保持输出质量稳定；因此系统应优先优化高复用请求，并持续监测质量变化。'}]};
 input.presentationIR.slides.push(closing);input.plan.slides.push({slide_id:'CLOSE',narrative_role:'closing'});input.renderedQa.slides.push({textBoundsPass:true,textOverlaps:[],smallText:[]});input.imageReview.pages.push({slide_id:'CLOSE',page:input.imageReview.pages.length+1,status:'text_detected',visible_text_occupancy_ratio:0.07,visible_text_line_count:2});
 assert.ok(!auditDeckQuality(input).blockers.some(item=>item.code.startsWith('QUALITY_CLOSING_')),'substantive two-line ending should pass');
 input.imageReview.pages.at(-1).visible_text_line_count=1;
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_CLOSING_DENSITY_LOW'),'a large headline cannot make one sparse body line pass');
 delete input.imageReview.pages.at(-1).visible_text_occupancy_ratio;
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_CLOSING_DENSITY_UNMEASURED'));
 input.presentationIR.slides.at(-1).elements[0].text='Done.';input.imageReview.pages.at(-1).visible_text_occupancy_ratio=0.08;input.imageReview.pages.at(-1).visible_text_line_count=2;
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_CLOSING_TOO_THIN'));
});

test('formal quality audit blocks rendered overlap, out-of-bounds text, unreadable type, unknown font size, and absent pages',()=>{
  const input=fixture();input.renderedQa.slides[3]={textBoundsPass:false,textOverlaps:[{shape_a:1,shape_b:2,text_a:'one',text_b:'two'}],smallText:[{shape:3,min_font_size_pt:11,text:'tiny body in footer area',x:0,y:950000,w:100,h:100}],unmeasuredText:[{shape:4,text:'inherits unknown font',x:0,y:10,w:100,h:100}]};input.imageReview.pages.pop();
  const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
  for(const code of ['QUALITY_TEXT_OUT_OF_BOUNDS','QUALITY_TEXT_OVERLAP','QUALITY_TEXT_TOO_SMALL','QUALITY_TEXT_SIZE_UNMEASURED','QUALITY_RENDER_PAGE_COUNT'])assert.ok(codes.has(code),code);
  assert.equal(auditDeckQuality({...input,renderedQa:null}).status,'fail');
});

test('formal readability gate blocks 13.9 pt and accepts a measured 14 pt text floor',()=>{
 const input=fixture();input.renderedQa.slides[3]={textBoundsPass:true,textOverlaps:[],smallText:[{shape:2,min_font_size_pt:13.9,text:'Too small'}],unmeasuredText:[]};
 assert.ok(auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_TEXT_TOO_SMALL'));
 input.renderedQa.slides[3].smallText=[{shape:2,min_font_size_pt:14,text:'Readable'}];
 assert.ok(!auditDeckQuality(input).blockers.some(item=>item.code==='QUALITY_TEXT_TOO_SMALL'));
});

test('formal quality audit blocks postage-stamp images and charts using rendered OOXML bounds',()=>{
 const input=fixture();input.presentationIR.slides[3].elements.push({element_id:'IMG-SMALL',kind:'image',asset_id:'synthetic-photo',alt:'Synthetic fixture image',x:0,y:0,w:1,h:1});
 input.renderedQa.slides[3]={...input.renderedQa.slides[3],slideWidthEmu:12192000,slideHeightEmu:6858000,elementBounds:[{element:'pic',ok:true,x:100,y:100,w:300000,h:300000}]};
 let result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_TOO_SMALL'&&item.kind==='image'));
 input.presentationIR.slides[3].elements=input.presentationIR.slides[3].elements.filter(element=>element.kind!=='image');input.presentationIR.slides[3].type='chart';input.presentationIR.slides[3].elements.push({element_id:'CHART-SMALL',kind:'chart',chart_kind:'bar',series:[]});
 input.renderedQa.slides[3].elementBounds=[{element:'graphicFrame',ok:true,x:100,y:100,w:2000000,h:1000000}];
 result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_TOO_SMALL'&&item.kind==='chart'));
 input.renderedQa.slides[3].elementBounds=[];result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_SIZE_UNMEASURED'&&item.kind==='chart'));
});

test('formal quality audit blocks tiny or unmeasured native diagram shape groups',()=>{
 const input=fixture();input.renderedQa.slides[2].visualGroupBounds=[{group_id:'S1:diagram',kind:'diagram',area_ratio:0.025,bounds_area_ratio:0.2,member_count:4,ok:true}];
 let result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_TOO_SMALL'&&item.kind==='diagram'));
 input.renderedQa.slides[2].visualGroupBounds=[{group_id:'S1:diagram',kind:'diagram',area_ratio:0.2,bounds_area_ratio:0.119,member_count:5,ok:true}];
 result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_TOO_SMALL'&&item.minimum_bounds_area_ratio===0.12));
 input.renderedQa.slides[2].visualGroupBounds[0].bounds_area_ratio=0.12;
 result=auditDeckQuality(input);assert.ok(!result.blockers.some(item=>item.code==='QUALITY_VISUAL_TOO_SMALL'&&item.slide_id==='S1'),'a diagram at the 12 percent footprint boundary passes');
 input.renderedQa.slides[2].visualGroupBounds=[];result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_SIZE_UNMEASURED'&&item.kind==='diagram'));
 input.renderedQa.slides[2].visualGroupBounds=[{group_id:'S1:diagram',kind:'diagram',area_ratio:0.2,bounds_area_ratio:0.2,member_count:5,unmeasured_member_count:1,ok:false}];result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_SIZE_UNMEASURED'&&item.kind==='diagram'));
 const mermaid=fixture();mermaid.presentationIR.slides[2].elements.find(element=>element.kind==='diagram').kind='mermaid';mermaid.renderedQa.slides[2].visualGroupBounds=[{group_id:'S1:diagram',kind:'diagram',area_ratio:0.025,bounds_area_ratio:0.2,member_count:4,ok:true}];
 assert.ok(auditDeckQuality(mermaid).blockers.some(item=>item.code==='QUALITY_VISUAL_TOO_SMALL'&&item.kind==='mermaid'));
});

test('formal Chinese deck flags English-dominant blocks even with token Chinese mixed in',()=>{
  const input=fixture();input.presentationIR.slides[3].elements[0].text='A long English-only paragraph with more than sixteen English words and no Chinese explanation to help the audience understand it.';
  input.imageReview.pages[3].status='ocr_failed';
  const result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_LONG_ENGLISH_BLOCK'));assert.ok(result.warnings.some(item=>item.code==='QUALITY_OCR_INCOMPLETE'));

  const mixed=fixture();mixed.presentationIR.slides[3].elements[0].text='说明：This method uses a cache to reduce repeated computation and improve model response speed across long contexts while preserving output quality under repeated reuse.';
  const mixedIssue=auditDeckQuality(mixed).blockers.find(item=>item.code==='QUALITY_LONG_ENGLISH_BLOCK');assert.ok(mixedIssue,'a few Chinese characters must not hide a long English block');assert.ok(mixedIssue.chinese_character_share<0.35);

  const explainedTerms=fixture();explainedTerms.presentationIR.slides[3].elements[0].text=`在 GPU 上复用 KV cache 可以减少重复计算并缩短响应时间。${longText}`;
  assert.ok(!auditDeckQuality(explainedTerms).blockers.some(item=>item.code==='QUALITY_LONG_ENGLISH_BLOCK'),'necessary English technical terms inside substantial Chinese explanation should pass');
});

test('formal Chinese deck blocks a substantial English passage split across short bullets',()=>{
  const input=fixture();
  input.presentationIR.slides[3].elements=[{element_id:'S4-B01',kind:'bullets',items:[
    'The cache reduces repeated computation and shortens response time.',
    'Requests reuse stored keys while preserving output quality.'
  ]}];
  const result=auditDeckQuality(input);
  const issue=result.blockers.find(item=>item.code==='QUALITY_ENGLISH_BLOCK_FRAGMENTED');
  assert.ok(issue,'two short English-dominant bullets totaling at least 16 words must be blocked');
  assert.equal(issue.fragment_count,2);assert.equal(issue.latin_words,17);

  const short=fixture();short.presentationIR.slides[3].elements=[{element_id:'S4-B01',kind:'bullets',items:['The cache reduces repeated computation and shortens response time.','用中文解释请求如何复用已存储的键并维持输出质量。']}];
  assert.ok(!auditDeckQuality(short).blockers.some(item=>item.code==='QUALITY_ENGLISH_BLOCK_FRAGMENTED'),'one short technical fragment with Chinese explanation should pass');
});

test('formal quality audit blocks an omitted agenda, missing section divider, or content with no section mapping',()=>{
  const omittedAgenda=fixture();omittedAgenda.plan.slides[0].narrative_role='opening';
  assert.ok(auditDeckQuality(omittedAgenda).blockers.some(item=>item.code==='QUALITY_AGENDA_PLAN'));
  const missingDivider=fixture();missingDivider.plan.slides[1].section_name='Other';
  assert.ok(auditDeckQuality(missingDivider).blockers.some(item=>item.code==='QUALITY_SECTION_TRANSITION_PLAN'));
  const contentUnmapped=fixture();contentUnmapped.plan.slides.slice(2).forEach(slide=>slide.section_name='Other');
  assert.ok(auditDeckQuality(contentUnmapped).blockers.some(item=>item.code==='QUALITY_SECTION_CONTENT_PLAN'));
  const agendaOmitsSection=fixture();agendaOmitsSection.presentationIR.slides[0].elements[0].text='Methods';
  assert.ok(auditDeckQuality(agendaOmitsSection).blockers.some(item=>item.code==='QUALITY_AGENDA_CONTENT'));
  const emptyDivider=fixture();emptyDivider.presentationIR.slides[1].elements[0].text='结果';
  assert.ok(auditDeckQuality(emptyDivider).blockers.some(item=>item.code==='QUALITY_SECTION_TRANSITION_TOO_THIN'));
});

test('formal quality audit requires authored section roadmap topics and rendered visibility',()=>{
 const missingRoute=fixture();missingRoute.presentationIR.slides[1].section_topics=[];
 assert.ok(auditDeckQuality(missingRoute).blockers.some(item=>item.code==='QUALITY_SECTION_ROADMAP_MISSING'));
 const missingPixels=fixture();missingPixels.imageReview.pages[1].matched_text=[];
 assert.ok(auditDeckQuality(missingPixels).blockers.some(item=>item.code==='QUALITY_SECTION_ROADMAP_NOT_VISIBLE'));
 const sparseRoute=fixture();sparseRoute.imageReview.pages[1].visible_text_occupancy_ratio=0.0449;
 assert.ok(auditDeckQuality(sparseRoute).blockers.some(item=>item.code==='QUALITY_SECTION_ROADMAP_TOO_SPARSE'));
});

test('representative-slide pilot defers whole-deck agenda checks until the planned full deck is rendered',()=>{
  const input=fixture({count:4});
  input.plan.task={expected_slide_count:input.presentationIR.slides.length};
  input.presentationIR.slides=[input.presentationIR.slides[3]];
  input.plan.representative_slides=[input.presentationIR.slides[0].slide_id];
  input.renderedQa.slides=[input.renderedQa.slides[3]];
  input.imageReview.pages=[{slide_id:input.presentationIR.slides[0].slide_id,page:1,status:'text_detected',visible_text_occupancy_ratio:0.07,visible_text_line_count:4}];
  const result=auditDeckQuality(input);
  assert.equal(result.status,'review');assert.deepEqual(result.blockers,[]);
  assert.equal(result.layout_diversity.status,'deferred');
  assert.ok(result.warnings.some(item=>item.code==='QUALITY_NARRATIVE_STRUCTURE_DEFERRED'));
  assert.equal(result.visual_slide_ratio,0);assert.ok(!result.blockers.some(item=>item.code==='QUALITY_VISUAL_COVERAGE'));assert.ok(result.warnings.some(item=>item.code==='QUALITY_VISUAL_COVERAGE_DEFERRED'));
});
