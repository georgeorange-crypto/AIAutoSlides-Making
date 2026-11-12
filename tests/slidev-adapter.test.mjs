import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createSlidevAdapter} from '../packages/adapters/slidev.mjs';

test('Slidev adapter exports selected formats and preserves lineage as a sidecar',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'slidev-adapter-test-'));
  try {
    const input=path.join(root,'deck.md'),lineage=path.join(root,'lineage.json'),out=path.join(root,'out');
    await writeFile(input,'# Synthetic slide\n');
    await writeFile(lineage,'{"slides":[{"slide_id":"S01","evidence_ids":["E_SYN_01"]}]}\n');
    const calls=[];
    const adapter=createSlidevAdapter({runCommand:async(_bin,args)=>{
      calls.push(args);
      if(args[0]==='--version')return 'v53.1.0';
      const target=args[args.indexOf('--output')+1];
      if(args[args.indexOf('--format')+1]==='png') {await mkdir(target,{recursive:true});await writeFile(path.join(target,'1.png'),'png');}
      else await writeFile(target,'artifact');
      return '';
    }});
    const result=await adapter.run({inputFile:input,outputDir:out,formats:['pptx-editable','pdf','png'],lineageFile:lineage,binary:'fake-slidev'});
    assert.equal(result.backendVersion,'v53.1.0');
    assert.deepEqual(result.artifacts.map(a=>a.kind),['pptx','pdf','png','source-manifest','source-manifest']);
    assert.equal(calls.filter(args=>args[0]==='export').length,3);
    assert.ok(calls.some(args=>args.includes('--with-clicks')&&args.includes('false')));
    assert.equal(await readFile(path.join(out,'slide-lineage.json'),'utf8'),await readFile(lineage,'utf8'));
    const manifest=JSON.parse(await readFile(path.join(out,'slidev-backend-manifest.json'),'utf8'));
    assert.equal(manifest.backend_version,'v53.1.0');
    assert.equal(manifest.artifacts.length,4);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('Slidev adapter rejects unsupported format and missing Markdown input',async()=>{
  const adapter=createSlidevAdapter({runCommand:async()=> 'v53.1.0'});
  const smokeTest=adapter.smokeTest;
  assert.deepEqual(await smokeTest({binary:'fake-slidev'}),{ok:true,version:'v53.1.0',reason:null});
  await assert.rejects(adapter.run({inputFile:'missing.md',outputDir:'out'}),/existing Slidev Markdown/);
  const root=await mkdtemp(path.join(os.tmpdir(),'slidev-adapter-invalid-'));
  try {
    const input=path.join(root,'deck.md');await writeFile(input,'# Slide');
    await assert.rejects(adapter.run({inputFile:input,outputDir:path.join(root,'out'),formats:['html']},),/formats must be/);
  } finally {await rm(root,{recursive:true,force:true});}
});
