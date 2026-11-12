import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createCrossrefAdapter} from '../packages/adapters/crossref.mjs';

const payload={status:'ok',message:{DOI:'10.1000/Research.Example',title:['A metadata fixture'],author:[{given:'Ada',family:'Lovelace',ORCID:'https://orcid.org/0000-0000-0000-0001',affiliation:[{name:'Analytical Engine Lab'}]}],publisher:'Example Society',type:'journal-article','container-title':['Journal of Synthetic Fixtures'],'published-print':{'date-parts':[[2024,5]]},abstract:'Publisher text must not be copied into the result.',license:[{URL:'https://creativecommons.org/licenses/by/4.0/',start:{'date-parts':[[2024,5,2]]}}],'update-to':[{type:'retraction',DOI:'10.1000/notice'}]}};
const response=(data=payload,status=200)=>new Response(typeof data==='string'?data:JSON.stringify(data),{status,headers:{'content-type':'application/json'}});

test('Crossref DOI lookup normalizes DOI URLs and returns provenance without abstract text',async()=>{
 let request;
 const adapter=createCrossrefAdapter({minIntervalMs:0,fetchImpl:async(url,options)=>{request={url:new URL(url),options};return response();}});
 const result=await adapter.run({doi:'https://doi.org/10.1000/Research.Example',sourceId:'SRC1',mailTo:'research@example.org'});
 assert.equal(result.status,'completed');assert.equal(result.metadata.doi,'10.1000/Research.Example');assert.equal(result.metadata.source_id,'SRC1');
 assert.equal(result.metadata.title,'A metadata fixture');assert.deepEqual(result.metadata.published_date_parts,[2024,5]);
 assert.equal(result.metadata.authors[0].name,null);assert.equal(result.metadata.authors[0].family,'Lovelace');
 assert.equal(result.metadata.verification_status,'unverified');assert.ok(!('abstract' in result.metadata));assert.match(result.metadata.record_sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(result.metadata.updates,[{type:'retraction',doi:'10.1000/notice',label:null}]);
 assert.equal(request.url.hostname,'api.crossref.org');assert.equal(request.url.searchParams.get('mailto'),'research@example.org');assert.equal(request.options.method,'GET');
 assert.equal(request.options.headers.authorization,undefined);assert.equal(request.options.redirect,'error');
});

test('Crossref rejects invalid DOI and source IDs before making a request',async()=>{
 let calls=0;const adapter=createCrossrefAdapter({fetchImpl:async()=>{calls++;return response();}});
 await assert.rejects(adapter.run({doi:'not a DOI'}),/must be a DOI name/);
 await assert.rejects(adapter.run({doi:'10.1000/example',sourceId:'bad id'}),/sourceId must be a stable/);
 assert.equal(calls,0);
});

test('Crossref responses are size-bounded, DOI-matched and HTTP failures are actionable',async()=>{
 const oversized=createCrossrefAdapter({minIntervalMs:0,fetchImpl:async()=>new Response('x'.repeat(1024),{status:200,headers:{'content-length':String(3*1024*1024)}})});
 await assert.rejects(oversized.run({doi:'10.1000/example'}),/2 MiB safety limit/);
 const mismatch=createCrossrefAdapter({minIntervalMs:0,fetchImpl:async()=>response({status:'ok',message:{DOI:'10.1000/other'}})});
 await assert.rejects(mismatch.run({doi:'10.1000/example'}),/different DOI/);
 for(const [status,pattern] of [[404,/no record/],[429,/rate limit/],[503,/HTTP 503/]]){
  const adapter=createCrossrefAdapter({minIntervalMs:0,fetchImpl:async()=>response({},status)});
  await assert.rejects(adapter.run({doi:'10.1000/example'}),pattern);
 }
});

test('Crossref lookup cache avoids repeated public requests and fixture smoke stays offline',async()=>{
 let calls=0;const adapter=createCrossrefAdapter({minIntervalMs:0,fetchImpl:async()=>{calls++;return response();}});
 const first=await adapter.run({doi:'10.1000/Research.Example'}),second=await adapter.run({doi:'10.1000/Research.Example'});
 assert.equal(first.cache_hit,false);assert.equal(second.cache_hit,true);assert.equal(calls,1);
 const smoke=await adapter.smokeTest();assert.equal(smoke.ok,true);assert.equal(smoke.network,'mock-only');
 assert.equal(first.metadata.record_sha256,crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
});
