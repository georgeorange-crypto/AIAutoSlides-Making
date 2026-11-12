import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {writeDocumentEvidenceBundle} from '../packages/research/document-ingest.mjs';

test('document evidence bundle keeps source hash, page locators, short excerpts, and pending status',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-doc-evidence-'));try{const input=path.join(dir,'paper.pdf'),prefix=path.join(dir,'out','paper'),bytes=Buffer.from('synthetic source bytes');fs.writeFileSync(input,bytes);const long='A verified-looking but not verified source sentence. '.repeat(20);const result=writeDocumentEvidenceBundle({input,id:'E_DOCLING_TEST',outPrefix:prefix,provenance:{engine:'docling',version:'2.150.0',page_locators:true},blocks:[{locator:'page 3; bbox=1,2,3,4',page:3,content:long,element:'paragraph'}]});
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');assert.equal(result.manifest.source_sha256,digest);assert.equal(result.manifest.blocks[0].page,3);assert.ok(result.evidence.entries[0].excerpt.length<=360);assert.match(result.evidence.entries[0].locator,/page 3/);assert.equal(result.evidence.entries[0].verified,false);assert.equal(result.evidence.entries[0].verification_status,'pending_human_review');assert.throws(()=>writeDocumentEvidenceBundle({input,id:'E_DOCLING_TEST',outPrefix:prefix,provenance:{engine:'docling',version:'2'},blocks:[{content:'repeat'}]}),/Refusing to overwrite/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
