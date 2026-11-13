import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {PRESENTON_LOCAL_MODEL,verifyModelArtifact} from '../packages/adapters/presenton-model.mjs';

test('Presenton local-model installer pins a public Apache-2.0 GGUF without putting weights in default app dependencies',()=>{
  assert.equal(PRESENTON_LOCAL_MODEL.repo,'Qwen/Qwen2.5-1.5B-Instruct-GGUF');
  assert.equal(PRESENTON_LOCAL_MODEL.license,'Apache-2.0');
  assert.match(PRESENTON_LOCAL_MODEL.revision,/^[a-f0-9]{40}$/);
  assert.match(PRESENTON_LOCAL_MODEL.sha256,/^[a-f0-9]{64}$/);
  assert.equal(PRESENTON_LOCAL_MODEL.bytes,1117320736);
});

test('Presenton model artifact verifier accepts only the exact bounded file and SHA-256',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'presenton-model-integrity-'));
  try{
    const file=path.join(dir,'model.gguf');fs.writeFileSync(file,'fixture model');
    const expected={bytes:13,sha256:'c7a3a8c7435ef8e4cf1ca2d261f7e09ca85de6cdb70f7c689a836680523a180c'};
    const actual=await verifyModelArtifact(file,expected);
    assert.equal(actual.bytes,13);assert.equal(actual.sha256,expected.sha256);
    await assert.rejects(()=>verifyModelArtifact(file,{...expected,bytes:12}),/13 bytes; expected 12/);
    await assert.rejects(()=>verifyModelArtifact(file,{...expected,sha256:'0'.repeat(64)}),/SHA-256 mismatch/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
