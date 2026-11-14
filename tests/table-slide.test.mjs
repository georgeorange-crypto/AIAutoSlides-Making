import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';

test('table slide builds native editable cells and exact evidence lineage',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-table-'));
 const deckPath=path.join(dir,'table-storyboard.json'),pptxPath=path.join(dir,'table-demo.pptx');
 const deck={meta:{title:'Synthetic table demonstration',theme:'academic-light',aspect_ratio:'16:9'},slides:[
  {slide_id:'S01',type:'cover',title:'Editable table example',body:['Synthetic values only'],evidence_ids:[]},
  {slide_id:'S02',type:'table',title:'Keep values source-linked',evidence_ids:['E1'],table:{headers:['Condition','Latency (ms)','Runs'],rows:[['Hypothetical A',420,3],['Hypothetical B',315,3]],caption:'Synthetic fixture; not a system benchmark.'},speaker_notes:'Explain that the values are illustrative.'}
 ]};
 try{
  fs.writeFileSync(deckPath,JSON.stringify(deck));
  const build=spawnSync(process.execPath,['src/cli.mjs','build','--input',deckPath,'--out',pptxPath],{encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  const files=unzipSync(new Uint8Array(fs.readFileSync(pptxPath))),slide=strFromU8(files['ppt/slides/slide2.xml']);
  assert.match(slide,/<a:tbl>/);assert.match(slide,/<a:t>Latency \(ms\)<\/a:t>/);assert.match(slide,/<a:t>420<\/a:t>/);
  const manifest=JSON.parse(fs.readFileSync(path.join(dir,'table-demo.evidence-manifest.json'),'utf8'));
  assert.equal(manifest.tables.length,1);assert.equal(manifest.tables[0].editability,'native editable PowerPoint table cells');assert.deepEqual(manifest.tables[0].rows,deck.slides[1].table.rows);assert.deepEqual(manifest.tables[0].source_ids,['E1']);
  const qa=spawnSync(process.execPath,['src/qa.mjs',pptxPath],{encoding:'utf8'});
  assert.equal(qa.status,0,qa.stderr);const report=JSON.parse(fs.readFileSync(path.join(dir,'table-demo.qa.json'),'utf8'));
  assert.equal(report.nativeTableCount,1);assert.equal(report.tableDataExactMatch,true);assert.deepEqual(report.errors,[]);
  const slideName='ppt/slides/slide2.xml',originalSlide=strFromU8(files[slideName]);
  files[slideName]=strToU8(originalSlide.replace('sz="1450"',''));
  fs.writeFileSync(pptxPath,zipSync(files));const inheritedRun=spawnSync(process.execPath,['src/qa.mjs',pptxPath],{encoding:'utf8'});assert.equal(inheritedRun.status,0,inheritedRun.stdout+inheritedRun.stderr);
  const inheritedReport=JSON.parse(fs.readFileSync(path.join(dir,'table-demo.qa.json'),'utf8'));assert.ok(inheritedReport.slides[1].unmeasuredText.some(item=>item.element==='table'&&item.unmeasured_run_count===1));
  files[slideName]=strToU8(originalSlide.replace('sz="1450"','sz="800"'));
  fs.writeFileSync(pptxPath,zipSync(files));const tinyRun=spawnSync(process.execPath,['src/qa.mjs',pptxPath],{encoding:'utf8'});assert.equal(tinyRun.status,0,tinyRun.stdout+tinyRun.stderr);
  const tinyReport=JSON.parse(fs.readFileSync(path.join(dir,'table-demo.qa.json'),'utf8'));assert.ok(tinyReport.slides[1].smallText.some(item=>item.element==='table'&&item.min_font_size_pt===8));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
