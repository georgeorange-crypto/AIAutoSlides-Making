import fs from 'node:fs';
import crypto from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';

const file=process.argv[2];
if(!file||!fs.existsSync(file))throw new Error('Usage: node audit-pptx-objects.mjs <file.pptx>');
const bytes=fs.readFileSync(file),zip=unzipSync(new Uint8Array(bytes));
const names=Object.keys(zip).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'");
const slides=names.map((name,index)=>{const xml=strFromU8(zip[name]),texts=[...xml.matchAll(/<a:t>(.*?)<\/a:t>/gs)].map(m=>decode(m[1]));return{slide:index+1,editableTextRuns:texts.length,hasEditableText:texts.length>0,nativeShapes:(xml.match(/<p:sp>/g)||[]).length,nativeConnectors:(xml.match(/<a:prstGeom prst="line"/g)||[]).length,nativePictures:(xml.match(/<p:pic>/g)||[]).length,nativeTables:(xml.match(/<a:tbl>/g)||[]).length,nativeChartFrames:(xml.match(/<c:chart\b/g)||[]).length,texts};});
const report={schema:'aiautoslides.pptx-object-audit.v1',file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),slideCount:slides.length,editableTextSlides:slides.filter(s=>s.hasEditableText).length,totals:Object.fromEntries(['nativeShapes','nativeConnectors','nativePictures','nativeTables','nativeChartFrames'].map(k=>[k,slides.reduce((n,s)=>n+s[k],0)])),slides};
console.log(JSON.stringify(report,null,2));
