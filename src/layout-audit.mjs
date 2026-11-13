function geometry(shapeXml){
  const off=shapeXml.match(/<a:off x="(-?\d+)" y="(-?\d+)"/),ext=shapeXml.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
  if(!off||!ext)return null;
  return{x:Number(off[1]),y:Number(off[2]),w:Number(ext[1]),h:Number(ext[2])};
}
function fontSizes(shapeXml){return [...shapeXml.matchAll(/<a:(?:rPr|defRPr|endParaRPr)\b[^>]*\bsz="(\d+)"/g)].map(m=>Number(m[1])/100);}
function textContent(shapeXml){return [...shapeXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>match[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'")).join('');}
function overlap(a,b){return Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>6000&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>6000;}

export function auditTextLayout(xml,slideWidth,slideHeight,smallTextThresholdPt=12){
  const elements=[...xml.matchAll(/<p:(sp|pic|graphicFrame|cxnSp)>([\s\S]*?)<\/p:\1>/g)].map((match,index)=>({index:index+1,type:match[1],xml:match[2]}));
  const elementBounds=elements.map(item=>{const g=geometry(item.xml);return g?{ok:g.x>=0&&g.y>=0&&g.x+g.w<=slideWidth&&g.y+g.h<=slideHeight,element:item.type,index:item.index,...g}:{ok:false,element:item.type,index:item.index,reason:'missing geometry'};});
  const shapes=[...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((match,index)=>({index:index+1,xml:match[1]})).filter(item=>/<a:t>/.test(item.xml));
  const textBounds=shapes.map(item=>{const g=geometry(item.xml);return g?{ok:g.x>=0&&g.y>=0&&g.x+g.w<=slideWidth&&g.y+g.h<=slideHeight,text:textContent(item.xml),...g}: {ok:false,text:textContent(item.xml),reason:'missing geometry'};});
  const overlaps=[];
  for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){
    const a=geometry(shapes[i].xml),b=geometry(shapes[j].xml);
    if(a&&b&&overlap(a,b))overlaps.push({shape_a:shapes[i].index,shape_b:shapes[j].index,text_a:[...shapes[i].xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m=>m[1]).join(''),text_b:[...shapes[j].xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m=>m[1]).join(''),area_emu2:(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*(Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y))});
  }
  const smallText=[];
  const unmeasuredText=[];
  shapes.forEach(item=>{const g=geometry(item.xml);if(!g)return;const sizes=fontSizes(item.xml),text=textContent(item.xml),location={x:g.x,y:g.y,w:g.w,h:g.h};if(!sizes.length){unmeasuredText.push({shape:item.index,text, ...location});return;}const min=Math.min(...sizes);if(min<smallTextThresholdPt)smallText.push({shape:item.index,min_font_size_pt:min,text,...location});});
  elements.filter(item=>item.type==='graphicFrame').forEach(item=>{const g=geometry(item.xml);if(!g)return;const sizes=fontSizes(item.xml);if(!sizes.length)return;const min=Math.min(...sizes);if(min<smallTextThresholdPt)smallText.push({shape:item.index,element:item.type,min_font_size_pt:min,...g});});
  return{textBounds,elementBounds,overlaps,smallText,unmeasuredText,editableTextShapes:shapes.length};
}
