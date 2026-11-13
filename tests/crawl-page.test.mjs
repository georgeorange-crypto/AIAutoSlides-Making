import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {crawlAuthorizedPage} from '../packages/research/crawl-page.mjs';
import {assertPublicHttps,validateSameHostRedirect} from '../packages/research/crawl-policy.mjs';
import {runResearchWorkerAsync} from '../packages/research/python-sidecar.mjs';

test('crawl URL policy rejects private targets and accepts mapped egress only when explicitly declared',async()=>{
 await assert.rejects(assertPublicHttps('http://example.com'),/HTTPS/);
 await assert.rejects(assertPublicHttps('https://user@example.com'),/HTTPS/);
 await assert.rejects(assertPublicHttps('https://127.0.0.1'),/non-public address/);
 await assert.rejects(assertPublicHttps('https://example.test',{lookup:async()=>[{address:'192.168.10.5'}]}),/non-public address/);
 const mapped=await assertPublicHttps('https://example.test',{lookup:async()=>[{address:'192.168.10.5'}],egressCidrs:'192.168.10.0/24'});assert.equal(mapped.mappedEgress,true);
 const page=await assertPublicHttps('https://example.test/path',{lookup:async()=>[{address:'93.184.216.34'}]});assert.equal(page.url.hostname,'example.test');
 assert.throws(()=>validateSameHostRedirect(new URL('https://example.test'),new URL('https://other.test')),/different host/);
});

test('authorized page helper returns source-hashed unverified excerpt candidates after robots confirmation',async()=>{
 const events=[],markdown='# Finding\n\nA synthetic page statement.',url='https://example.test/paper';
 const result=await crawlAuthorizedPage({url,timeoutSeconds:12,onStage:(...event)=>events.push(event),checkUrl:async value=>({url:new URL(value),mappedEgress:false}),runWorker:async(config,options)=>{assert.equal(config.action,'crawl');assert.equal(config.timeout_seconds,12);assert.equal(options.signal,undefined);return{final_url:url,title:'Synthetic page',markdown,robots_checked:true};},clock:()=> '2026-11-12T12:30:00.000Z'});
 assert.equal(result.manifest.final_url,url);assert.equal(result.manifest.reuse_rights,'needs_review');assert.equal(result.manifest.verification_status,'pending_human_review');assert.equal(result.evidenceEntries.length,2);assert.ok(result.evidenceEntries.every(entry=>entry.verification_status==='pending'&&entry.source_sha256===result.sourceHash));assert.deepEqual(events.map(event=>event[1]),['running','completed']);
 await assert.rejects(crawlAuthorizedPage({url,checkUrl:async value=>({url:new URL(value)}),runWorker:async()=>({final_url:url,markdown:'text',robots_checked:false})}),/robots-policy check/);
});

function mockChild(onInput){
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new Writable({write(_chunk,_encoding,callback){callback();},final(callback){onInput(child);callback();}});child.kill=()=>{child.killed=true;setImmediate(()=>child.emit('close',-1,null));return true;};return child;
}

test('async research sidecar parses bounded JSON output and cancels a running child distinctly',async()=>{
 let started;
 const spawnImpl=()=>mockChild(child=>{started=true;setImmediate(()=>{child.stdout.end('{"ok":true}\n');child.stderr.end();child.emit('close',0,null);});});
 const value=await runResearchWorkerAsync({action:'fixture'},{python:process.execPath,workerPath:'fixture.py',spawnImpl});assert.deepEqual(value,{ok:true});assert.equal(started,true);
 const controller=new AbortController(),cancellable=()=>mockChild(()=>{}),pending=runResearchWorkerAsync({action:'fixture'},{python:process.execPath,workerPath:'fixture.py',spawnImpl:cancellable,signal:controller.signal});controller.abort();await assert.rejects(pending,error=>error.name==='AbortError'&&/cancelled/.test(error.message));
});
