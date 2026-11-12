import fs from 'node:fs';
import path from 'node:path';
import pptxgen from 'pptxgenjs';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),out=path.resolve(process.argv[2]||path.join(root,'examples/existing-pptx/fixtures/template.pptx'));
fs.mkdirSync(path.dirname(out),{recursive:true});
const pptx=new pptxgen();pptx.layout='LAYOUT_WIDE';pptx.author='AIAutoSlides local fixture generator';pptx.subject='Synthetic fixture for existing-deck text replacement';pptx.title='Synthetic template fixture';pptx.company='AIAutoSlides';pptx.lang='en-US';
const navy='17324D',blue='1879A8',pale='EAF1F6';
const s1=pptx.addSlide();s1.background={color:'F7F9FC'};s1.addText('Synthetic template — unchanged cover',{x:.8,y:1.2,w:10.8,h:.8,fontFace:'Aptos Display',fontSize:30,bold:true,color:navy});s1.addText('Fixture content only; no research result is represented.',{x:.85,y:2.25,w:10.5,h:.5,fontFace:'Aptos',fontSize:17,color:'43566A'});
const s2=pptx.addSlide();s2.background={color:'F7F9FC'};s2.addText('Draft finding: replace this placeholder.',{x:.8,y:.8,w:11.4,h:1.0,fontFace:'Aptos Display',fontSize:28,bold:true,color:navy});s2.addShape(pptx.ShapeType.line,{x:.85,y:2.05,w:3.3,h:0,line:{color:blue,width:2}});s2.addText('Editable text replacement fixture',{x:.85,y:2.3,w:9.5,h:.45,fontFace:'Aptos',fontSize:18,color:'43566A'});
const s3=pptx.addSlide();s3.background={color:'F7F9FC'};s3.addText('Synthetic native chart — unchanged',{x:.8,y:.55,w:11.5,h:.7,fontFace:'Aptos Display',fontSize:26,bold:true,color:navy});s3.addChart(pptx.ChartType.bar,[{name:'Illustrative values',labels:['A','B','C'],values:[2,3,4]}],{x:1,y:1.6,w:10.8,h:4.5,showLegend:false,showTitle:false,chartColors:[blue],catAxisLabelColor:navy,valAxisLabelColor:navy,valGridLine:{color:pale}});s3.addText('Synthetic fixture values only',{x:.85,y:6.4,w:8,h:.3,fontFace:'Aptos',fontSize:10,color:'65758A'});
await pptx.writeFile({fileName:out});console.log(`Created 3-slide editable fixture: ${out}`);
