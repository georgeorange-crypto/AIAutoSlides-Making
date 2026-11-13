import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pptxAutomizerAdapter} from '../packages/adapters/pptx-automizer.mjs';

const installed=Boolean((await pptxAutomizerAdapter.doctor()).ok);
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
test('pptx-automizer doctor reports an optional isolated version-pinned worker',async()=>{
  const result=await pptxAutomizerAdapter.doctor();
  assert.equal(result.ok,installed);
  if(installed)assert.equal(result.version,'0.9.4');
  else assert.match(result.reason,/deps:pptx-automizer/);
});

test('installed pptx-automizer modifies one exact text shape and preserves slides, charts and source', {skip:!installed},async()=>{
  const result=await pptxAutomizerAdapter.smokeTest();
  assert.equal(result.ok,true);assert.equal(result.slides,4);assert.equal(result.native_charts,1);assert.equal(result.source_unchanged,true);
});

test('pptx-automizer refuses source overwrite and unsupported output',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-automizer-guard-'));
  try{
    const input=path.join(dir,'source.pptx');fs.writeFileSync(input,'fixture');
    await assert.rejects(()=>pptxAutomizerAdapter.run({inputFile:input,outputFile:input,slideNumber:1,elementName:'Text 0',text:'replacement'}),/differ from inputFile/);
    await assert.rejects(()=>pptxAutomizerAdapter.run({inputFile:input,outputFile:path.join(dir,'output.pdf'),slideNumber:1,elementName:'Text 0',text:'replacement'}),/end in \.pptx/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('pptx-automizer rejects unknown shape names without changing the source or leaving output',{skip:!installed},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-automizer-negative-')),input=path.join(dir,'source.pptx'),output=path.join(dir,'edited.pptx');
  try{
    const fixture=spawnSync(process.execPath,[path.join(root,'scripts','create-existing-pptx-fixture.mjs'),input],{encoding:'utf8',windowsHide:true});assert.equal(fixture.status,0,fixture.stderr);
    const before=crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex');
    await assert.rejects(()=>pptxAutomizerAdapter.run({inputFile:input,outputFile:output,slideNumber:2,elementName:'Unknown Shape',text:'replacement'}),/element name was not found/);
    assert.equal(fs.existsSync(output),false);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'),before);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
