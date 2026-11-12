import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMarkItDownAdapter} from '../packages/adapters/markitdown.mjs';

function fixtureRecord(input){const bytes=fs.readFileSync(input),digest=crypto.createHash('sha256').update(bytes).digest('hex');return{schema_version:'1.0.0',source:{source_id:`SRC_${digest.slice(0,16).toUpperCase()}`,filename:path.basename(input),sha256:digest,bytes:bytes.length},converter:{id:'markitdown',version:'0.1.9',plugins_enabled:false,network:'not-requested'},content:{format:'text/markdown',text:'# Local fixture\n\nNot evidence.'},locators:[{locator:'document',locator_type:'document'}],verification_status:'unverified',limitations:['fixture']};}

test('MarkItDown adapter constrains local inputs and validates worker provenance',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-markitdown-unit-')),outside=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-markitdown-outside-'));
 try{
  const input=path.join(dir,'fixture.html');fs.writeFileSync(input,'<h1>Fixture</h1>');let calls=0;
  const adapter=createMarkItDownAdapter({pythonExecutable:process.execPath,runCommand:(_exe,args)=>{calls++;if(args.includes('--version'))return{status:0,stdout:JSON.stringify({available:true,version:'0.1.9'})};return{status:0,stdout:JSON.stringify(fixtureRecord(input))};}});
  const doctor=await adapter.doctor();assert.equal(doctor.ok,true);const result=await adapter.run({inputFile:input,allowedRoot:dir});assert.equal(result.verification_status,'unverified');assert.equal(result.source.sha256,crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'));assert.equal(calls,2);
  await assert.rejects(adapter.run({inputFile:input,allowedRoot:outside}),/outside allowedRoot/);
  const bad=path.join(dir,'fixture.exe');fs.writeFileSync(bad,'x');await assert.rejects(adapter.run({inputFile:bad,allowedRoot:dir}),/extension.*allowlist/);
  const missing=createMarkItDownAdapter({pythonExecutable:path.join(dir,'missing-python.exe')});await assert.rejects(missing.run({inputFile:input,allowedRoot:dir}),/Run npm run deps:markitdown/);
  assert.equal(calls,2,'rejected paths must not reach the worker');
 }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(outside,{recursive:true,force:true});}
});

test('installed MarkItDown converts a local HTML fixture offline and keeps it unverified',async()=>{
 const adapter=createMarkItDownAdapter(),doctor=await adapter.doctor();
 if(!doctor.ok){assert.match(doctor.reason,/environment is not installed|worker check failed/);return;}
 const result=await adapter.smokeTest();assert.equal(result.ok,true,result.reason);assert.equal(result.version,'0.1.9');assert.equal(result.network,'not-requested');
});

test('MarkItDown PDF extra extracts the synthetic local fixture without inventing page locators',async()=>{
 const adapter=createMarkItDownAdapter(),doctor=await adapter.doctor();if(!doctor.ok)return;
 const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
 const input=path.join(root,'examples','research-workflow','fixtures','synthetic-paper.pdf'),allowedRoot=path.dirname(input);
 const result=await adapter.run({inputFile:input,allowedRoot});assert.match(result.content.text,/SYNTHETIC FIXTURE PAPER/);assert.match(result.content.text,/No experiment was run/);assert.deepEqual(result.locators,[{locator:'document',locator_type:'document'}]);assert.equal(result.verification_status,'unverified');
});
