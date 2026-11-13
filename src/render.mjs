import fs from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';
import {codeSegments} from './code-snippet.mjs';

const W = 13.333, H = 7.5;
const Shape = { roundRect: 'roundRect', line: 'line', ellipse: 'ellipse', rect: 'rect', diamond: 'diamond' };

function txt(slide, text, opts) {
  slide.addText(String(text), {margin:0, breakLine:false, valign:'mid', ...opts});
}
function rect(slide, opts) { slide.addShape(Shape.roundRect, {radius:0.15,line:{color:opts.fill?.color ?? 'FFFFFF',transparency:100}, ...opts}); }
function line(slide, x1,y1,x2,y2,color,objectName) { slide.addShape(Shape.line,{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color,width:1.1},...(objectName?{objectName}:{})}); }
function visualGroup(d,kind){return `AIAutoSlidesVisualGroup:${d.slide_id}:${kind}`;}
function titleSize(text) { const n=[...text].length; return n>85?25:n>60?29:n>39?34:40; }
function addBackground(s,t) {s.background={color:t.background};}
function addTop(s,d,t) {
  txt(s, (d.kicker||'AI AUTO SLIDES').toUpperCase(), {x:0.74,y:0.37,w:10.5,h:0.34,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.accent,charSpacing:1.2});
  line(s,0.74,0.84,12.58,0.84,t.line);
}
function addTitle(s,d,t,options={}) {
  const f=titleSize(d.title);
  txt(s,d.title,{x:0.74,y:1.08,w:11.83,h:options.height??1.24,fontFace:t.headFontFace,fontSize:f,bold:true,color:t.title,breakLine:false,valign:'top',fit:'shrink'});
}
function addFooter(s,index,total,t) {
  line(s,0.74,7.02,12.58,7.02,t.line);
  txt(s,`${String(index+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`,{x:11.78,y:7.04,w:0.80,h:0.34,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.muted,align:'right'});
}
function panel(s,x,y,w,h,t,alt=false,objectName) {
  rect(s,{x,y,w,h,rectRadius:0.16,radius:0.15,fill:{color:alt?t.surfaceAlt:t.surface},line:{color:t.line,width:0.6},...(objectName?{objectName}:{})});
}
function plannerVisual(s,d,t){
  const objectName=visualGroup(d,Array.isArray(d.steps)?'process':'diagram');
  const x=7.02,y=1.92,w=5.55,h=4.78;
  panel(s,x,y,w,h,t,true);
  txt(s,d.figure_description||'EXPLANATORY VISUAL',{x:x+0.25,y:y+0.18,w:w-0.5,h:0.48,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.accent,valign:'top',fit:'shrink',objectName});
  if(Array.isArray(d.steps)){
    const steps=d.steps,stepTop=y+0.90,stepGap=0.10,stepH=Math.min(0.56,(h-1.22-(steps.length-1)*stepGap)/steps.length),cx=x+0.50;
    steps.forEach((step,index)=>{
      const sy=stepTop+index*(stepH+stepGap);
      s.addShape(Shape.ellipse,{x:cx,y:sy+0.04,w:0.40,h:0.40,fill:{color:index%2?t.surface:t.background},line:{color:t.accent,width:1.2},objectName});
      txt(s,String(index+1),{x:cx,y:sy+0.06,w:0.40,h:0.32,fontFace:t.headFontFace,fontSize:14,bold:true,color:t.accent,align:'center',objectName});
      txt(s,step,{x:cx+0.62,y:sy+0.01,w:w-1.50,h:stepH-0.02,fontFace:t.bodyFontFace,fontSize:14.5,bold:true,color:t.text,valign:'mid',fit:'shrink',objectName});
      if(index<steps.length-1)line(s,cx+0.20,sy+0.45,cx+0.20,sy+stepH+stepGap-0.04,t.line,objectName);
    });
    return;
  }
  const diagram=d.diagram;if(!diagram)return;
  const source=diagram.groups[0],figureTop=y+0.80,figureHeight=1.95,sx=(w-0.40)/source.w,sy=figureHeight/source.h,ox=x+0.20-source.x*sx,oy=figureTop-source.y*sy;
  const nodes=new Map(diagram.nodes.map(node=>[node.id,{...node,x:ox+node.x*sx,y:oy+node.y*sy,w:node.w*sx,h:node.h*sy}]));
  for(const edge of diagram.edges){
    const a=nodes.get(edge.from),b=nodes.get(edge.to),x1=a.x+a.w/2,y1=a.y+a.h/2,x2=b.x+b.w/2,y2=b.y+b.h/2,dx=x2-x1,dy=y2-y1;
    s.addShape(Shape.line,{x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.max(Math.abs(dx),0.001),h:Math.max(Math.abs(dy),0.001),flipH:dx<0,flipV:dy<0,line:{color:t.accent,width:1.4,endArrowType:'triangle'},objectName});
  }
  diagram.nodes.forEach((node,index)=>{const box=nodes.get(node.id),shape=node.shape==='rect'?Shape.rect:node.shape==='diamond'?Shape.diamond:Shape.roundRect;s.addShape(shape,{x:box.x,y:box.y,w:box.w,h:box.h,fill:{color:index%2?t.surface:t.background},line:{color:t.accent,width:1.2},objectName});txt(s,node.label,{x:box.x+0.05,y:box.y+0.04,w:box.w-0.10,h:box.h-0.08,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.title,align:'center',fit:'shrink',objectName});});
  const columns=diagram.edges.length>3?2:1,rows=Math.ceil(diagram.edges.length/columns),legendTop=y+2.88,legendHeight=Math.min(0.68,(h-3.00)/rows),legendGap=0.08,legendWidth=(w-0.50-(columns-1)*0.16)/columns;
  diagram.edges.forEach((edge,index)=>{const row=index%rows,column=Math.floor(index/rows),a=nodes.get(edge.from),b=nodes.get(edge.to),rx=x+0.25+column*(legendWidth+0.16),ry=legendTop+row*(legendHeight+legendGap);panel(s,rx,ry,legendWidth,legendHeight,t,false,objectName);txt(s,edge.label,{x:rx+0.10,y:ry+0.04,w:legendWidth-0.20,h:0.27,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.accent,valign:'mid',fit:'shrink',objectName});txt(s,`${a.label} → ${b.label}`,{x:rx+0.10,y:ry+0.32,w:legendWidth-0.20,h:0.30,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.text,valign:'mid',fit:'shrink',objectName});});
}
function body(s,d,t,y=2.60,fs=20) {
  (d.body||[]).slice(0,4).forEach((b,i)=>txt(s,b,{x:0.83,y:y+i*0.84,w:11.4,h:0.69,fontFace:t.bodyFontFace,fontSize:fs,color:t.text,valign:'top',fit:'shrink'}));
}
function cover(s,d,t,meta) {
  // Use the right column only when the author supplied an explanatory process.
  if(d.cover_visual?.kind==='process'&&Array.isArray(d.cover_visual.steps)){
    rect(s,{x:9.18,y:0,w:4.15,h:7.5,rectRadius:0,fill:{color:t.surfaceAlt},line:{color:t.surfaceAlt,transparency:100}});
    const objectName=visualGroup(d,'process');
    txt(s,'THE STORY IN THREE STEPS',{x:9.55,y:1.12,w:3.30,h:0.38,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.accent,charSpacing:1.1,fit:'shrink',objectName});
    const left=9.52,top=1.72,width=3.35,height=1.12,gap=0.42,steps=d.cover_visual.steps.slice(0,3);
    steps.forEach((step,index)=>{
      const y=top+index*(height+gap);
      if(index>0)s.addShape(Shape.line,{x:left+0.24,y:y-gap+0.02,w:0,h:gap-0.04,line:{color:t.accent2,width:1.8,endArrowType:'triangle'},objectName});
      panel(s,left,y,width,height,t,index===1,objectName);
      s.addShape(Shape.ellipse,{x:left+0.17,y:y+0.31,w:0.48,h:0.48,fill:{color:index===1?t.surface:t.background},line:{color:index===1?t.accent2:t.accent,width:1.4},objectName});
      txt(s,String(index+1).padStart(2,'0'),{x:left+0.17,y:y+0.34,w:0.48,h:0.34,fontFace:t.headFontFace,fontSize:14,bold:true,color:index===1?t.accent2:t.accent,align:'center',fit:'shrink',objectName});
      txt(s,step,{x:left+0.82,y:y+0.17,w:2.32,h:0.78,fontFace:t.bodyFontFace,fontSize:15,bold:true,color:t.text,valign:'mid',fit:'shrink',objectName});
    });
  }
  const copyWidth=d.cover_visual?.kind==='process'&&Array.isArray(d.cover_visual.steps)?8.0:11.5;
  txt(s,(d.kicker||'RESEARCH PRESENTATION').toUpperCase(),{x:0.85,y:0.71,w:copyWidth,h:0.38,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.accent,charSpacing:1.5,fit:'shrink'});
  txt(s,d.title,{x:0.85,y:1.66,w:copyWidth,h:2.43,fontFace:t.headFontFace,fontSize:52,bold:true,color:t.title,valign:'top',fit:'shrink'});
  (d.body||[]).slice(0,2).forEach((b,i)=>txt(s,b,{x:0.89,y:4.54+i*0.55,w:copyWidth-0.05,h:0.49,fontFace:t.bodyFontFace,fontSize:20-i*3,color:i===0?t.text:t.muted,fit:'shrink'}));
  line(s,0.89,6.26,Math.min(8.8,0.89+copyWidth),6.26,t.line);
  txt(s,meta.subtitle||'',{x:0.89,y:6.42,w:copyWidth-0.05,h:0.34,fontSize:14,color:t.muted,fontFace:t.bodyFontFace,fit:'shrink'});
}
function statement(s,d,t) {
  addTop(s,d,t);
  // The claim itself takes the stage; short supporting evidence below.
  const hasVisual=(d.visuals||[]).length>0||Array.isArray(d.steps)||!!d.diagram;
  const fs=hasVisual?37:d.title.length>90?35:d.title.length>65?42:49;
  txt(s,d.title,{x:0.77,y:1.45,w:hasVisual?6.0:11.4,h:2.36,fontFace:t.headFontFace,fontSize:fs,bold:true,color:t.title,valign:'mid',fit:'shrink'});
  line(s,0.80,4.14,4.50,4.14,t.accent);
  if(d.layout==='two-column-contrast' && !hasVisual && (d.body||[]).length>=2){
    panel(s,0.80,4.52,5.55,1.70,t);panel(s,6.70,4.52,5.55,1.70,t,true);
    (d.body||[]).slice(0,2).forEach((b,i)=>txt(s,b,{x:1.04+i*5.9,y:4.83,w:5.05,h:1.10,fontFace:t.bodyFontFace,fontSize:19,color:t.text,valign:'mid',fit:'shrink'}));
    return;
  }
  (d.body||[]).slice(0,2).forEach((b,i)=>txt(s,b,{x:0.80,y:4.40+i*1.12,w:hasVisual?5.9:11.35,h:1.05,fontFace:t.bodyFontFace,fontSize:18,color:i===0?t.text:t.muted,valign:'top',fit:'shrink'}));
  if(Array.isArray(d.steps)||d.diagram)plannerVisual(s,d,t);
}
function metrics(s,d,t) {
  addTop(s,d,t);addTitle(s,d,t);
  const objectName=visualGroup(d,'cards');
  const ms=d.metrics||[],gap=0.22,x=0.75,available=11.82,w=(available-gap*(ms.length-1))/ms.length;
  ms.forEach((m,i)=>{
    const px=x+i*(w+gap);
    panel(s,px,2.93,w,2.74,t,false,objectName);
    s.addShape(Shape.rect,{x:px,y:2.93,w:0.075,h:2.74,line:{color:t.accent,transparency:100},fill:{color:i===ms.length-1?t.warning:t.accent},objectName});
    txt(s,m.label,{x:px+0.28,y:3.22,w:w-0.50,h:0.53,fontSize:15.5,fontFace:t.bodyFontFace,color:t.muted,valign:'top',fit:'shrink',objectName});
    txt(s,m.value,{x:px+0.28,y:4.00,w:w-0.51,h:0.93,fontSize:Math.min(37, w*11),fontFace:t.headFontFace,bold:true,color:i===ms.length-1?t.warning:t.accent2,fit:'shrink',objectName});
    txt(s,m.detail||'',{x:px+0.28,y:5.12,w:w-0.55,h:0.38,fontSize:14.5,fontFace:t.bodyFontFace,color:t.text,fit:'shrink',objectName});
  });
}
function chart(s,d,t,pptx) {
  addTop(s,d,t);addTitle(s,d,t);
  const c=d.chart;
  panel(s,0.75,2.61,11.82,3.46,t);
  const scatter=['scatter','cdf'].includes(c.kind);
  const series=c.series||[{name:c.series_name||'Series',values:c.values}];
  const data=scatter?[{name:'X-Axis',values:c.x_values},...series.map(v=>({name:v.name,values:v.values}))]:series.map(v=>({name:v.name,labels:c.categories,values:v.values}));
  const chartValues=data.flatMap(item=>item.values||[]);
  const dataLabelFormatCode=chartValues.every(Number.isInteger)?'0':'0.###';
  const chartType=c.kind==='line'?pptx.ChartType.line:scatter?pptx.ChartType.scatter:pptx.ChartType.bar;
  s.addChart(chartType,data,{
    x:1.03,y:2.86,w:11.20,h:2.91,
    catAxisLabelFontFace:t.bodyFontFace,catAxisLabelFontSize:14,
    valAxisLabelFontFace:t.bodyFontFace,valAxisLabelFontSize:14,
    catAxisLabelColor:t.text,valAxisLabelColor:t.text,
    catAxisLineColor:t.muted,valAxisLineColor:t.muted,
    showLegend:series.length>1,legendPos:'b',legendColor:t.text,showValue:!scatter,showTitle:false,showBorder:false,
    showCatName:false,showSerName:false,
    dataLabelPosition:'outEnd',dataLabelColor:t.text,dataLabelFormatCode,
    chartColors:[t.accent,t.accent2,t.warning,t.text,'6A7D90','8757A5'],valGridLine:{color:t.line,width:0.6},
    grouping:c.kind==='line'?'standard':'clustered',barDir:'col',
    valAxisMinVal:c.kind==='cdf'?0:undefined,valAxisMaxVal:c.kind==='cdf'?1:undefined,
    lineDataSymbol:c.kind==='line'||c.kind==='scatter'?'circle':'none',lineDataSymbolSize:6,lineSize:c.kind==='cdf'?2.5:c.kind==='scatter'?0:2.5
  });
  txt(s,c.y_axis_label||c.unit,{x:0.91,y:2.40,w:4.0,h:0.30,fontFace:t.bodyFontFace,fontSize:14,color:t.muted,fit:'shrink'});
  if(scatter&&c.x_axis_label)txt(s,c.x_axis_label,{x:4.10,y:5.83,w:4.8,h:0.30,fontFace:t.bodyFontFace,fontSize:14,color:t.muted,align:'center',fit:'shrink'});
  if(d.assertion_title&&d.assertion_title!==d.title)txt(s,d.assertion_title,{x:0.86,y:6.18,w:11.5,h:0.34,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.text,fit:'shrink'});
  if((d.body||[])[0])txt(s,d.body[0],{x:0.86,y:d.assertion_title&&d.assertion_title!==d.title?6.48:6.24,w:11.5,h:0.40,fontFace:t.bodyFontFace,fontSize:14,color:t.muted,fit:'shrink'});
}
function process(s,d,t) {
  addTop(s,d,t);addTitle(s,d,t);
  const objectName=visualGroup(d,'process');
  const steps=d.steps||[],left=0.75,right=12.55,gap=0.18,total=right-left,w=(total-(steps.length-1)*gap)/steps.length;
  steps.forEach((st,i)=>{
    const x=left+i*(w+gap);
    panel(s,x,3.00,w,1.90,t,i%2===1,objectName);
    txt(s,`${String(i+1).padStart(2,'0')}`,{x:x+0.2,y:3.20,w:w-0.4,h:0.35,fontFace:t.headFontFace,fontSize:14,bold:true,color:t.accent,objectName});
    txt(s,st,{x:x+0.2,y:3.69,w:w-0.37,h:0.83,fontFace:t.bodyFontFace,fontSize:Math.min(20,st.length>15?16:20),color:t.text,bold:true,fit:'shrink',objectName});
    if(i<steps.length-1) txt(s,'→',{x:x+w-0.01,y:3.65,w:gap+0.11,h:0.4,color:t.accent,fontSize:20,bold:true,align:'center',objectName});
  });
  (d.body||[]).slice(0,2).forEach((item,index)=>txt(s,item,{x:0.82,y:5.34+index*0.66,w:11.55,h:0.56,fontFace:t.bodyFontFace,fontSize:15.5,color:index===0?t.text:t.muted,valign:'top',fit:'shrink',objectName}));
}
function architecture(s,d,t) {
  addTop(s,d,t);addTitle(s,d,t);
  const g=d.diagram,objectName=visualGroup(d,'diagram');
  for(const group of g.groups){
    rect(s,{x:group.x,y:group.y,w:group.w,h:group.h,rectRadius:0.14,fill:{color:t.surfaceAlt,transparency:24},line:{color:t.line,width:0.8,dash:'dash'}});
    txt(s,group.label,{x:group.x+0.16,y:group.y+0.08,w:group.w-0.32,h:0.34,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.muted,fit:'shrink'});
  }
  const byId=new Map(g.nodes.map(n=>[n.id,n]));
  for(const edge of g.edges){
    const a=byId.get(edge.from),b=byId.get(edge.to),x1=a.x+a.w/2,y1=a.y+a.h/2,x2=b.x+b.w/2,y2=b.y+b.h/2;
    const dx=x2-x1,dy=y2-y1;
      s.addShape(Shape.line,{x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.max(Math.abs(dx),0.001),h:Math.max(Math.abs(dy),0.001),flipH:dx<0,flipV:dy<0,line:{color:t.accent,width:1.8,endArrowType:'triangle'},objectName});
    if(edge.label)txt(s,edge.label,{x:(x1+x2)/2-0.90,y:(y1+y2)/2-0.25,w:1.80,h:0.34,fontFace:t.bodyFontFace,fontSize:14,color:t.muted,align:'center',fit:'shrink',objectName});
  }
  g.nodes.forEach((node,i)=>{
    const shape=node.shape==='rect'?Shape.rect:node.shape==='diamond'?Shape.diamond:Shape.roundRect;
      s.addShape(shape,{x:node.x,y:node.y,w:node.w,h:node.h,...(node.shape==='roundRect'?{rectRadius:0.12}:{}),fill:{color:i%2?t.surface:t.background},line:{color:t.accent,width:1.4},objectName});
    const inset=node.shape==='diamond'?0.42:0.14;
    txt(s,node.label,{x:node.x+inset,y:node.y+0.11,w:node.w-inset*2,h:node.h-0.22,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.title,align:'center',fit:'shrink',objectName});
  });
}
function editableTable(s,d,t) {
  addTop(s,d,t);addTitle(s,d,t);
  const table=d.table,columns=table.headers.length,totalRows=table.rows.length+1,x=0.82,y=2.64,w=11.70;
  const rowH=Math.max(0.38,Math.min(0.72,3.75/totalRows)),fontSize=Math.max(14,Math.min(14.5,15.5-Math.max(0,columns-3)*0.4-Math.max(0,table.rows.length-6)*0.2));
  const cell=(value,options)=>({text:String(value),options});
  const rows=[
    table.headers.map(header=>cell(header,{bold:true,color:'FFFFFF',fill:{color:t.accent},align:'left'})),
    ...table.rows.map((row,rowIndex)=>row.map(value=>cell(value,{color:t.text,fill:{color:rowIndex%2===0?t.surface:t.surfaceAlt},align:typeof value==='number'?'right':'left'})))
  ];
  s.addTable(rows,{x,y,w,rowH,colW:w/columns,margin:[0.07,0.10,0.07,0.10],fontFace:t.bodyFontFace,fontSize,color:t.text,border:{type:'solid',pt:0.65,color:t.line},valign:'middle',autoPage:false,objectName:'Editable evidence table'});
  if(table.caption)txt(s,table.caption,{x:0.86,y:y+rowH*totalRows+0.14,w:11.5,h:0.38,fontFace:t.bodyFontFace,fontSize:14,color:t.muted,valign:'top',fit:'shrink'});
}
function editableCode(s,d,t,slideNumber){
  addTop(s,d,t);addTitle(s,d,t);
  const code=d.code,segments=codeSegments(code.lines),x=0.82,y=2.43,w=11.70,h=4.22;
  rect(s,{x,y,w,h,rectRadius:0.10,fill:{color:t.surface},line:{color:t.line,width:0.8}});
  txt(s,code.filename,{x:x+0.22,y:y+0.12,w:8.9,h:0.30,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.text,fit:'shrink'});
  txt(s,code.language.toUpperCase(),{x:x+w-2.1,y:y+0.12,w:1.85,h:0.30,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.accent,align:'right'});
  const rowH=Math.min(0.24,3.58/segments.length),startY=y+0.52;
  segments.forEach((segment,index)=>txt(s,segment.text,{x:x+0.22,y:startY+index*rowH,w:w-0.44,h:rowH,fontFace:'Consolas',fontSize:14,color:t.text,valign:'mid',fit:'shrink',objectName:`Code_S${String(d.slide_id||`S${String(slideNumber).padStart(2,'0')}`).replace(/^S/,'')}_L${String(segment.line).padStart(2,'0')}_P${String(segment.part).padStart(2,'0')}`}));
}
function timeline(s,d,t,slideNumber){
  addTop(s,d,t);addTitle(s,d,t);
  const events=d.timeline.events,left=1.08,right=12.25,y=4.05,span=right-left,colW=Math.min(2.0,span/events.length+0.12);
  line(s,left,y,right,y,t.line);
  events.forEach((event,index)=>{
    const x=left+span*index/(events.length-1),id=`Timeline_S${String(d.slide_id||`S${String(slideNumber).padStart(2,'0')}`).replace(/^S/,'')}_E${String(index+1).padStart(2,'0')}`;
    s.addShape(Shape.ellipse,{x:x-0.11,y:y-0.11,w:0.22,h:0.22,fill:{color:t.accent},line:{color:t.background,width:1.4},objectName:`${id}_Marker`});
    txt(s,event.when,{x:x-colW/2,y:3.20,w:colW,h:0.40,fontFace:t.bodyFontFace,fontSize:14,bold:true,color:t.accent,align:'center',valign:'mid',fit:'shrink',objectName:`${id}_When`});
    line(s,x,y+0.14,x,4.40,t.line);
    txt(s,event.label,{x:x-colW/2,y:4.52,w:colW,h:0.58,fontFace:t.bodyFontFace,fontSize:15,bold:true,color:t.title,align:'center',valign:'top',fit:'shrink',objectName:`${id}_Label`});
    if(event.detail)txt(s,event.detail,{x:x-colW/2,y:5.18,w:colW,h:0.80,fontFace:t.bodyFontFace,fontSize:14,color:t.muted,align:'center',valign:'top',fit:'shrink',objectName:`${id}_Detail`});
  });
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
  txt(s,d.title,{x:0.83,y:1.35,w:11.41,h:2.22,fontFace:t.headFontFace,fontSize:50,bold:true,color:t.title,fit:'shrink'});
  line(s,0.83,3.84,6.8,3.84,t.accent);
  const items=(d.body||[]).slice(0,4),single=items.length===1;
  items.forEach((item,index)=>{
    const text=String(item),words=text.split(/\s+/u),display=single&&words.length>=6?[words.slice(0,Math.ceil(words.length/3)).join(' '),words.slice(Math.ceil(words.length/3),Math.ceil(words.length*2/3)).join(' '),words.slice(Math.ceil(words.length*2/3)).join(' ')].join('\n'):text;
    const y=single?4.12:4.18+index*0.68,height=single?1.90:0.60;
    panel(s,0.83,y,11.41,height,t,index%2===1);
    txt(s,display,{x:1.10,y:y+0.12,w:10.83,h:height-0.24,fontFace:t.bodyFontFace,fontSize:single?36:20,color:t.text,valign:'mid',fit:'shrink'});
  });
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
    else if(d.type==='architecture') architecture(s,d,theme);
    else if(d.type==='table') editableTable(s,d,theme);
    else if(d.type==='code') editableCode(s,d,theme,i+1);
    else if(d.type==='timeline') timeline(s,d,theme,i+1);
    else if(d.type==='bullets') bullets(s,d,theme);
    else if(d.type==='closing') closing(s,d,theme);
    for(const visual of d.visuals||[]){
      const asset=assets.get(visual.asset_id);
      if(asset) s.addImage({path:asset.resolved_path,x:visual.x,y:visual.y,w:visual.w,h:visual.h,sizingContain:true});
    }
    addFooter(s,i,deck.slides.length,theme);
    const notes=d.speaker_notes||d.notes,description=d.figure_description?`Figure description: ${d.figure_description}`:null;
    const evidenceNotes=(d.evidence_ids||[]).map(id=>{const item=ledger.get(id);return item?`Evidence record ${id}: ${item.label}. Source: ${item.source}. Locator: ${item.locator}. Verification: ${item.verified?'verified':'unverified'}. ${item.note||''}`:`Evidence record ${id}: ledger entry unavailable.`;});
    const accessibleNotes=[description,notes,...evidenceNotes].filter(value=>typeof value==='string'&&value.trim()).join('\n\n');
    if(typeof accessibleNotes==='string' && accessibleNotes.trim()) s.addNotes(accessibleNotes);
  }
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  await pptx.writeFile({fileName:outputPath});
  return {slides:deck.slides.length,outputPath};
}
