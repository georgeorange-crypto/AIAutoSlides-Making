import fs from 'node:fs';
import {unzipSync,strToU8,zipSync} from 'fflate';

const number=value=>Number(value.toPrecision(12)).toString();
function literal(values){return `<c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${values.map((v,i)=>`<c:pt idx="${i}"><c:v>${number(v)}</c:v></c:pt>`).join('')}</c:numLit>`;}
function errBars(series){return `<c:errBars><c:errDir val="y"/><c:errBarType val="both"/><c:errValType val="cust"/><c:noEndCap val="0"/><c:plus>${literal(series.error_plus)}</c:plus><c:minus>${literal(series.error_minus)}</c:minus></c:errBars>`;}

export function patchPptxErrorBars(pptxPath,deck){
  const charts=deck.slides.filter(s=>s.type==='chart').map(s=>s.chart),needsPatch=charts.some(c=>c.series?.some(s=>Array.isArray(s.error_minus)||Array.isArray(s.error_plus)));
  if(!needsPatch)return 0;
  const files=unzipSync(new Uint8Array(fs.readFileSync(pptxPath))),names=Object.keys(files).filter(n=>/^ppt\/charts\/chart\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/chart(\d+)/)[1])-Number(b.match(/chart(\d+)/)[1]));
  if(names.length!==charts.length)throw new Error(`Expected ${charts.length} native charts, found ${names.length} while attaching error bars`);
  let patched=0;
  charts.forEach((chart,chartIndex)=>{
    const series=chart.series||[];if(!series.some(s=>Array.isArray(s.error_minus)||Array.isArray(s.error_plus)))return;
    if(chart.kind!=='bar')throw new Error('Run-level Student-t error bars currently require a native bar chart');
    let xml=new TextDecoder().decode(files[names[chartIndex]]),index=0;
    xml=xml.replace(/<c:ser>([\s\S]*?)<\/c:ser>/g,(block,inside)=>{
      const item=series[index++];
      if(!item?.error_minus&&!item?.error_plus)return block;
      if(!Array.isArray(item.error_minus)||!Array.isArray(item.error_plus)||item.error_minus.length!==item.values.length||item.error_plus.length!==item.values.length)throw new Error(`Error interval shape does not match series ${item.name}`);
      if(item.error_minus.some(v=>!Number.isFinite(v)||v<0)||item.error_plus.some(v=>!Number.isFinite(v)||v<0))throw new Error(`Error intervals must be finite nonnegative values for series ${item.name}`);
      if(!inside.includes('<c:cat>'))throw new Error(`Cannot find category anchor in native chart series ${item.name}`);
      patched++;return `<c:ser>${inside.replace('<c:cat>',`${errBars(item)}<c:cat>`)}</c:ser>`;
    });
    if(index!==series.length||!xml.includes('<c:errBars>'))throw new Error(`Failed to serialize every requested error bar in ${names[chartIndex]}`);
    files[names[chartIndex]]=strToU8(xml);
  });
  fs.writeFileSync(pptxPath,zipSync(files,{level:6}));
  return patched;
}
