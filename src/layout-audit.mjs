function geometry(shapeXml){
  const off=shapeXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"/),ext=shapeXml.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
  if(!off||!ext)return null;
  return{x:Number(off[1]),y:Number(off[2]),w:Number(ext[1]),h:Number(ext[2])};
}
function autofitFontScale(shapeXml){
  const autofit=shapeXml.match(/<a:normAutofit\b([^>]*)\/?\s*>/),match=autofit?.[1].match(/\bfontScale="(\d+)"/);
  if(!match)return 1;
  const scale=Number(match[1]);
  return Number.isFinite(scale)&&scale>=0&&scale<=100000?scale/100000:0;
}
function fontSizes(shapeXml){const scale=autofitFontScale(shapeXml);return [...shapeXml.matchAll(/<a:(?:rPr|defRPr|endParaRPr)\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100*scale);}
function textRunFontSizes(shapeXml){
  const scale=autofitFontScale(shapeXml),sizes=[],unmeasured=[];
  for(const paragraph of shapeXml.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)){
    const paragraphDefault=paragraph[1].match(/<a:pPr\b[^>]*>([\s\S]*?)<\/a:pPr>/)?.[1].match(/<a:defRPr\b[^>]*\bsz="(\d+)"/)?.[1];
    const runs=[...paragraph[1].matchAll(/<a:(r|fld)\b[^>]*>([\s\S]*?)<\/a:\1>/g)].filter(run=>/<a:t\b/.test(run[2]));
    for(const run of runs){
      const own=run[2].match(/<a:rPr\b[^>]*\bsz="(\d+)"/)?.[1],size=own||paragraphDefault,text=textContent(run[2]);
      if(size)sizes.push(Number(size)/100*scale);else unmeasured.push(text);
    }
    if(!runs.length&&/<a:t\b/.test(paragraph[1]))unmeasured.push(textContent(paragraph[1]));
  }
  return{sizes,unmeasured};
}
function fontFaces(shapeXml){return [...shapeXml.matchAll(/<a:latin\b[^>]*\btypeface="([^"]*)"/g)].map(match=>match[1]).filter(Boolean);}
function textContent(shapeXml){return [...shapeXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>match[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'")).join('');}
function visualGroupName(shapeXml){return shapeXml.match(/<p:cNvPr\b[^>]*\bname="(AIAutoSlidesVisualGroup:[^"]+)"/)?.[1]||null;}
function rectangleUnionArea(rectangles){
  const xs=[...new Set(rectangles.flatMap(rect=>[rect.x,rect.x+rect.w]))].sort((a,b)=>a-b);let area=0;
  for(let i=0;i<xs.length-1;i++){const left=xs[i],right=xs[i+1];if(right<=left)continue;const intervals=rectangles.filter(rect=>rect.x<right&&rect.x+rect.w>left).map(rect=>[rect.y,rect.y+rect.h]).sort((a,b)=>a[0]-b[0]);let covered=0,start=null,end=null;for(const [top,bottom] of intervals){if(start===null){start=top;end=bottom;}else if(top<=end)end=Math.max(end,bottom);else{covered+=end-start;start=top;end=bottom;}}if(start!==null)covered+=end-start;area+=(right-left)*covered;}
  return area;
}
function overlap(a,b){return Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>6000&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>6000;}

export function auditTextLayout(xml,slideWidth,slideHeight,smallTextThresholdPt=14){
  const elements=[...xml.matchAll(/<p:(sp|pic|graphicFrame|cxnSp)>([\s\S]*?)<\/p:\1>/g)].map((match,index)=>({index:index+1,type:match[1],xml:match[2]}));
  const elementBounds=elements.map(item=>{const g=geometry(item.xml);return g?{ok:g.x>=0&&g.y>=0&&g.x+g.w<=slideWidth&&g.y+g.h<=slideHeight,element:item.type,index:item.index,...g}:{ok:false,element:item.type,index:item.index,reason:'missing geometry'};});
  const groupMap=new Map();
  for(const item of elements){const name=visualGroupName(item.xml);if(!name)continue;const current=groupMap.get(name)||{group_id:name.slice('AIAutoSlidesVisualGroup:'.length),kind:name.split(':').at(-1),member_count:0,unmeasured_member_count:0,ok:true,x:Infinity,y:Infinity,right:-Infinity,bottom:-Infinity,rectangles:[]};current.member_count++;const g=geometry(item.xml);if(!g){current.unmeasured_member_count++;current.ok=false;}else{current.rectangles.push(g);current.x=Math.min(current.x,g.x);current.y=Math.min(current.y,g.y);current.right=Math.max(current.right,g.x+g.w);current.bottom=Math.max(current.bottom,g.y+g.h);if(g.x<0||g.y<0||g.x+g.w>slideWidth||g.y+g.h>slideHeight)current.ok=false;}groupMap.set(name,current);}
  const visualGroupBounds=[...groupMap.values()].map(group=>{if(group.member_count===group.unmeasured_member_count)return{group_id:group.group_id,kind:group.kind,ok:false,member_count:group.member_count,unmeasured_member_count:group.unmeasured_member_count};const boundsArea=(group.right-group.x)*(group.bottom-group.y),unionArea=rectangleUnionArea(group.rectangles);return{group_id:group.group_id,kind:group.kind,ok:group.ok,member_count:group.member_count,unmeasured_member_count:group.unmeasured_member_count,x:group.x,y:group.y,w:group.right-group.x,h:group.bottom-group.y,area_ratio:unionArea/(slideWidth*slideHeight),bounds_area_ratio:boundsArea/(slideWidth*slideHeight)};});
  const shapes=[...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((match,index)=>({index:index+1,xml:match[1]})).filter(item=>/<a:t>/.test(item.xml));
  const textBounds=shapes.map(item=>{const g=geometry(item.xml),measurement=textRunFontSizes(item.xml),fontSizesPt=measurement.sizes;return g?{ok:g.x>=0&&g.y>=0&&g.x+g.w<=slideWidth&&g.y+g.h<=slideHeight,text:textContent(item.xml),min_font_size_pt:fontSizesPt.length?Math.min(...fontSizesPt):null,unmeasured_run_count:measurement.unmeasured.length,...g}: {ok:false,text:textContent(item.xml),min_font_size_pt:null,unmeasured_run_count:0,reason:'missing geometry'};});
  const overlaps=[];
  for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){
    const a=geometry(shapes[i].xml),b=geometry(shapes[j].xml);
    if(a&&b&&overlap(a,b))overlaps.push({shape_a:shapes[i].index,shape_b:shapes[j].index,text_a:[...shapes[i].xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m=>m[1]).join(''),text_b:[...shapes[j].xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m=>m[1]).join(''),area_emu2:(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*(Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y))});
  }
  const smallText=[];
  const unmeasuredText=[];
  const unmeasuredFonts=[];
  shapes.forEach(item=>{const g=geometry(item.xml);if(!g)return;const measurement=textRunFontSizes(item.xml),sizes=measurement.sizes,faces=fontFaces(item.xml),text=textContent(item.xml),location={x:g.x,y:g.y,w:g.w,h:g.h};if(!sizes.length||measurement.unmeasured.length)unmeasuredText.push({shape:item.index,text,unmeasured_run_count:measurement.unmeasured.length,...location});if(!faces.length&&/[\p{L}\p{N}]/u.test(text))unmeasuredFonts.push({shape:item.index,text,...location});if(sizes.length){const min=Math.min(...sizes);if(min<smallTextThresholdPt)smallText.push({shape:item.index,min_font_size_pt:min,text,...location});}});
  const tableFonts=[];
  elements.filter(item=>item.type==='graphicFrame'&&/<a:tbl\b/.test(item.xml)).forEach(item=>{const g=geometry(item.xml);if(!g)return;const measurement=textRunFontSizes(item.xml),text=textContent(item.xml),faces=fontFaces(item.xml);tableFonts.push(...faces);if(!measurement.sizes.length||measurement.unmeasured.length)unmeasuredText.push({shape:item.index,element:'table',text,unmeasured_run_count:measurement.unmeasured.length,...g});if(text&&/[\p{L}\p{N}]/u.test(text)&&!faces.length)unmeasuredFonts.push({shape:item.index,element:'table',text,...g});if(measurement.sizes.length){const min=Math.min(...measurement.sizes);if(min<smallTextThresholdPt)smallText.push({shape:item.index,element:'table',min_font_size_pt:min,text,...g});}});
  elements.filter(item=>item.type==='graphicFrame'&&!/<a:tbl\b/.test(item.xml)).forEach(item=>{const g=geometry(item.xml);if(!g)return;const sizes=fontSizes(item.xml);if(sizes.length){const min=Math.min(...sizes);if(min<smallTextThresholdPt)smallText.push({shape:item.index,element:item.type,min_font_size_pt:min,...g});}});
  return{textBounds,elementBounds,visualGroupBounds,overlaps,smallText,unmeasuredText,fontFaces:[...new Set([...shapes.flatMap(item=>fontFaces(item.xml)),...tableFonts])],unmeasuredFonts,editableTextShapes:shapes.length};
}

/** Inspect chart-part text styles, which are not stored in the slide's graphicFrame XML. */
export function auditChartText(xml,smallTextThresholdPt=14){
  const smallText=[],unmeasuredText=[],unmeasuredFonts=[],faces=[];
  const styles=[...xml.matchAll(/<c:txPr\b[^>]*>([\s\S]*?)<\/c:txPr>/g)];
  if(!styles.length){
    unmeasuredText.push({shape:1,element:'chart',text:'chart text styles are absent'});
    unmeasuredFonts.push({shape:1,element:'chart',text:'chart text styles are absent'});
  }
  styles.forEach((match,index)=>{
    const style=match[1],label=`chart text style ${index+1}`,sizes=fontSizes(style),families=fontFaces(style);
    faces.push(...families);
    if(!sizes.length)unmeasuredText.push({shape:index+1,element:'chart',text:label});
    if(!families.length)unmeasuredFonts.push({shape:index+1,element:'chart',text:label});
    if(sizes.length&&Math.min(...sizes)<smallTextThresholdPt)smallText.push({shape:index+1,element:'chart',min_font_size_pt:Math.min(...sizes),text:label});
  });
  return{smallText,unmeasuredText,unmeasuredFonts,fontFaces:[...new Set(faces)],textStyleCount:styles.length};
}
