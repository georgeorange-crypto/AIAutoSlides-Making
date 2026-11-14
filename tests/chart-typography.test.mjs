import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {generatePresentation} from '../src/render.mjs';

test('emitted chart labels use the selected theme font at a readable size and QA checks the chart package part',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-chart-type-'));
 try{
  const deck=JSON.parse(fs.readFileSync('examples/research-demo.json','utf8')),evidence=JSON.parse(fs.readFileSync('sources/evidence.json','utf8')),theme=JSON.parse(fs.readFileSync('themes/academic-light.json','utf8')),out=path.join(directory,'chart.pptx');deck.meta.theme=theme.id;
  await generatePresentation(deck,evidence,theme,out);const files=unzipSync(new Uint8Array(fs.readFileSync(out))),chartName='ppt/charts/chart1.xml',chart=strFromU8(files[chartName]);assert.ok(chart.includes('<c:dLbls>'));assert.ok(!/<c:dLbls>[\s\S]*?typeface="Arial"/.test(chart));assert.ok(!/<c:dLbls>[\s\S]*?sz="1200"/.test(chart));assert.ok(/<c:dLbls>[\s\S]*?typeface="Aptos"/.test(chart));assert.ok(/<c:dLbls>[\s\S]*?sz="1400"/.test(chart));
  const qa=spawnSync(process.execPath,['src/qa.mjs',out],{encoding:'utf8'});assert.equal(qa.status,0,qa.stdout+qa.stderr);const report=JSON.parse(fs.readFileSync(out.replace(/\.pptx$/i,'.qa.json'),'utf8')),slide=report.slides[3];assert.ok(slide.chartTextStyleCount>=3);assert.ok(slide.fontFaces.includes('Aptos'));assert.ok(!slide.fontFaces.includes('Arial'));assert.equal(slide.smallText.filter(item=>item.element==='chart').length,0);assert.equal(slide.unmeasuredFonts.filter(item=>item.element==='chart').length,0);
  const dataLabels=chart.match(/<c:dLbls>[\s\S]*?<\/c:dLbls>/)?.[0];files[chartName]=strToU8(chart.replace(dataLabels,dataLabels.replaceAll('typeface="Aptos"','typeface="Arial"').replaceAll('sz="1400"','sz="1200"')));fs.writeFileSync(out,zipSync(files));const negative=spawnSync(process.execPath,['src/qa.mjs',out],{encoding:'utf8'});assert.equal(negative.status,0,negative.stdout+negative.stderr);const rejected=JSON.parse(fs.readFileSync(out.replace(/\.pptx$/i,'.qa.json'),'utf8')).slides[3];assert.ok(rejected.fontFaces.includes('Arial'));assert.ok(rejected.smallText.some(item=>item.element==='chart'&&item.min_font_size_pt===12));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
