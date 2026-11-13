import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDeckQuality} from '../packages/workflow/quality-audit.mjs';

const longText='这一页解释研究方法如何影响测量结果，并结合原始证据说明关键机制、适用范围、比较关系及其对结论的具体影响。读者可以据此理解数据从哪里来、为什么这样分析，以及结果支持到什么程度。';
const contract={visual_slide_ratio_min:0.4,minimum_explanation_units:28,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5,language:'Chinese',narrative_sections:['Results']};
function fixture({count=5,visualEvery=2,body=longText,role='result'}={}){
  const agenda={slide_id:'AGENDA',type:'bullets',title:'Contents',elements:[{element_id:'A1',kind:'text',text:'Results'}]};
  const divider={slide_id:'DIV-RESULTS',type:'statement',title:'Results',role:'section_transition',section_name:'Results',elements:[{element_id:'DIV-T01',kind:'text',text:'本节先解释关键机制及其作用，再说明这一机制如何连接到观察结果。'}]};
  const contentSlides=Array.from({length:count},(_,index)=>({slide_id:`S${index+1}`,type:'statement',title:`Claim ${index+1}`,role,evidence_ids:['E1'],elements:[{element_id:`T${index+1}`,kind:'text',text:body},...(index%visualEvery===0?[{element_id:`D${index+1}`,kind:'diagram',groups:[{label:'System'}],nodes:[{id:'a',label:'Input'},{id:'b',label:'Output'}],edges:[{from:'a',to:'b',label:'maps'}]}]:[])]}));
  const slides=[agenda,divider,...contentSlides];
  const plannedSlides=[{slide_id:'AGENDA',narrative_role:'agenda'}, {slide_id:'DIV-RESULTS',narrative_role:'section_transition',section_name:'Results'},...contentSlides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'opening_context':role,section_name:'Results',importance:index%2===0?'core':'supporting',visual_type:index%visualEvery===0?'diagram':'text',layout_intent:index%visualEvery===0?'diagram':'text'}))];
  const contentPlan={slides:plannedSlides.map(slide=>({slide_id:slide.slide_id,time_budget_seconds:slide.importance==='core'?60:slide.importance==='supporting'?20:5}))};
  const plan={quality_contract:{...contract},slides:plannedSlides};
  return{plan,presentationIR:{slides},contentPlan,renderedQa:{slides:slides.map(slide=>({textBoundsPass:true,textOverlaps:[],smallText:[],visualGroupBounds:slide.elements.filter(element=>element.kind==='diagram').map(()=>({group_id:`${slide.slide_id}:diagram`,kind:'diagram',area_ratio:0.2,bounds_area_ratio:0.2,member_count:5,ok:true}))}))},imageReview:{status:'text_detected',pages:slides.map((slide,index)=>({slide_id:slide.slide_id,page:index+1,status:'text_detected',visible_text_occupancy_ratio:0.06,visible_text_line_count:4}))}};
}

test('formal quality audit passes a deck meeting the declared visual, explanation, language, layout, and render constraints',()=>{
  const result=auditDeckQuality(fixture());assert.equal(result.status,'pass',JSON.stringify(result.blockers));assert.equal(result.visual_slide_ratio,0.5);assert.deepEqual(result.blockers,[]);
  assert.equal(result.priority_allocation.priority_slide_share,0.5);assert.equal(result.priority_allocation.priority_time_share,0.75);
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
 assert.ok(finding);assert.equal(result.visual_slide_count,0);assert.equal(finding.unmaterialized_visuals.length,3);assert.ok(finding.unmaterialized_visuals.every(item=>item.kind==='mermaid'));
});

test('formal visual coverage has a non-lowerable 50 percent floor',()=>{
 const input=fixture({count:6,visualEvery:2});input.plan.quality_contract.visual_slide_ratio_min=0.3;
 const result=auditDeckQuality(input),finding=result.blockers.find(item=>item.code==='QUALITY_VISUAL_COVERAGE');
 assert.equal(result.visual_slide_ratio,0.4);assert.equal(result.minimum_visual_slide_ratio,0.5);assert.ok(finding);assert.equal(finding.minimum_ratio,0.5);
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

test('formal quality audit blocks a text-unit-compliant page with sparse rendered body copy and missing density evidence',()=>{
 const sparse=fixture({count:2,visualEvery:99});sparse.imageReview.pages[3].visible_text_occupancy_ratio=0.034;sparse.imageReview.pages[3].visible_text_line_count=3;
 assert.ok(auditDeckQuality(sparse).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'));
 const sparseWithDiagram=fixture({count:2,visualEvery:1});sparseWithDiagram.imageReview.pages[3].visible_text_occupancy_ratio=0.02;sparseWithDiagram.imageReview.pages[3].visible_text_line_count=1;
 assert.ok(auditDeckQuality(sparseWithDiagram).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'),'a small amount of copy must not pass merely because a diagram is present');
 const legibleWithDiagram=fixture({count:2,visualEvery:1});legibleWithDiagram.imageReview.pages[3].visible_text_occupancy_ratio=0.05;legibleWithDiagram.imageReview.pages[3].visible_text_line_count=2;
 assert.ok(!auditDeckQuality(legibleWithDiagram).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'),'a visual page with two explanatory lines and sufficient occupied area should pass');
 delete sparse.imageReview.pages[3].visible_text_occupancy_ratio;delete sparse.imageReview.pages[3].visible_text_line_count;
 assert.ok(auditDeckQuality(sparse).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_UNMEASURED'));
});

test('formal quality audit blocks rendered overlap, out-of-bounds text, unreadable type, unknown font size, and absent pages',()=>{
  const input=fixture();input.renderedQa.slides[3]={textBoundsPass:false,textOverlaps:[{shape_a:1,shape_b:2,text_a:'one',text_b:'two'}],smallText:[{shape:3,min_font_size_pt:11,text:'tiny body in footer area',x:0,y:950000,w:100,h:100}],unmeasuredText:[{shape:4,text:'inherits unknown font',x:0,y:10,w:100,h:100}]};input.imageReview.pages.pop();
  const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
  for(const code of ['QUALITY_TEXT_OUT_OF_BOUNDS','QUALITY_TEXT_OVERLAP','QUALITY_TEXT_TOO_SMALL','QUALITY_TEXT_SIZE_UNMEASURED','QUALITY_RENDER_PAGE_COUNT'])assert.ok(codes.has(code),code);
  assert.equal(auditDeckQuality({...input,renderedQa:null}).status,'fail');
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
 input.renderedQa.slides[2].visualGroupBounds=[];result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_SIZE_UNMEASURED'&&item.kind==='diagram'));
 input.renderedQa.slides[2].visualGroupBounds=[{group_id:'S1:diagram',kind:'diagram',area_ratio:0.2,bounds_area_ratio:0.2,member_count:5,unmeasured_member_count:1,ok:false}];result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_VISUAL_SIZE_UNMEASURED'&&item.kind==='diagram'));
 const mermaid=fixture();mermaid.presentationIR.slides[2].elements.find(element=>element.kind==='diagram').kind='mermaid';mermaid.renderedQa.slides[2].visualGroupBounds=[{group_id:'S1:diagram',kind:'diagram',area_ratio:0.025,bounds_area_ratio:0.2,member_count:4,ok:true}];
 assert.ok(auditDeckQuality(mermaid).blockers.some(item=>item.code==='QUALITY_VISUAL_TOO_SMALL'&&item.kind==='mermaid'));
});

test('formal Chinese deck flags English blocks and leaves OCR recognition failures for a human page review',()=>{
  const input=fixture();input.presentationIR.slides[3].elements[0].text='A long English-only paragraph with more than sixteen English words and no Chinese explanation to help the audience understand it.';
  input.imageReview.pages[3].status='ocr_failed';
  const result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_LONG_ENGLISH_BLOCK'));assert.ok(result.warnings.some(item=>item.code==='QUALITY_OCR_INCOMPLETE'));
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

test('representative-slide pilot defers whole-deck agenda checks until the planned full deck is rendered',()=>{
  const input=fixture({count:4});
  input.plan.task={expected_slide_count:input.presentationIR.slides.length};
  input.presentationIR.slides=[input.presentationIR.slides[3]];
  input.renderedQa.slides=[input.renderedQa.slides[3]];
  input.imageReview.pages=[{slide_id:input.presentationIR.slides[0].slide_id,page:1,status:'text_detected',visible_text_occupancy_ratio:0.06,visible_text_line_count:4}];
  const result=auditDeckQuality(input);
  assert.equal(result.status,'review');assert.deepEqual(result.blockers,[]);
  assert.equal(result.layout_diversity.status,'deferred');
  assert.ok(result.warnings.some(item=>item.code==='QUALITY_NARRATIVE_STRUCTURE_DEFERRED'));
  assert.equal(result.visual_slide_ratio,0);assert.ok(!result.blockers.some(item=>item.code==='QUALITY_VISUAL_COVERAGE'));assert.ok(result.warnings.some(item=>item.code==='QUALITY_VISUAL_COVERAGE_DEFERRED'));
});
