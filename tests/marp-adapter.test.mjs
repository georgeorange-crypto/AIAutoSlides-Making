import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';
import {createMarpAdapter,marpAdapter} from '../packages/adapters/marp.mjs';

test('Marp adapter exports HTML and reports rasterized PPTX editability with provenance hashes',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'marp-adapter-test-'));
  try{
    const input=path.join(root,'deck.md'),out=path.join(root,'out');
    await writeFile(input,'---\nmarp: true\n---\n# Synthetic\n');
    const calls=[];
    const adapter=createMarpAdapter({runCommand:async(_binary,args)=>{
      calls.push(args);
      if(args[0]==='--version')return '@marp-team/marp-cli v4.5.1';
      const output=args[args.indexOf('--output')+1];
      if(args.includes('--html'))await writeFile(output,'<html><body>Synthetic</body></html>');
      else await writeFile(output,zipSync({'ppt/slides/slide1.xml':strToU8('<p:sld/>'),'ppt/slides/slide2.xml':strToU8('<p:sld/>'),'ppt/media/image1.png':strToU8('page1'),'ppt/media/image2.png':strToU8('page2')}));
      return '';
    }});
    const result=await adapter.run({inputFile:input,outputDir:out,formats:['html','pptx'],browser:'fake-browser'});
    assert.equal(result.backendVersion,'@marp-team/marp-cli v4.5.1');
    const deck=result.artifacts.find(item=>item.kind==='pptx');
    assert.deepEqual(deck.editability,{slide_count:2,editable_text_runs:0,media_objects:2,rasterized_page_deck:true});
    assert.match(await readFile(path.join(out,'marp-backend-manifest.json'),'utf8'),/does not satisfy editable-text/);
    assert.ok(calls.some(args=>args.includes('--browser-path')&&args.includes('fake-browser')));
  }finally{await rm(root,{recursive:true,force:true});}
});

test('Marp adapter rejects active HTML, remote media, bad formats, and overwrite attempts',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'marp-adapter-negative-'));
  try{
    const input=path.join(root,'deck.md'),out=path.join(root,'out');
    const adapter=createMarpAdapter({runCommand:async(_binary,args)=>{
      if(args[0]==='--version')return 'v4.5.1';
      const output=args[args.indexOf('--output')+1];await writeFile(output,'artifact');return '';
    }});
    await writeFile(input,'# [remote image](https://example.org/a.png)\n![x](https://example.org/x.png)');
    await assert.rejects(adapter.run({inputFile:input,outputDir:out,formats:['html']}),/Remote\/data\/file media/);
    await writeFile(input,'![x][remote]\n\n[remote]: <https://example.org/x.png>');
    await assert.rejects(adapter.run({inputFile:input,outputDir:out,formats:['html']}),/Remote\/data\/file media/);
    await writeFile(input,'# <script>alert(1)</script>');
    await assert.rejects(adapter.run({inputFile:input,outputDir:out,formats:['html']}),/Active HTML/);
    await writeFile(input,'# Safe');
    await assert.rejects(adapter.run({inputFile:input,outputDir:out,formats:['pptx-editable']}),/subset of html, pdf, pptx/);
    await adapter.run({inputFile:input,outputDir:out,formats:['html']});
    await assert.rejects(adapter.run({inputFile:input,outputDir:out,formats:['html']}),/Refusing to overwrite/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('installed Marp CLI completes a synthetic HTML and PPTX end-to-end probe when available',async t=>{
  const doctor=await marpAdapter.doctor();
  if(!doctor.ok||!doctor.browser){t.skip(doctor.reason||'Marp browser/runtime is not installed');return;}
  const result=await marpAdapter.smokeTest();
  assert.equal(result.ok,true,result.reason);
  assert.equal(result.version.includes('4.5.1'),true);
  assert.equal(result.slide_count,2);
  assert.equal(result.rasterized_page_deck,true);
  assert.equal(result.editability,'rasterized slides; source Markdown remains editable');
});
