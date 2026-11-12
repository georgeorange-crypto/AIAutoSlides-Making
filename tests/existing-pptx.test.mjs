import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {unzipSync,strFromU8} from 'fflate';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function run(script,args){return spawnSync(process.execPath,[path.join(root,script),...args],{cwd:root,encoding:'utf8',timeout:180000,windowsHide:true});}

test('existing PPTX workflow replaces one requested text run while preserving source and untouched slides',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-existing-pptx-')),input=path.join(tmp,'template.pptx'),out=path.join(tmp,'revised.pptx'),request=path.join(tmp,'request.json');
 try{
  const fixture=run('scripts/create-existing-pptx-fixture.mjs',[input]);assert.equal(fixture.status,0,fixture.stdout+fixture.stderr);
  const original=fs.readFileSync(input),originalHash=digest(original),before=unzipSync(new Uint8Array(original));
  fs.writeFileSync(request,JSON.stringify({edits:[{slide:2,find:'Draft finding: replace this placeholder.',replace:'Verified wording stays pending human review.'}]}));
  const edit=run('src/edit-existing-pptx.mjs',['--input',input,'--request',request,'--out',out]);assert.equal(edit.status,0,edit.stdout+edit.stderr);
  const after=unzipSync(new Uint8Array(fs.readFileSync(out))),parts=['ppt/slides/slide1.xml','ppt/slides/slide2.xml','ppt/slides/slide3.xml'];
  assert.equal(digest(fs.readFileSync(input)),originalHash);assert.deepEqual(after[parts[0]],before[parts[0]]);assert.notDeepEqual(after[parts[1]],before[parts[1]]);assert.deepEqual(after[parts[2]],before[parts[2]]);
  assert.match(strFromU8(after[parts[1]]),/Verified wording stays pending human review\./);assert.doesNotMatch(strFromU8(after[parts[1]]),/Draft finding: replace this placeholder\./);
  assert.equal(Object.keys(after).filter(n=>/^ppt\/charts\/chart\d+\.xml$/.test(n)).length,1);
  const report=JSON.parse(fs.readFileSync(out.replace(/\.pptx$/i,'.edit-report.json'),'utf8'));assert.equal(report.untouched_slides_identical_xml,true);assert.deepEqual(report.edited_slides,[2]);
  const overwrite=run('src/edit-existing-pptx.mjs',['--input',input,'--request',request,'--out',input]);assert.equal(overwrite.status,1);assert.match(overwrite.stderr,/source PPTX is immutable/);
  const collision=run('src/edit-existing-pptx.mjs',['--input',input,'--request',request,'--out',out]);assert.equal(collision.status,1);assert.match(collision.stderr,/refusing to overwrite/);
  const bad=path.join(tmp,'bad.json');fs.writeFileSync(bad,JSON.stringify({edits:[{slide:1,find:'absent text',replace:'new text'}]}));const reject=run('src/edit-existing-pptx.mjs',['--input',input,'--request',bad,'--out',path.join(tmp,'bad.pptx')]);assert.equal(reject.status,1);assert.match(reject.stderr,/found 0/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
