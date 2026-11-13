import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDeckQuality} from '../packages/workflow/quality-audit.mjs';

const longText='这一页解释研究方法如何影响测量结果，并结合原始证据说明关键机制、适用范围、比较关系及其对结论的具体影响。读者可以据此理解数据从哪里来、为什么这样分析，以及结果支持到什么程度。';
const contract={visual_slide_ratio_min:0.4,minimum_explanation_units:28,language:'Chinese',narrative_sections:['Results']};
function fixture({count=5,visualEvery=2,body=longText,role='result'}={}){
  const agenda={slide_id:'AGENDA',type:'bullets',title:'Contents',elements:[{element_id:'A1',kind:'text',text:'Results'}]};
  const divider={slide_id:'DIV-RESULTS',type:'statement',title:'Results',role:'section_transition',section_name:'Results',elements:[{element_id:'DIV-T01',kind:'text',text:'本节先解释关键机制及其作用，再说明这一机制如何连接到观察结果。'}]};
  const contentSlides=Array.from({length:count},(_,index)=>({slide_id:`S${index+1}`,type:'statement',title:`Claim ${index+1}`,role,evidence_ids:['E1'],elements:[{element_id:`T${index+1}`,kind:'text',text:body},...(index%visualEvery===0?[{element_id:`D${index+1}`,kind:'diagram',groups:[{label:'System'}],nodes:[{id:'a',label:'Input'},{id:'b',label:'Output'}],edges:[{from:'a',to:'b',label:'maps'}]}]:[])]}));
  const slides=[agenda,divider,...contentSlides];
  const plan={quality_contract:contract,slides:[{slide_id:'AGENDA',narrative_role:'agenda'}, {slide_id:'DIV-RESULTS',narrative_role:'section_transition',section_name:'Results'},...contentSlides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'opening_context':role,section_name:'Results',visual_type:index%visualEvery===0?'diagram':'text',layout_intent:index%visualEvery===0?'diagram':'text'}))]};
  return{plan,presentationIR:{slides},renderedQa:{slides:slides.map(()=>({textBoundsPass:true,textOverlaps:[],smallText:[]}))},imageReview:{status:'text_detected',pages:slides.map((slide,index)=>({slide_id:slide.slide_id,page:index+1,status:'text_detected',visible_text_occupancy_ratio:0.06,visible_text_line_count:4}))}};
}

test('formal quality audit passes a deck meeting the declared visual, explanation, language, layout, and render constraints',()=>{
  const result=auditDeckQuality(fixture());assert.equal(result.status,'pass');assert.equal(result.visual_slide_ratio,0.5);assert.deepEqual(result.blockers,[]);
});

test('formal quality audit blocks thin text, low visual coverage, repeated layouts, assistant voice, and English blocks',()=>{
  const input=fixture({count:6,visualEvery:99,body:'You can use this result. Please provide your feedback. This is a very long English only paragraph that should not appear inside a Chinese report.'});
  input.plan.quality_contract.visual_slide_ratio_min=0.6;input.plan.quality_contract.minimum_explanation_units=35;
  input.plan.slides=input.presentationIR.slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'agenda':index===1?'section_transition':'result',section_name:index===1?'Results':'Results',visual_type:'image or diagram',layout_intent:'same-grid'}));
  const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
  for(const code of ['QUALITY_CONTENT_TOO_THIN','QUALITY_VISUAL_COVERAGE','QUALITY_LAYOUT_REPETITION','QUALITY_ASSISTANT_VOICE','QUALITY_LONG_ENGLISH_BLOCK','QUALITY_PLANNED_VISUAL_MISSING'])assert.ok(codes.has(code),code);
});

test('formal quality audit blocks a text-unit-compliant page with sparse rendered body copy and missing density evidence',()=>{
 const sparse=fixture({count:2,visualEvery:99});sparse.imageReview.pages[3].visible_text_occupancy_ratio=0.034;sparse.imageReview.pages[3].visible_text_line_count=3;
 assert.ok(auditDeckQuality(sparse).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_LOW'));
 delete sparse.imageReview.pages[3].visible_text_occupancy_ratio;delete sparse.imageReview.pages[3].visible_text_line_count;
 assert.ok(auditDeckQuality(sparse).blockers.some(item=>item.code==='QUALITY_VISIBLE_DENSITY_UNMEASURED'));
});

test('formal quality audit blocks rendered overlap, out-of-bounds text, unreadable type, unknown font size, and absent pages',()=>{
  const input=fixture();input.renderedQa.slides[3]={textBoundsPass:false,textOverlaps:[{shape_a:1,shape_b:2,text_a:'one',text_b:'two'}],smallText:[{shape:3,min_font_size_pt:11,text:'tiny body in footer area',x:0,y:950000,w:100,h:100}],unmeasuredText:[{shape:4,text:'inherits unknown font',x:0,y:10,w:100,h:100}]};input.imageReview.pages.pop();
  const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
  for(const code of ['QUALITY_TEXT_OUT_OF_BOUNDS','QUALITY_TEXT_OVERLAP','QUALITY_TEXT_TOO_SMALL','QUALITY_TEXT_SIZE_UNMEASURED','QUALITY_RENDER_PAGE_COUNT'])assert.ok(codes.has(code),code);
  assert.equal(auditDeckQuality({...input,renderedQa:null}).status,'fail');
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
  input.presentationIR.slides=[input.presentationIR.slides[2]];
  input.renderedQa.slides=[input.renderedQa.slides[2]];
  input.imageReview.pages=[{slide_id:input.presentationIR.slides[0].slide_id,page:1,status:'text_detected'}];
  const result=auditDeckQuality(input);
  assert.equal(result.status,'review');assert.deepEqual(result.blockers,[]);
  assert.ok(result.warnings.some(item=>item.code==='QUALITY_NARRATIVE_STRUCTURE_DEFERRED'));
});
