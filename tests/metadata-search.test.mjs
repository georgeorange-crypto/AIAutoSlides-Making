import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createMetadataSearch} from '../packages/research/metadata-search.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const jsonResponse=body=>new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
test('OpenAlex search returns bounded candidate metadata, hash and explicit unverified state',async()=>{
 let seen;const search=createMetadataSearch({clock:()=> '2026-11-12T00:00:00.000Z',fetchImpl:async(url,init)=>{seen={url:new URL(url),init};return jsonResponse({results:[{id:'https://openalex.org/W123',doi:'https://doi.org/10.1000/x',title:'Candidate title',publication_year:2023,authorships:[{author:{display_name:'Ada Example'}}],primary_location:{landing_page_url:'https://example.org/paper'},open_access:{is_oa:true}}]});}});
 const result=await search.search({provider:'openalex',query:'evidence synthesis',limit:1});assert.equal(seen.url.hostname,'api.openalex.org');assert.equal(seen.url.searchParams.get('per-page'),'1');assert.equal(result.results[0].verification_status,'unverified');assert.equal(result.results[0].evidence_status,'metadata_candidate_only');assert.equal(result.results[0].publication_year,2023);assert.equal(result.results[0].authors[0],'Ada Example');assert.match(result.results[0].record_sha256,/^[a-f0-9]{64}$/);assert.equal(result.response_sha256,crypto.createHash('sha256').update(JSON.stringify({results:[{id:'https://openalex.org/W123',doi:'https://doi.org/10.1000/x',title:'Candidate title',publication_year:2023,authorships:[{author:{display_name:'Ada Example'}}],primary_location:{landing_page_url:'https://example.org/paper'},open_access:{is_oa:true}}]})).digest('hex'));
});

test('OpenAlex credentials use an authorization header and are never included in result URLs',async()=>{
 const previous=process.env.OPENALEX_API_KEY;process.env.OPENALEX_API_KEY='secret-fixture';let init;
 try{const search=createMetadataSearch({fetchImpl:async(_url,options)=>{init=options;return jsonResponse({results:[]});}});const result=await search.search({provider:'openalex',query:'privacy'});assert.equal(init.headers.authorization,'Bearer secret-fixture');assert.ok(!result.request_url.includes('secret-fixture'));}
 finally{if(previous===undefined)delete process.env.OPENALEX_API_KEY;else process.env.OPENALEX_API_KEY=previous;}
});

test('Crossref search excludes abstracts and maps work records to unverified candidates',async()=>{
 let seen;const search=createMetadataSearch({fetchImpl:async(url)=>{seen=new URL(url);return jsonResponse({message:{items:[{DOI:'10.1000/item',title:['Work title'],author:[{given:'Grace',family:'Hopper'}],published:{'date-parts':[[2022]]},URL:'https://doi.org/10.1000/item','container-title':['Journal'],abstract:'Do not copy abstracts'}]}});}});
 const result=await search.search({provider:'crossref',query:'compiler history'});assert.equal(seen.hostname,'api.crossref.org');assert.equal(result.results[0].doi,'10.1000/item');assert.deepEqual(result.results[0].authors,['Grace Hopper']);assert.equal(result.results[0].publication_year,2022);assert.ok(!('abstract' in result.results[0]));assert.equal(result.results[0].verification_status,'unverified');
});

test('arXiv Atom search extracts paper identity without treating summary as evidence',async()=>{
 const atom='<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><id>https://arxiv.org/abs/2601.12345v2</id><title> A &amp; B research </title><summary>Untrusted abstract.</summary><published>2026-01-02T00:00:00Z</published><author><name>Lin Example</name></author><arxiv:doi>10.1000/example</arxiv:doi></entry></feed>';
 let seen;const search=createMetadataSearch({fetchImpl:async url=>{seen=new URL(url);return new Response(atom,{status:200});}});const result=await search.search({provider:'arxiv',query:'language models'});
 assert.equal(seen.hostname,'export.arxiv.org');assert.equal(result.results.length,1);assert.equal(result.results[0].title,'A & B research');assert.equal(result.results[0].publication_year,2026);assert.equal(result.results[0].arxiv_id,'2601.12345');assert.equal(result.results[0].doi,'10.1000/example');assert.ok(!('abstract' in result.results[0]));assert.equal(result.results[0].verification_status,'unverified');
});

test('metadata search rejects invalid inputs, bad payloads and XML entity declarations',async()=>{
 let calls=0;const search=createMetadataSearch({fetchImpl:async()=>{calls++;return jsonResponse({results:[]});}});
 await assert.rejects(search.search({provider:'unknown',query:'abc'}),/provider must be/);await assert.rejects(search.search({provider:'openalex',query:'x'}),/2-500/);await assert.rejects(search.search({provider:'openalex',query:'valid',limit:11}),/1 to 10/);assert.equal(calls,0);
 const bad=createMetadataSearch({fetchImpl:async()=>new Response('{bad',{status:200})});await assert.rejects(bad.search({provider:'crossref',query:'valid'}),/malformed JSON/);
 const dtd=createMetadataSearch({fetchImpl:async()=>new Response('<!DOCTYPE feed [<!ENTITY x "x">]><feed/>',{status:200})});await assert.rejects(dtd.search({provider:'arxiv',query:'valid'}),/forbidden DTD/);
});

test('durable-job abort signal cancels an in-flight provider request distinctly from timeout',async()=>{
 const controller=new AbortController(),search=createMetadataSearch({fetchImpl:async(_url,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))});
 const pending=search.search({provider:'openalex',query:'cancellation fixture',signal:controller.signal});controller.abort();await assert.rejects(pending,error=>error.name==='AbortError'&&/cancelled/.test(error.message));
});

test('research search CLI stays offline by default and refuses to overwrite an output',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-search-cli-'));
 try{
  const out=path.join(dir,'result.json'),base=[path.join(root,'src/research-search.mjs'),'--provider','openalex','--query','safe fixture query','--out',out];
  const blocked=spawnSync(process.execPath,base,{cwd:root,encoding:'utf8'});assert.equal(blocked.status,1);assert.match(blocked.stderr,/Network is disabled by default/);assert.equal(fs.existsSync(out),false);
  fs.writeFileSync(out,'keep me');const overwrite=spawnSync(process.execPath,[...base,'--allow-network'],{cwd:root,encoding:'utf8'});assert.equal(overwrite.status,1);assert.match(overwrite.stderr,/Refusing to overwrite/);assert.equal(fs.readFileSync(out,'utf8'),'keep me');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
