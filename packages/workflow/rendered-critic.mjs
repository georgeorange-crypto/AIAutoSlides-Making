import {createTesseractRecognizer} from '../../src/document-extractors.mjs';

const norm=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
function expectedText(slide){
  const values=[slide.title,slide.assertion_title,slide.role];
  for(const element of slide.elements||[]){
    values.push(element.text,element.value,element.source,element.caption,element.x_axis_label,element.y_axis_label);
    for(const item of element.items||[])values.push(typeof item==='string'?item:item.title,item?.value,item?.detail);
    for(const row of element.rows||[])values.push(...row);
    values.push(...(element.headers||[]));
    for(const node of element.nodes||[])values.push(node.label);
    for(const step of element.steps||[])values.push(typeof step==='string'?step:step.title);
  }
  return [...new Set(values.filter(value=>typeof value==='string'&&norm(value).length>=3))];
}

/** OCR checks that expected authored text is detectably present in exported page images. It does not judge meaning or layout quality. */
export async function critiqueRenderedPages({presentationIR,pages,recognizerFactory=createTesseractRecognizer}){
  const slides=presentationIR.slides||[],imagePages=(pages||[]).filter(item=>item.format==='png'),byNumber=new Map(imagePages.map(item=>[Number(item.path.match(/page-(\d+)\.png$/i)?.[1]),item]));
  if(!imagePages.length)return{status:'not_rendered',method:'local_ocr_coverage',pages:[],limitations:['No rendered PNG pages were supplied; rendered-image checks were not run.','OCR does not establish factual accuracy, semantic image fit, aesthetic quality, or human approval.']};
  const language=slides.some(slide=>/[\u3400-\u9fff]/u.test(JSON.stringify(slide)))?'chi_sim+eng':'eng';
  let recognizer;
  try{recognizer=await recognizerFactory(language);}catch(error){return{status:'unavailable',method:'local_tesseract_ocr',language,pages:[],error:error.message,limitations:['Local OCR could not initialize; deck generation and structural QA remain independent of this screen.','OCR does not establish factual accuracy, semantic image fit, aesthetic quality, or human approval.']};}
  try{
    const results=[];
    for(let index=0;index<slides.length;index++){
      const slide=slides[index],number=index+1,image=byNumber.get(number),expected=expectedText(slide);
      if(!image){results.push({slide_id:slide.slide_id,page:number,status:'missing_page_image',expected_text_items:expected.length,detected_text_items:0,coverage:null,ocr_confidence:null});continue;}
      let recognized;
      try{recognized=await recognizer.recognize(image.path);}catch(error){results.push({slide_id:slide.slide_id,page:number,status:'ocr_failed',expected_text_items:expected.length,detected_text_items:0,coverage:null,ocr_confidence:null,error:error.message});continue;}
      const visible=norm(recognized.text),matched=expected.filter(text=>visible.includes(norm(text)));
      const coverage=expected.length?Number((matched.length/expected.length).toFixed(3)):null;
      results.push({slide_id:slide.slide_id,page:number,status:coverage===null?'no_expected_text':coverage<0.6?'low_text_coverage':'text_detected',expected_text_items:expected.length,detected_text_items:matched.length,matched_text:matched,coverage,ocr_confidence:Number.isFinite(recognized.confidence)?Number(recognized.confidence.toFixed(2)):null,image_sha256:image.sha256||null});
    }
    const missing=results.filter(item=>item.status==='missing_page_image').length,low=results.filter(item=>item.status==='low_text_coverage').length,failed=results.filter(item=>item.status==='ocr_failed').length;
    return{status:missing?'incomplete':failed?'partial':low?'review':'text_detected',method:'local_tesseract_ocr',language,pages:results,limitations:['OCR text coverage is a screening signal; low coverage can result from font, language, contrast, or recognition errors.','A high coverage score does not prove there is no clipping, overlap, poor hierarchy, or semantic mismatch.','OCR never upgrades source, evidence, or claim verification.','Every rendered page still requires a named human visual decision.']};
  }finally{try{await recognizer.close?.();}catch{}}
}
