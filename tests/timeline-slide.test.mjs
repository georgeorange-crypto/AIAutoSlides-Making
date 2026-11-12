import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {unzipSync,strFromU8} from 'fflate';

test('timeline slide creates editable markers/connectors and preserves exact event lineage',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-timeline-')),pptx=path.join(dir,'timeline.pptx');
  try{
    const build=spawnSync(process.execPath,['src/cli.mjs','build','--input','examples/timeline-demo/storyboard.json','--evidence','examples/timeline-demo/evidence.json','--out',pptx],{encoding:'utf8'});
    assert.equal(build.status,0,build.stderr);
    const files=unzipSync(new Uint8Array(fs.readFileSync(pptx))),xml=strFromU8(files['ppt/slides/slide2.xml']);
    assert.equal([...xml.matchAll(/name="Timeline_S02_E\d+_Marker"/g)].length,4);
    assert.equal([...xml.matchAll(/name="Timeline_S02_E\d+_(When|Label|Detail)"/g)].length,12);
    const manifest=JSON.parse(fs.readFileSync(path.join(dir,'timeline.evidence-manifest.json'),'utf8'));
    assert.equal(manifest.timelines.length,1);assert.equal(manifest.timelines[0].events.length,4);
    const qa=spawnSync(process.execPath,['src/qa.mjs',pptx],{encoding:'utf8'});assert.equal(qa.status,0,qa.stderr);
    const report=JSON.parse(fs.readFileSync(path.join(dir,'timeline.qa.json'),'utf8'));
    assert.equal(report.nativeTimelineEventCount,4);assert.equal(report.timelineDataExactMatch,true);assert.deepEqual(report.errors,[]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
