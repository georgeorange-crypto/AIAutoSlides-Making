import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {unzipSync,strFromU8} from 'fflate';
import {wrapCodeLine} from '../src/code-snippet.mjs';

test('syntax-boundary wrapping preserves every source character',()=>{
  const source='const result = await combine(inputs, options);';
  assert.equal(wrapCodeLine(source,18).join(''),source);
  assert.ok(wrapCodeLine(source,18).length>1);
});

test('code slide builds editable PowerPoint text objects with exact source lineage and QA',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-code-'));
  const pptx=path.join(dir,'code.pptx');
  try{
    const built=spawnSync(process.execPath,['src/cli.mjs','build','--input','examples/code-demo/storyboard.json','--evidence','examples/code-demo/evidence.json','--out',pptx],{encoding:'utf8'});
    assert.equal(built.status,0,built.stderr);
    const files=unzipSync(new Uint8Array(fs.readFileSync(pptx)));
    const slide=strFromU8(files['ppt/slides/slide2.xml']);
    assert.match(slide,/name="Code_S02_L/);
    assert.match(slide,/<a:latin typeface="Consolas"/);
    const lineage=JSON.parse(fs.readFileSync(path.join(dir,'code.evidence-manifest.json'),'utf8'));
    assert.equal(lineage.code_snippets.length,1);
    assert.deepEqual(lineage.code_snippets[0].lines,JSON.parse(fs.readFileSync('examples/code-demo/storyboard.json','utf8')).slides[1].code.lines);
    assert.deepEqual(lineage.code_snippets[0].source_ids,['E_SYN_CODE']);
    const qa=spawnSync(process.execPath,['src/qa.mjs',pptx],{encoding:'utf8'});
    assert.equal(qa.status,0,qa.stderr);
    const report=JSON.parse(fs.readFileSync(path.join(dir,'code.qa.json'),'utf8'));
    assert.equal(report.codeSnippetDataExactMatch,true);
    assert.equal(report.nativeCodeLineCount,6);
    assert.deepEqual(report.errors,[]);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
