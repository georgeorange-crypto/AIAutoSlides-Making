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
function unionArea(rectangles){
  const xs=[...new Set(rectangles.flatMap(rect=>[rect.x0,rect.x1]))].sort((a,b)=>a-b);let area=0;
  for(let index=0;index<xs.length-1;index++){const left=xs[index],right=xs[index+1];if(right<=left)continue;const ranges=rectangles.filter(rect=>rect.x0<right&&rect.x1>left).map(rect=>[rect.y0,rect.y1]).sort((a,b)=>a[0]-b[0]);let covered=0,start=null,end=null;for(const [top,bottom] of ranges){if(start===null){start=top;end=bottom;}else if(top<=end)end=Math.max(end,bottom);else{covered+=end-start;start=top;end=bottom;}}if(start!==null)covered+=end-start;area+=(right-left)*covered;}
  return area;
}
function visibleOccupancy(recognized,slide,qa){
  const width=recognized.image_width,height=recognized.image_height,slideWidth=qa?.slideWidthEmu,slideHeight=qa?.slideHeightEmu;
  if(!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(slideWidth)||!Number.isFinite(slideHeight)||!Array.isArray(qa?.textBounds)||!Array.isArray(recognized.words))return null;
  const bodyText=(slide.elements||[]).flatMap(element=>[element.text,element.value,element.caption,element.description,element.takeaway,element.x_axis_label,element.y_axis_label,...(element.headers||[]),...(element.items||[]).flatMap(item=>typeof item==='string'?[item]:[item?.title,item?.value,item?.body,item?.detail]),...(element.rows||[]).flat(),...(element.nodes||[]).map(node=>node.label),...(element.steps||[]).flatMap(step=>typeof step==='string'?[step]:[step?.title,step?.detail])]).filter(value=>typeof value==='string'&&norm(value).length>=3).map(norm);
  const bodyBounds=qa.textBounds.filter(bound=>bound.text&&Number.isFinite(bound.x)&&bodyText.some(value=>norm(bound.text).includes(value)||value.includes(norm(bound.text)))).map(bound=>({x0:bound.x/slideWidth*width,y0:bound.y/slideHeight*height,x1:(bound.x+bound.w)/slideWidth*width,y1:(bound.y+bound.h)/slideHeight*height}));
  if(!bodyBounds.length)return null;
  const top=height*.2,bottom=height*.9,left=width*.04,right=width*.96,region=(right-left)*(bottom-top),boxes=[],bodyCopy=bodyText.join(''),bodyBottom=Math.max(...bodyBounds.map(bound=>bound.y1)),bodyLeft=Math.min(...bodyBounds.map(bound=>bound.x0)),bodyRight=Math.max(...bodyBounds.map(bound=>bound.x1));let overflowWords=0;
  for(const word of recognized.words){const b=word.bbox;if(!b||![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite))continue;const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,token=norm(word.text);if(cy<top||cy>bottom||cx<left||cx>right)continue;const inBodyBounds=bodyBounds.some(t=>cx>=t.x0&&cx<=t.x1&&cy>=t.y0&&cy<=t.y1);if(inBodyBounds){const x0=Math.max(left,b.x0),x1=Math.min(right,b.x1),y0=Math.max(top,b.y0),y1=Math.min(bottom,b.y1);if(x1>x0&&y1>y0)boxes.push({x0,y0,x1,y1});}else if(cy>bodyBottom+height*.015&&cx>=bodyLeft&&cx<=bodyRight&&(token.length>=2||/\p{Script=Han}/u.test(token))&&bodyCopy.includes(token))overflowWords++;}
  const centers=boxes.map(box=>(box.y0+box.y1)/2).sort((a,b)=>a-b),lines=[];for(const center of centers){const last=lines.at(-1);if(last&&Math.abs(center-last.center)<=height*.012)last.center=(last.center*last.count+center)/(++last.count);else lines.push({center,count:1});}
  return region>0?{ratio:Number((unionArea(boxes)/region).toFixed(4)),line_count:lines.length,overflow_word_count:overflowWords}:null;
}

/** OCR checks expected text, body-density evidence, and limited authored-text overflow in exported page images. It does not judge meaning or overall layout quality. */
export async function critiqueRenderedPages({presentationIR,pages,renderedQa,recognizerFactory=createTesseractRecognizer}){
  const slides=presentationIR.slides||[],imagePages=(pages||[]).filter(item=>item.format==='png'),byNumber=new Map(imagePages.map(item=>[Number(item.path.match(/page-(\d+)\.png$/i)?.[1]),item]));
  if(!imagePages.length)return{status:'not_rendered',method:'local_ocr_coverage',pages:[],limitations:['No rendered PNG pages were supplied; rendered-image checks were not run.','OCR does not establish factual accuracy, semantic image fit, aesthetic quality, or human approval.']};
  const language=slides.some(slide=>/[\u3400-\u9fff]/u.test(JSON.stringify(slide)))?'chi_sim+eng':'eng';
  let recognizer;
  try{recognizer=await recognizerFactory(language);}catch(error){return{status:'unavailable',method:'local_tesseract_ocr',language,pages:[],error:error.message,limitations:['Local OCR could not initialize; deck generation and structural QA remain independent of this screen.','OCR does not establish factual accuracy, semantic image fit, aesthetic quality, or human approval.']};}
  try{
    const results=[];
    for(let index=0;index<slides.length;index++){
      const slide=slides[index],number=index+1,image=byNumber.get(number),expected=expectedText(slide),qa=renderedQa?.slides?.[index];
      if(!image){results.push({slide_id:slide.slide_id,page:number,status:'missing_page_image',expected_text_items:expected.length,detected_text_items:0,coverage:null,ocr_confidence:null});continue;}
      let recognized;
      try{recognized=await recognizer.recognize(image.path);}catch(error){results.push({slide_id:slide.slide_id,page:number,status:'ocr_failed',expected_text_items:expected.length,detected_text_items:0,coverage:null,ocr_confidence:null,error:error.message});continue;}
      const visible=norm(recognized.text),matched=expected.filter(text=>visible.includes(norm(text)));
      const coverage=expected.length?Number((matched.length/expected.length).toFixed(3)):null,occupancy=visibleOccupancy(recognized,slide,qa);
      results.push({slide_id:slide.slide_id,page:number,status:coverage===null?'no_expected_text':coverage<0.6?'low_text_coverage':'text_detected',expected_text_items:expected.length,detected_text_items:matched.length,matched_text:matched,coverage,visible_text_occupancy_ratio:occupancy?.ratio??null,visible_text_line_count:occupancy?.line_count??null,body_text_overflow_word_count:occupancy?.overflow_word_count??null,ocr_confidence:Number.isFinite(recognized.confidence)?Number(recognized.confidence.toFixed(2)):null,image_sha256:image.sha256||null});
    }
    const missing=results.filter(item=>item.status==='missing_page_image').length,low=results.filter(item=>item.status==='low_text_coverage').length,failed=results.filter(item=>item.status==='ocr_failed').length;
    return{status:missing?'incomplete':failed?'partial':low?'review':'text_detected',method:'local_tesseract_ocr',language,pages:results,limitations:['OCR text coverage is a screening signal; low coverage can result from font, language, contrast, or recognition errors.','The overflow screen only catches recognized authored body words below matched text-box bounds; OCR errors, horizontal overflow, and overlap with another body box may escape it.','OCR never upgrades source, evidence, or claim verification.','Every rendered page still requires a named human visual decision.']};
  }finally{try{await recognizer.close?.();}catch{}}
}
