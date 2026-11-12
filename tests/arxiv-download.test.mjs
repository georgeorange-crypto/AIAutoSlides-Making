import test from 'node:test';
import assert from 'node:assert/strict';
import {createArxivPdfDownloader} from '../packages/research/arxiv-download.mjs';

test('arXiv download derives a URL only from an arXiv identifier and validates PDF signature',async()=>{
 const pdf=Buffer.from('%PDF-1.7\nfixture'),seen=[];const download=createArxivPdfDownloader({fetchImpl:async(url,init)=>{seen.push({url:new URL(url),init});return new Response(pdf,{status:200,headers:{'content-type':'application/pdf'}});}});
 const result=await download('2401.01234v2');assert.equal(seen.length,1);assert.equal(seen[0].url.hostname,'arxiv.org');assert.equal(seen[0].url.pathname,'/pdf/2401.01234');assert.equal(seen[0].init.redirect,'manual');assert.equal(result.url,'https://arxiv.org/pdf/2401.01234');assert.deepEqual(result.bytes,pdf);
});

test('arXiv PDF redirects remain on the allowlist and reject arbitrary hosts',async()=>{
 const pdf=Buffer.from('%PDF-1.4\n'),seen=[];const download=createArxivPdfDownloader({fetchImpl:async(url)=>{seen.push(new URL(url));return seen.length===1?new Response(null,{status:302,headers:{location:'https://export.arxiv.org/ftp/arxiv/papers/2401/2401.01234.pdf'}}):new Response(pdf,{status:200});}});
 const result=await download('2401.01234');assert.equal(seen.length,2);assert.equal(result.url,'https://export.arxiv.org/ftp/arxiv/papers/2401/2401.01234.pdf');
 const unsafe=createArxivPdfDownloader({fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://evil.example/paper.pdf'}})});await assert.rejects(unsafe('2401.01234'),/outside arXiv allowlist/);
});

test('arXiv downloader rejects malformed IDs, non-PDF content, and excessive bodies',async()=>{
 let calls=0;const download=createArxivPdfDownloader({fetchImpl:async()=>{calls++;return new Response('not a PDF',{status:200});}});await assert.rejects(download('https://evil.example/x'),/invalid arXiv identifier/);await assert.rejects(download('2401.01234'),/was not a PDF/);assert.equal(calls,1);
 const tooBig=createArxivPdfDownloader({fetchImpl:async()=>new Response(new Uint8Array([37,80,68,70,45]),{status:200,headers:{'content-length':String(51*1024*1024)}})});await assert.rejects(tooBig('2401.01234'),/exceeds 50 MiB/);
});
