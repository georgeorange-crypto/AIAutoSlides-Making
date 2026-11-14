export function relativeLuminance(hex){
 if(typeof hex!=='string'||!/^[0-9A-Fa-f]{6}$/.test(hex))throw new Error(`Expected six-digit RGB color, got ${hex}`);
 const c=hex.match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
 return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
export function contrastRatio(a,b){const x=relativeLuminance(a),y=relativeLuminance(b);return(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
export function auditThemeContrast(theme,minimum=4.5){
 const pairs=[];
 for(const bg of ['background','surface','surfaceAlt'])for(const fg of ['title','text','muted','accent','accent2','warning'])pairs.push({background:bg,foreground:fg,ratio:Number(contrastRatio(theme[bg],theme[fg]).toFixed(2))});
 return{minimumContrastRatio:Math.min(...pairs.map(p=>p.ratio)),pairsBelowMinimum:pairs.filter(p=>p.ratio<minimum),pairs};
}

function geometry(xml){const off=xml.match(/<a:off x="(-?\d+)" y="(-?\d+)"/),ext=xml.match(/<a:ext cx="(\d+)" cy="(\d+)"/);return off&&ext?{x:Number(off[1]),y:Number(off[2]),w:Number(ext[1]),h:Number(ext[2])}:null;}
function solidColor(xml,{baseColor=null}={}){const fill=xml.match(/<a:solidFill>([\s\S]*?)<\/a:solidFill>/);if(!fill)return null;const color=fill[1].match(/<a:srgbClr val="([0-9A-Fa-f]{6})"/);if(!color||/<a:(?:tint|shade|lumMod|lumOff)\b/.test(fill[1]))return null;const hex=color[1].toUpperCase(),alpha=fill[1].match(/<a:alpha val="(\d+)"/);if(!alpha)return hex;if(!baseColor)return null;const opacity=Math.max(0,Math.min(100000,Number(alpha[1])))/100000;return hex.match(/../g).map((part,index)=>Math.round(parseInt(part,16)*opacity+parseInt(baseColor.slice(index*2,index*2+2),16)*(1-opacity)).toString(16).padStart(2,'0')).join('').toUpperCase();}
function shapeFill(xml,slideBackground){const props=xml.match(/<p:spPr\b[^>]*>([\s\S]*?)<\/p:spPr>/);if(!props)return{kind:'transparent'};if(/<a:noFill\s*\/>/.test(props[1]))return{kind:'transparent'};const color=solidColor(props[1],{baseColor:slideBackground});if(color)return{kind:'solid',color};if(/<a:(?:solidFill|gradFill|blipFill|pattFill)\b/.test(props[1]))return{kind:'unknown'};return{kind:'transparent'};}
function text(xml){return[...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>match[1].replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'")).join('');}
function runs(xml){return[...xml.matchAll(/<a:(r|fld)\b[^>]*>([\s\S]*?)<\/a:\1>/g)].map(match=>match[2]).filter(run=>/<a:t>/.test(run));}
function runColor(run,shapeXml){const properties=run.match(/<a:rPr\b[^>]*>([\s\S]*?)<\/a:rPr>/),fallback=shapeXml.match(/<a:defRPr\b[^>]*>([\s\S]*?)<\/a:defRPr>/);return solidColor(properties?.[1]||fallback?.[1]||'');}
function contains(outer,inner){return outer&&inner&&outer.x<=inner.x&&outer.y<=inner.y&&outer.x+outer.w>=inner.x+inner.w&&outer.y+outer.h>=inner.y+inner.h;}

/** Audit actual OOXML text-run colors against the visible solid background when it can be determined. */
export function auditTextContrast(slideXml,{slideBackground=null,minimum=4.5}={}){
 const explicitBackground=solidColor(slideXml.match(/<p:bg\b[^>]*>([\s\S]*?)<\/p:bg>/)?.[1]||''),fallbackBackground=explicitBackground||slideBackground,elements=[...slideXml.matchAll(/<p:(sp|pic|graphicFrame|cxnSp)>([\s\S]*?)<\/p:\1>/g)].map(match=>({type:match[1],xml:match[2],bounds:geometry(match[2]),fill:match[1]==='sp'?shapeFill(match[2],fallbackBackground):{kind:'unknown'}}));
 const violations=[],unmeasured=[];let checked=0,minimumRatio=Infinity;
 elements.forEach((element,index)=>{
  if(element.type!=='sp'||!/<a:t>/.test(element.xml))return;
  const label=text(element.xml),box=element.bounds,textRuns=runs(element.xml);if(!box){unmeasured.push({shape:index+1,text:label,reason:'text geometry is unavailable'});return;}
  const backgrounds=new Set();let backgroundUnknown=false;
  if(element.fill.kind==='solid')backgrounds.add(element.fill.color);
  else if(element.fill.kind==='unknown')backgroundUnknown=true;
  for(const previous of elements.slice(0,index)){
   if(previous.type==='cxnSp'||!previous.bounds||!contains(previous.bounds,box))continue;
   if(previous.type==='sp'&&previous.fill.kind==='transparent')continue;
   if(previous.type==='sp'&&previous.fill.kind==='solid')backgrounds.add(previous.fill.color);
   else backgroundUnknown=true;
  }
  if(fallbackBackground)backgrounds.add(fallbackBackground);
  if(backgroundUnknown){unmeasured.push({shape:index+1,text:label,reason:'text overlaps an image or unsupported fill, so its actual background is unknown'});return;}
  if(!backgrounds.size){unmeasured.push({shape:index+1,text:label,reason:'slide background color is unavailable'});return;}
  if(!textRuns.length){unmeasured.push({shape:index+1,text:label,reason:'text run formatting is unavailable'});return;}
  for(const run of textRuns){const runText=text(run),foreground=runColor(run,element.xml);if(!foreground){unmeasured.push({shape:index+1,text:runText||label,reason:'text foreground is inherited or uses an unsupported OOXML color'});continue;}const comparisons=[...backgrounds].map(background=>({background,ratio:Number(contrastRatio(foreground,background).toFixed(2))})),worst=comparisons.reduce((left,right)=>left.ratio<=right.ratio?left:right);checked++;minimumRatio=Math.min(minimumRatio,worst.ratio);if(worst.ratio<minimum)violations.push({shape:index+1,text:runText||label,foreground,background:worst.background,ratio:worst.ratio,backgrounds:comparisons,minimum});}
 });
 return{status:violations.length?'fail':unmeasured.length?'incomplete':'pass',minimum,minimumContrastRatio:Number.isFinite(minimumRatio)?minimumRatio:null,checked_text_runs:checked,violations,unmeasured};
}
