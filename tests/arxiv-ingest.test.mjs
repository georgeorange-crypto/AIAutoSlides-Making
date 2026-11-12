import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createArxivIngest} from '../packages/research/arxiv-ingest.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const results={provider:'arxiv',results:[{source_id:'SRC_ARXIV_FIXTURE',arxiv_id:'2401.01234v2',title:'Synthetic paper',landing_url:'https://arxiv.org/abs/2401.01234'}]};

test('selected arXiv paper writes source bytes, page-located pending evidence, and hashes',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-arxiv-')),outDir=path.join(directory,'paper'),pdf=Buffer.from('%PDF-1.7 synthetic fixture');
 try{
  const ingest=createArxivIngest({download:async id=>{assert.equal(id,'2401.01234v2');return{url:'https://arxiv.org/pdf/2401.01234',bytes:pdf};},extract:async()=>[{locator:'page 1',content:'Synthetic result statement.'},{locator:'page 2',content:''}],clock:()=> '2026-11-12T00:00:00.000Z'});
  const result=await ingest({results,sourceId:'SRC_ARXIV_FIXTURE',outDir});
  assert.deepEqual(fs.readFileSync(path.join(outDir,'source.pdf')),pdf);assert.equal(result.manifest.page_count,2);assert.equal(result.manifest.source_sha256,crypto.createHash('sha256').update(pdf).digest('hex'));assert.equal(result.evidence.entries.length,1);assert.equal(result.evidence.entries[0].locator,'page 1');assert.equal(result.evidence.entries[0].verified,false);assert.equal(result.evidence.entries[0].source_sha256,result.manifest.source_sha256);assert.equal(JSON.parse(fs.readFileSync(path.join(outDir,'evidence.json'),'utf8')).entries.length,1);assert.match(fs.readFileSync(path.join(outDir,'source.manifest.json'),'utf8'),/needs_review/);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('arXiv ingestion extracts a local synthetic PDF through the real PDF.js path',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-arxiv-pdfjs-')),outDir=path.join(directory,'paper'),pdf=fs.readFileSync(path.join(root,'examples/research-workflow/fixtures/synthetic-paper.pdf'));
 try{
  const ingest=createArxivIngest({download:async()=>({url:'https://arxiv.org/pdf/2401.01234',bytes:pdf})});
  const result=await ingest({results,sourceId:'SRC_ARXIV_FIXTURE',outDir});
  assert.ok(result.manifest.page_count>0);assert.ok(result.evidence.entries.length>0);assert.match(fs.readFileSync(path.join(outDir,'extracted.md'),'utf8'),/No experiment was run/);assert.ok(result.evidence.entries.every(entry=>entry.verified===false));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('arXiv ingestion rejects wrong providers, unknown IDs, scanned-only text, and existing outputs',async()=>{
 let calls=0;const ingest=createArxivIngest({download:async()=>{calls++;return{url:'https://arxiv.org/pdf/2401.01234',bytes:Buffer.from('%PDF-')};},extract:async()=>[{locator:'page 1',content:''}]});
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-arxiv-negative-'));
 try{
  await assert.rejects(ingest({results:{provider:'crossref',results:[]},sourceId:'SRC_ARXIV_FIXTURE',outDir:path.join(directory,'wrong')}),/arXiv metadata-search/);
  await assert.rejects(ingest({results,sourceId:'SRC_MISSING',outDir:path.join(directory,'missing')}),/not found/);
  await assert.rejects(ingest({results,sourceId:'SRC_ARXIV_FIXTURE',outDir:path.join(directory,'scanned')}),/no selectable text/);
  const existing=path.join(directory,'existing');fs.mkdirSync(existing);await assert.rejects(ingest({results,sourceId:'SRC_ARXIV_FIXTURE',outDir:existing}),/Refusing to overwrite/);assert.equal(calls,1);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

test('arXiv ingest CLI requires opt-in before reading a result path',()=>{
 const output=path.join(os.tmpdir(),`aiautoslides-arxiv-optin-${process.pid}`),result=spawnSync(process.execPath,[path.join(root,'src/arxiv-ingest.mjs'),'download','--results','missing.json','--source-id','SRC_ARXIV_FIXTURE','--out-dir',output],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,1);assert.match(result.stderr,/requires explicit --allow-download/);assert.equal(fs.existsSync(output),false);
});
