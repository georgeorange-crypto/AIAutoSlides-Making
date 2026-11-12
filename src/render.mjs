import fs from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';

const W = 13.333, H = 7.5;
const Shape = { roundRect: 'roundRect', line: 'line', ellipse: 'ellipse', rect: 'rect' };

function txt(slide, text, opts) {
  slide.addText(String(text), {margin:0, breakLine:false, valign:'mid', ...opts});
}
function rect(slide, opts) { slide.addShape(Shape.roundRect, {radius:0.15,line:{color:opts.fill?.color ?? 'FFFFFF',transparency:100}, ...opts}); }
function line(slide, x1,y1,x2,y2,color) { slide.addShape(Shape.line,{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color,width:1.1}}); }
function titleSize(text) { const n=[...text].length; return n>85?25:n>60?29:n>39?34:40; }
function addBackground(s,t) {s.background={color:t.background};}
function addTop(s,d,t) {
  txt(s, (d.kicker||'AI AUTO SLIDES').toUpperCase(), {x:0.74,y:0.37,w:10.5,h:0.30,fontFace:t.bodyFontFace,fontSize:10.2,bold:true,color:t.accent,charSpacing:1.5});
  line(s,0.74,0.84,12.58,0.84,t.line);
}
function addTitle(s,d,t,options={}) {
  const f=titleSize(d.title);
  txt(s,d.title,{x:0.74,y:1.08,w:11.83,h:options.height??1.24,fontFace:t.headFontFace,fontSize:f,bold:true,color:t.title,breakLine:false,valign:'top',fit:'shrink'});
}
function addFooter(s,index,total,d,ledger,t,meta) {
  line(s,0.74,7.02,12.58,7.02,t.line);
  const e=(d.evidence_ids||[]).map(id=>ledger.get(id)?.label||id).join(' · ');
  const foot=e?`Evidence: ${e}`:'No source IDs on this slide';
  txt(s,foot,{x:0.74,y:7.09,w:9.6,h:0.20,fontFace:t.bodyFontFace,fontSize:7.9,color:t.muted,fit:'shrink'});
  txt(s,String(meta.status||'DRAFT'),{x:10.05,y:7.09,w:1.72,h:0.20,fontFace:t.bodyFontFace,fontSize:7.8,color:t.muted,align:'right',fit:'shrink'});
  txt(s,`${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`,{x:11.98,y:7.08,w:0.60,h:0.22,fontFace:t.bodyFontFace,fontSize:8.1,bold:true,color:t.muted,align:'right'});
}
function panel(s,x,y,w,h,t,alt=false) {
  rect(s,{x,y,w,h,rectRadius:0.16,radius:0.15,fill:{color:alt?t.surfaceAlt:t.surface},line:{color:t.line,width:0.6}});
}
function body(s,d,t,y=2.60,fs=20) {
  (d.body||[]).slice(0,4).forEach((b,i)=>txt(s,b,{x:0.83,y:y+i*0.84,w:11.4,h:0.69,fontFace:t.bodyFontFace,fontSize:fs,color:t.text,valign:'top',fit:'shrink'}));
}
function cover(s,d,t,meta) {
  // Bold editorial cover, editable vector/shape background.
  rect(s,{x:9.88,y:-0.65,w:5.1,h:8.95,rectRadius:0,fill:{color:t.surfaceAlt},line:{color:t.surfaceAlt,transparency:100},rotate:12});
  s.addShape(Shape.ellipse,{x:10.40,y:1.14,w:2.0,h:2.0,line:{color:t.accent,width:3},fill:{color:t.background,transparency:100}});
  s.addShape(Shape.ellipse,{x:10.96,y:3.57,w:1.03,h:1.03,line:{color:t.accent2,width:3},fill:{color:t.background,transparency:100}});
  txt(s,(d.kicker||'RESEARCH PRESENTATION').toUpperCase(),{x:0.85,y:0.71,w:9.5,h:0.34,fontFace:t.bodyFontFace,fontSize:12,bold:true,color:t.accent,charSpacing:1.5});
  txt(s,d.title,{x:0.85,y:1.66,w:9.1,h:2.43,fontFace:t.headFontFace,fontSize:52,bold:true,color:t.title,valign:'top',fit:'shrink'});
  (d.body||[]).slice(0,2).forEach((b,i)=>txt(s,b,{x:0.89,y:4.54+i*0.55,w:8.5,h:0.49,fontFace:t.bodyFontFace,fontSize:20-i*3,color:i===0?t.text:t.muted,fit:'shrink'}));
  line(s,0.89,6.26,8.8,6.26,t.line);
  txt(s,meta.subtitle||'',{x:0.89,y:6.42,w:10.6,h:0.31,fontSize:13,color:t.muted,fontFace:t.bodyFontFace,fit:'shrink'});
}
function statement(s,d,t) {
  addTop(s,d,t);
  // The claim itself takes the stage; short supporting evidence below.
  const hasVisual=(d.visuals||[]).length>0;
  const fs=hasVisual?37:d.title.length>90?35:d.title.length>65?42:49;
  txt(s,d.title,{x:0.77,y:1.45,w:hasVisual?6.0:11.4,h:2.36,fontFace:t.headFontFace,fontSize:fs,bold:true,color:t.title,valign:'mid',fit:'shrink'});
  line(s,0.80,4.24,4.50,4.24,t.accent);
  if(d.layout==='two-column-contrast' && (d.body||[]).length>=2){
    panel(s,0.80,4.52,5.55,1.70,t);panel(s,6.70,4.52,5.55,1.70,t,true);
    (d.body||[]).slice(0,2).forEach((b,i)=>txt(s,b,{x:1.04+i*5.9,y:4.83,w:5.05,h:1.10,fontFace:t.bodyFontFace,fontSize:19,color:t.text,valign:'mid',fit:'shrink'}));
    return;
  }
  (d.body||[]).slice(0,2).forEach((b,i)=>txt(s,b,{x:0.80,y:4.65+i*0.89,w:hasVisual?5.9:11.35,h:0.74,fontFace:t.bodyFontFace,fontSize:20,color:i===0?t.text:t.muted,valign:'top',fit:'shrink'}));
}
function metrics(s,d,t) {
  addTop(s,d,t);addTitle(s,d,t);
  const ms=d.metrics||[],gap=0.22,x=0.75,available=11.82,w=(available-gap*(ms.length-1))/ms.length;
  ms.forEach((m,i)=>{
    const px=x+i*(w+gap);
    panel(s,px,2.93,w,2.74,t);
    s.addShape(Shape.rect,{x:px,y:2.93,w:0.075,h:2.74,line:{color:t.accent,transparency:100},fill:{color:i===ms.length-1?t.warning:t.accent}});
    txt(s,m.label,{x:px+0.28,y:3.22,w:w-0.50,h:0.53,fontSize:15.5,fontFace:t.bodyFontFace,color:t.muted,valign:'top',fit:'shrink'});
    txt(s,m.value,{x:px+0.28,y:4.00,w:w-0.51,h:0.93,fontSize:Math.min(37, w*11),fontFace:t.headFontFace,bold:true,color:i===ms.length-1?t.warning:t.accent2,fit:'shrink'});
    txt(s,m.detail||'',{x:px+0.28,y:5.16,w:w-0.55,h:0.30,fontSize:12.5,fontFace:t.bodyFontFace,color:t.text,fit:'shrink'});
  });
  txt(s,'Metrics must be traceable to the evidence ledger; do not treat unverified values as publication-ready.',{x:0.80,y:6.11,w:11.6,h:0.30,fontSize:12.2,fontFace:t.bodyFontFace,color:t.muted,fit:'shrink'});
}
function chart(s,d,t,pptx) {
  addTop(s,d,t);addTitle(s,d,t);
  const c=d.chart;
  panel(s,0.75,2.61,11.82,3.46,t);
  const scatter=['scatter','cdf'].includes(c.kind);
  const series=c.series||[{name:c.series_name||'Series',values:c.values}];
  const data=scatter?[{name:'X-Axis',values:c.x_values},...series.map(v=>({name:v.name,values:v.values}))]:series.map(v=>({name:v.name,labels:c.categories,values:v.values}));
  const chartType=c.kind==='line'?pptx.ChartType.line:scatter?pptx.ChartType.scatter:pptx.ChartType.bar;
  s.addChart(chartType,data,{
    x:1.03,y:2.86,w:11.20,h:2.91,
    catAxisLabelFontFace:t.bodyFontFace,catAxisLabelFontSize:13.5,
    valAxisLabelFontFace:t.bodyFontFace,valAxisLabelFontSize:11.5,
    catAxisLabelColor:t.text,valAxisLabelColor:t.text,
    catAxisLineColor:t.muted,valAxisLineColor:t.muted,
    showLegend:series.length>1,legendPos:'b',legendColor:t.text,showValue:!scatter,showTitle:false,showBorder:false,
    showCatName:false,showSerName:false,
    dataLabelPosition:'outEnd',dataLabelColor:t.text,dataLabelFormatCode:'0.###',
    chartColors:[t.accent,t.accent2,t.warning,t.text,'6A7D90','8757A5'],valGridLine:{color:t.line,width:0.6},
    grouping:c.kind==='line'?'standard':'clustered',barDir:'col',
    valAxisMinVal:c.kind==='cdf'?0:undefined,valAxisMaxVal:c.kind==='cdf'?1:undefined,
    lineDataSymbol:c.kind==='line'||c.kind==='scatter'?'circle':'none',lineDataSymbolSize:6,lineSize:c.kind==='cdf'?2.5:c.kind==='scatter'?0:2.5
  });
  txt(s,c.y_axis_label||c.unit,{x:0.91,y:2.43,w:4.0,h:0.22,fontFace:t.bodyFontFace,fontSize:10.5,color:t.muted,fit:'shrink'});
  if(scatter&&c.x_axis_label)txt(s,c.x_axis_label,{x:4.10,y:5.83,w:4.8,h:0.21,fontFace:t.bodyFontFace,fontSize:9.5,color:t.muted,align:'center',fit:'shrink'});
  if(d.assertion_title&&d.assertion_title!==d.title)txt(s,d.assertion_title,{x:0.86,y:6.18,w:11.5,h:0.30,fontFace:t.bodyFontFace,fontSize:13.4,bold:true,color:t.text,fit:'shrink'});
  if((d.body||[])[0])txt(s,d.body[0],{x:0.86,y:d.assertion_title&&d.assertion_title!==d.title?6.51:6.24,w:11.5,h:0.28,fontFace:t.bodyFontFace,fontSize:11.4,color:t.muted,fit:'shrink'});
}
function process(s,d,t) {
  addTop(s,d,t);addTitle(s,d,t);
  const steps=d.steps||[],left=0.75,right=12.55,gap=0.18,total=right-left,w=(total-(steps.length-1)*gap)/steps.length;
  steps.forEach((st,i)=>{
    const x=left+i*(w+gap);
    panel(s,x,3.00,w,1.90,t,i%2===1);
    txt(s,`${String(i+1).padStart(2,'0')}`,{x:x+0.2,y:3.20,w:w-0.4,h:0.35,fontFace:t.headFontFace,fontSize:14,bold:true,color:t.accent});
    txt(s,st,{x:x+0.2,y:3.69,w:w-0.37,h:0.83,fontFace:t.bodyFontFace,fontSize:Math.min(20,st.length>15?16:20),color:t.text,bold:true,fit:'shrink'});
    if(i<steps.length-1) txt(s,'→',{x:x+w-0.01,y:3.65,w:gap+0.11,h:0.4,color:t.accent,fontSize:20,bold:true,align:'center'});
  });
  txt(s,(d.body||[])[0]||'',{x:0.82,y:5.55,w:11.55,h:0.68,fontFace:t.bodyFontFace,fontSize:17,color:t.muted,valign:'top',fit:'shrink'});
}
function bullets(s,d,t) {
  addTop(s,d,t);addTitle(s,d,t);
  const list=d.body||[];
  list.forEach((v,i)=>{
    const h=list.length>4?0.72:0.88,y=2.67+i*(h+0.14);
    panel(s,0.77,y,11.73,h,t,i%2===1);
    txt(s,`${String(i+1).padStart(2,'0')}`,{x:1.00,y:y+0.12,w:0.65,h:h-0.24,fontSize:16.5,bold:true,fontFace:t.headFontFace,color:t.accent});
    txt(s,v,{x:1.77,y:y+0.09,w:10.30,h:h-0.17,fontSize:20,fontFace:t.bodyFontFace,color:t.text,fit:'shrink'});
  });
}
function closing(s,d,t) {
  addTop(s,d,t);
  txt(s,d.title,{x:0.83,y:1.63,w:11.41,h:2.26,fontFace:t.headFontFace,fontSize:50,bold:true,color:t.title,fit:'shrink'});
  line(s,0.83,4.22,6.8,4.22,t.accent);
  body(s,d,t,4.60,21);
  txt(s,'DISCUSS / DECIDE / ACT',{x:0.86,y:6.50,w:9.2,h:0.22,fontFace:t.bodyFontFace,fontSize:11.5,bold:true,charSpacing:1.3,color:t.accent});
}

export async function generatePresentation(deck,evidence,theme,outputPath,assets=new Map()) {
  const pptx=new pptxgen();
  pptx.layout='LAYOUT_WIDE';
  pptx.author='AIAutoSlides Making';
  pptx.subject='Evidence-first editable presentation';
  pptx.title=deck.meta.title;
  pptx.company='AIAutoSlides';
  pptx.lang='en-US';
  pptx.theme={headFontFace:theme.headFontFace,bodyFontFace:theme.bodyFontFace,lang:'en-US'};
  const ledger=new Map(evidence.entries.map(e=>[e.id,e]));
  for(const [i,d] of deck.slides.entries()){
    const s=pptx.addSlide();addBackground(s,theme);
    if(d.type==='cover') cover(s,d,theme,deck.meta);
    else if(d.type==='statement') statement(s,d,theme);
    else if(d.type==='metrics') metrics(s,d,theme);
    else if(d.type==='chart') chart(s,d,theme,pptx);
    else if(d.type==='process') process(s,d,theme);
    else if(d.type==='bullets') bullets(s,d,theme);
    else if(d.type==='closing') closing(s,d,theme);
    for(const visual of d.visuals||[]){
      const asset=assets.get(visual.asset_id);
      if(asset) s.addImage({path:asset.resolved_path,x:visual.x,y:visual.y,w:visual.w,h:visual.h,sizingContain:true});
    }
    addFooter(s,i,deck.slides.length,d,ledger,theme,deck.meta);
    const notes=d.speaker_notes||d.notes,accessibleNotes=d.figure_description?`Figure description: ${d.figure_description}${notes?`\n\n${notes}`:''}`:notes;
    if(typeof accessibleNotes==='string' && accessibleNotes.trim()) s.addNotes(accessibleNotes);
  }
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  await pptx.writeFile({fileName:outputPath});
  return {slides:deck.slides.length,outputPath};
}
