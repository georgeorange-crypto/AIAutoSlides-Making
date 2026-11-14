import {createTesseractRecognizer} from '../../src/document-extractors.mjs';

const norm=value=>String(value||'').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
function expectedText(slide){
  const values=[slide.title,slide.assertion_title,slide.role,...(slide.section_topics||[]).map(topic=>topic.title)];
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
  const bodyText=[...(slide.section_topics||[]).map(topic=>topic.title),(slide.elements||[]).flatMap(element=>[element.text,element.value,element.caption,element.description,element.takeaway,element.x_axis_label,element.y_axis_label,...(element.headers||[]),...(element.items||[]).flatMap(item=>typeof item==='string'?[item]:[item?.title,item?.value,item?.body,item?.detail]),...(element.rows||[]).flat(),...(element.nodes||[]).map(node=>node.label),...(element.steps||[]).flatMap(step=>typeof step==='string'?[step]:[step?.title,step?.detail])])].flat().filter(value=>typeof value==='string'&&norm(value).length>=3).map(norm);
  const allTextBounds=qa.textBounds.filter(bound=>bound.text&&[bound.x,bound.y,bound.w,bound.h].every(Number.isFinite)).map(bound=>({text:norm(bound.text),x0:bound.x/slideWidth*width,y0:bound.y/slideHeight*height,x1:(bound.x+bound.w)/slideWidth*width,y1:(bound.y+bound.h)/slideHeight*height}));
  const bodyBounds=allTextBounds.filter(bound=>bodyText.some(value=>bound.text.includes(value)));
  if(!bodyBounds.length)return null;
  const top=height*.2,bottom=height*.9,left=width*.04,right=width*.96,region=(right-left)*(bottom-top),boxes=[],overflowDirections={above:0,below:0,left:0,right:0};let overflowWords=0;
  for(const word of recognized.words){const b=word.bbox;if(!b||![b.x0,b.y0,b.x1,b.y1].every(Number.isFinite))continue;const cx=(b.x0+b.x1)/2,cy=(b.y0+b.y1)/2,token=norm(word.text);if(cy<top||cy>bottom||cx<left||cx>right)continue;const inBodyBounds=bodyBounds.some(t=>cx>=t.x0&&cx<=t.x1&&cy>=t.y0&&cy<=t.y1);if(inBodyBounds){const x0=Math.max(left,b.x0),x1=Math.min(right,b.x1),y0=Math.max(top,b.y0),y1=Math.min(bottom,b.y1);if(x1>x0&&y1>y0)boxes.push({x0,y0,x1,y1});continue;}if(!(token.length>=2||/\p{Script=Han}/u.test(token)))continue;const matchingBounds=bodyBounds.filter(bound=>token&&bound.text.includes(token));if(!matchingBounds.length)continue;const inMatchingTextBox=allTextBounds.some(bound=>bound.text.includes(token)&&cx>=bound.x0&&cx<=bound.x1&&cy>=bound.y0&&cy<=bound.y1);if(inMatchingTextBox)continue;const toleranceX=width*.015,toleranceY=height*.015,nearAuthoredBox=matchingBounds.some(bound=>cx>=bound.x0-toleranceX&&cx<=bound.x1+toleranceX&&cy>=bound.y0-toleranceY&&cy<=bound.y1+toleranceY);if(nearAuthoredBox)continue;const nearest=matchingBounds.map(bound=>({bound,distance:Math.max(bound.x0-cx,0,cx-bound.x1)+Math.max(bound.y0-cy,0,cy-bound.y1)})).sort((a,b)=>a.distance-b.distance)[0].bound,direction=cx<nearest.x0?'left':cx>nearest.x1?'right':cy<nearest.y0?'above':'below';overflowWords++;overflowDirections[direction]++;}
  const centers=boxes.map(box=>(box.y0+box.y1)/2).sort((a,b)=>a-b),lines=[];for(const center of centers){const last=lines.at(-1);if(last&&Math.abs(center-last.center)<=height*.012)last.center=(last.center*last.count+center)/(++last.count);else lines.push({center,count:1});}
  return region>0?{ratio:Number((unionArea(boxes)/region).toFixed(4)),line_count:lines.length,overflow_word_count:overflowWords,overflow_directions:overflowDirections}:null;
}

function titleTextOverflow(recognized,slide,qa){
  const title=String(slide.assertion_title||slide.title||''),width=recognized.image_width,height=recognized.image_height,slideWidth=qa?.slideWidthEmu,slideHeight=qa?.slideHeightEmu;
  if(!title||!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(slideWidth)||!Number.isFinite(slideHeight)||!Array.isArray(qa?.textBounds)||!Array.isArray(recognized.words))return{count:null,directions:null,reason:'title_geometry_or_ocr_missing'};
  const titleNorm=norm(title),titleHasHan=/\p{Script=Han}/u.test(title),titleTokens=new Set((title.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).map(norm)),bound=qa.textBounds.find(item=>item.text&&norm(item.text)===titleNorm&&[item.x,item.y,item.w,item.h].every(Number.isFinite));
  if(!bound)return{count:null,directions:null,reason:'title_text_box_missing'};
  const rect={x0:bound.x/slideWidth*width,y0:bound.y/slideHeight*height,x1:(bound.x+bound.w)/slideWidth*width,y1:(bound.y+bound.h)/slideHeight*height},toleranceX=width*.015,toleranceY=height*.015,directions={above:0,below:0,left:0,right:0},otherTextBounds=qa.textBounds.filter(item=>item!==bound&&item.text&&[item.x,item.y,item.w,item.h].every(Number.isFinite)).map(item=>({text:norm(item.text),x0:item.x/slideWidth*width,y0:item.y/slideHeight*height,x1:(item.x+item.w)/slideWidth*width,y1:(item.y+item.h)/slideHeight*height}));let matched=0;
  const rectDistance=(box,other)=>Math.max(other.x0-(box.x0+box.x1)/2,0,(box.x0+box.x1)/2-other.x1)+Math.max(other.y0-(box.y0+box.y1)/2,0,(box.y0+box.y1)/2-other.y1);
  for(const word of recognized.words){const box=word.bbox,token=norm(word.text);if(!box||![box.x0,box.y0,box.x1,box.y1].every(Number.isFinite)||box.x1<=box.x0||box.y1<=box.y0||Number.isFinite(word.confidence)&&word.confidence<35||token.length<2||!(titleTokens.has(token)||titleHasHan&&titleNorm.includes(token)))continue;if(otherTextBounds.some(other=>other.text.includes(token)&&rectDistance(box,other)<rectDistance(box,rect)))continue;const overlapsVerticalBand=box.y1>=rect.y0-toleranceY&&box.y0<=rect.y1+toleranceY,overlapsHorizontalBand=box.x1>=rect.x0-toleranceX&&box.x0<=rect.x1+toleranceX;if(!overlapsVerticalBand&&!overlapsHorizontalBand)continue;matched++;if(overlapsVerticalBand&&box.x0<rect.x0-toleranceX)directions.left++;if(overlapsVerticalBand&&box.x1>rect.x1+toleranceX)directions.right++;if(overlapsHorizontalBand&&box.y0<rect.y0-toleranceY)directions.above++;if(overlapsHorizontalBand&&box.y1>rect.y1+toleranceY)directions.below++;}
  return matched?{count:Object.values(directions).reduce((sum,value)=>sum+value,0),directions,reason:null}:{count:null,directions:null,reason:'title_words_not_recognized'};
}

function chartTextOverlaps(recognized,qa){
  if(!Number.isInteger(qa?.charts)||qa.charts===0)return{count:0,word_count:0,collisions:[]};
  const width=recognized.image_width,height=recognized.image_height,slideWidth=qa.slideWidthEmu,slideHeight=qa.slideHeightEmu,bounds=qa.chartBounds;
  if(!Number.isFinite(width)||!Number.isFinite(height)||!Number.isFinite(slideWidth)||!Number.isFinite(slideHeight)||!Array.isArray(bounds)||bounds.length!==qa.charts||bounds.some(box=>!box.ok||![box.x,box.y,box.w,box.h].every(Number.isFinite)))return{count:null,word_count:0,collisions:[]};
  const chartRects=bounds.map(box=>({x0:box.x/slideWidth*width,y0:box.y/slideHeight*height,x1:(box.x+box.w)/slideWidth*width,y1:(box.y+box.h)/slideHeight*height})),words=[];
  for(const word of recognized.words||[]){const box=word.bbox;if(!box||![box.x0,box.y0,box.x1,box.y1].every(Number.isFinite)||box.x1<=box.x0||box.y1<=box.y0||Number.isFinite(word.confidence)&&word.confidence<35)continue;const centerX=(box.x0+box.x1)/2,centerY=(box.y0+box.y1)/2;if(!chartRects.some(rect=>centerX>=rect.x0&&centerX<=rect.x1&&centerY>=rect.y0&&centerY<=rect.y1))continue;if(words.some(item=>item.text===String(word.text||'').normalize('NFKC').toLocaleLowerCase()&&Math.abs(item.x0-box.x0)<1&&Math.abs(item.y0-box.y0)<1&&Math.abs(item.x1-box.x1)<1&&Math.abs(item.y1-box.y1)<1))continue;words.push({text:String(word.text||''),x0:box.x0,y0:box.y0,x1:box.x1,y1:box.y1});}
  if(words.length<2)return{count:null,word_count:words.length,collisions:[]};
  const collisions=[];
  for(let i=0;i<words.length;i++)for(let j=i+1;j<words.length;j++){
    const a=words[i],b=words[j],overlapW=Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0),overlapH=Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0);if(overlapW<2||overlapH<2)continue;const overlapArea=overlapW*overlapH,smallerArea=Math.min((a.x1-a.x0)*(a.y1-a.y0),(b.x1-b.x0)*(b.y1-b.y0)),ratio=overlapArea/smallerArea;if(ratio>=0.35)collisions.push({text_a:a.text,text_b:b.text,overlap_ratio:Number(ratio.toFixed(3)),bounds:{x0:Math.max(a.x0,b.x0),y0:Math.max(a.y0,b.y0),x1:Math.min(a.x1,b.x1),y1:Math.min(a.y1,b.y1)}});
  }
  return{count:collisions.length,word_count:words.length,collisions};
}

/** OCR checks expected text, body-density evidence, and authored-text overflow in exported page images. It does not judge meaning or overall layout quality. */
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
      const coverage=expected.length?Number((matched.length/expected.length).toFixed(3)):null,occupancy=visibleOccupancy(recognized,slide,qa),titleOverflow=titleTextOverflow(recognized,slide,qa);
      const chartOverlaps=chartTextOverlaps(recognized,qa);
      results.push({slide_id:slide.slide_id,page:number,status:coverage===null?'no_expected_text':coverage<0.6?'low_text_coverage':'text_detected',expected_text_items:expected.length,detected_text_items:matched.length,matched_text:matched,coverage,visible_text_occupancy_ratio:occupancy?.ratio??null,visible_text_line_count:occupancy?.line_count??null,body_text_overflow_word_count:occupancy?.overflow_word_count??null,body_text_overflow_directions:occupancy?.overflow_directions??null,title_text_overflow_word_count:titleOverflow.count,title_text_overflow_directions:titleOverflow.directions,title_text_overflow_reason:titleOverflow.reason,chart_text_word_count:chartOverlaps.word_count,chart_text_overlap_count:chartOverlaps.count,chart_text_overlaps:chartOverlaps.collisions,ocr_confidence:Number.isFinite(recognized.confidence)?Number(recognized.confidence.toFixed(2)):null,image_sha256:image.sha256||null});
    }
    const missing=results.filter(item=>item.status==='missing_page_image').length,low=results.filter(item=>item.status==='low_text_coverage').length,failed=results.filter(item=>item.status==='ocr_failed').length;
    return{status:missing?'incomplete':failed?'partial':low?'review':'text_detected',method:'local_tesseract_ocr',language,pages:results,limitations:['OCR text coverage is a screening signal; low coverage can result from font, language, contrast, or recognition errors.','The overflow screen matches OCR words to authored body text and checks all four text-box edges with a 1.5% page-size tolerance. OCR errors, clipping beyond the slide canvas, and spill that cannot be attributed to a specific authored box may escape it.','OCR never upgrades source, evidence, or claim verification.','Every rendered page still requires a named human visual decision.']};
  }finally{try{await recognizer.close?.();}catch{}}
}
