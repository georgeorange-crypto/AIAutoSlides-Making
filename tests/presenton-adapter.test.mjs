import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';
import {createPresentonAdapter,presentonAdapter} from '../packages/adapters/presenton.mjs';

test('Presenton adapter requires explicit provider opt-in and loopback API configuration',async()=>{
  let calls=0;
  const adapter=createPresentonAdapter({fetchImpl:async()=>{calls++;throw new Error('unexpected call');}});
  await assert.rejects(adapter.run({baseUrl:'https://example.org',apiKey:'test-key',allowProviderUsage:true,slidesMarkdown:['# title'],outputDir:'unused'}),/loopback service URL/);
  await assert.rejects(adapter.run({baseUrl:'http://127.0.0.1:5001',apiKey:'test-key',slidesMarkdown:['# title'],outputDir:'unused'}),/allowProviderUsage:true/);
  assert.equal(calls,0);
});

test('Presenton adapter submits a bounded local API request, downloads same-origin PPTX, and records a credential-free manifest',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'presenton-adapter-test-'));
  const calls=[];
  const pptx=Buffer.from(zipSync({'ppt/presentation.xml':strToU8('<p:presentation/>'),'ppt/slides/slide1.xml':strToU8('<p:sld><a:t>Synthetic</a:t></p:sld>')}));
  const adapter=createPresentonAdapter({fetchImpl:async(url,options)=>{
    calls.push({url:url.href,options});
    if(options.method==='POST')return new Response(JSON.stringify({presentation_id:'presentation-1',path:'/static/presentation.pptx',edit_path:'/presentation?id=presentation-1'}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(pptx,{status:200,headers:{'content-type':'application/vnd.openxmlformats-officedocument.presentationml.presentation','content-length':String(pptx.length)}});
  }});
  try{
    const result=await adapter.run({baseUrl:'http://127.0.0.1:5001',apiKey:'test-key',allowProviderUsage:true,slidesMarkdown:['# Synthetic slide'],outputDir:dir});
    assert.equal(calls.length,2);
    assert.equal(calls[0].options.headers.Authorization,'Bearer test-key');
    assert.equal(calls[0].options.method,'POST');
    const payload=JSON.parse(calls[0].options.body);
    assert.equal(payload.web_search,false);assert.equal(payload.export_as,'pptx');assert.deepEqual(payload.slides_markdown,['# Synthetic slide']);
    assert.equal(calls[1].url,'http://127.0.0.1:5001/static/presentation.pptx');
    assert.deepEqual(await readFile(path.join(dir,'presentation.pptx')),pptx);
    const manifestText=await readFile(path.join(dir,'presenton-manifest.json'),'utf8');
    assert.match(manifestText,/presentation-1/);assert.doesNotMatch(manifestText,/test-key/);
    assert.equal(result.manifest.output.sha256.length,64);
    assert.deepEqual(result.manifest.output.editability,{slide_count:1,editable_text_runs:1,native_charts:0});
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('Presenton adapter rejects external export redirects/URLs and malformed PPTX containers',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'presenton-adapter-negative-'));
  try{
    let calls=0;
    const external=createPresentonAdapter({fetchImpl:async()=>{calls++;return new Response(JSON.stringify({presentation_id:'p1',path:'https://example.org/a.pptx'}),{status:200});}});
    await assert.rejects(external.run({baseUrl:'http://localhost:5001',apiKey:'test-key',allowProviderUsage:true,slidesMarkdown:['# title'],outputDir:dir}),/not on the configured loopback/);
    assert.equal(calls,1);
    const invalid=createPresentonAdapter({fetchImpl:async(_url,options)=>options.method==='POST'?new Response(JSON.stringify({presentation_id:'p2',path:'/bad.pptx'}),{status:200}):new Response('not-pptx',{status:200})});
    await assert.rejects(invalid.run({baseUrl:'http://localhost:5001',apiKey:'test-key',allowProviderUsage:true,slidesMarkdown:['# title'],outputDir:dir}),/not a valid PPTX ZIP container/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('Presenton adapter smoke test validates API request contract without contacting any service',async()=>{
  const result=await presentonAdapter.smokeTest();
  assert.equal(result.ok,true);
  assert.equal(result.contract.includes('no service contact'),true);
  assert.equal(result.web_search,false);
});

test('Presenton doctor is offline and reports missing configuration as blocked',async()=>{
  const oldBase=process.env.PRESENTON_BASE_URL,oldKey=process.env.PRESENTON_API_KEY;
  try{
    delete process.env.PRESENTON_BASE_URL;delete process.env.PRESENTON_API_KEY;
    const result=await presentonAdapter.doctor();
    assert.equal(result.status,'blocked');assert.equal(result.service_contacted,undefined);
  }finally{
    if(oldBase===undefined)delete process.env.PRESENTON_BASE_URL;else process.env.PRESENTON_BASE_URL=oldBase;
    if(oldKey===undefined)delete process.env.PRESENTON_API_KEY;else process.env.PRESENTON_API_KEY=oldKey;
  }
});
