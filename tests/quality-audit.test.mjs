import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDeckQuality} from '../packages/workflow/quality-audit.mjs';

const longText='这一页解释研究方法如何影响测量结果，并结合原始证据说明关键机制、适用范围、比较关系及其对结论的具体影响。读者可以据此理解数据从哪里来、为什么这样分析，以及结果支持到什么程度。';
const contract={visual_slide_ratio_min:0.4,minimum_explanation_units:28,language:'Chinese'};
function fixture({count=5,visualEvery=2,body=longText,role='result'}={}){
  const slides=Array.from({length:count},(_,index)=>({slide_id:`S${index+1}`,type:'statement',title:`Claim ${index+1}`,role,evidence_ids:['E1'],elements:[{element_id:`T${index+1}`,kind:'text',text:body},...(index%visualEvery===0?[{element_id:`D${index+1}`,kind:'diagram',groups:[{label:'System'}],nodes:[{id:'a',label:'Input'},{id:'b',label:'Output'}],edges:[{from:'a',to:'b',label:'maps'}]}]:[])]}));
  const plan={quality_contract:contract,slides:slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'opening_context':role,visual_type:index%visualEvery===0?'diagram':'text',layout_intent:index%visualEvery===0?'diagram':'text'}))};
  return{plan,presentationIR:{slides},renderedQa:{slides:slides.map(()=>({textBoundsPass:true,textOverlaps:[],smallText:[]}))},imageReview:{status:'text_detected',pages:slides.map((slide,index)=>({slide_id:slide.slide_id,page:index+1,status:'text_detected'}))}};
}

test('formal quality audit passes a deck meeting the declared visual, explanation, language, layout, and render constraints',()=>{
  const result=auditDeckQuality(fixture());assert.equal(result.status,'pass');assert.equal(result.visual_slide_ratio,0.5);assert.deepEqual(result.blockers,[]);
});

test('formal quality audit blocks thin text, low visual coverage, repeated layouts, assistant voice, and English blocks',()=>{
  const input=fixture({count:6,visualEvery:99,body:'You can use this result. Please provide your feedback. This is a very long English only paragraph that should not appear inside a Chinese report.'});
  input.plan.quality_contract.visual_slide_ratio_min=0.6;input.plan.quality_contract.minimum_explanation_units=35;
  input.plan.slides=input.presentationIR.slides.map(slide=>({slide_id:slide.slide_id,narrative_role:'result',visual_type:'image or diagram',layout_intent:'same-grid'}));
  const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
  for(const code of ['QUALITY_CONTENT_TOO_THIN','QUALITY_VISUAL_COVERAGE','QUALITY_LAYOUT_REPETITION','QUALITY_ASSISTANT_VOICE','QUALITY_LONG_ENGLISH_BLOCK','QUALITY_PLANNED_VISUAL_MISSING'])assert.ok(codes.has(code),code);
});

test('formal quality audit blocks actual rendered overlap, out-of-bounds text, unreadable type, and absent pages',()=>{
  const input=fixture();input.renderedQa.slides[1]={textBoundsPass:false,textOverlaps:[{shape_a:1,shape_b:2,text_a:'one',text_b:'two'}],smallText:[{shape:3,min_font_size_pt:11}]};input.imageReview.pages.pop();
  const result=auditDeckQuality(input),codes=new Set(result.blockers.map(item=>item.code));
  for(const code of ['QUALITY_TEXT_OUT_OF_BOUNDS','QUALITY_TEXT_OVERLAP','QUALITY_TEXT_TOO_SMALL','QUALITY_RENDER_PAGE_COUNT'])assert.ok(codes.has(code),code);
  assert.equal(auditDeckQuality({...input,renderedQa:null}).status,'fail');
});

test('formal Chinese deck flags English blocks and leaves OCR recognition failures for a human page review',()=>{
  const input=fixture();input.presentationIR.slides[1].elements[0].text='A long English-only paragraph with more than sixteen English words and no Chinese explanation to help the audience understand it.';
  input.imageReview.pages[1].status='ocr_failed';
  const result=auditDeckQuality(input);assert.ok(result.blockers.some(item=>item.code==='QUALITY_LONG_ENGLISH_BLOCK'));assert.ok(result.warnings.some(item=>item.code==='QUALITY_OCR_INCOMPLETE'));
});
