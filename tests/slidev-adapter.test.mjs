import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {zipSync,strToU8} from 'fflate';
import {createSlidevAdapter} from '../packages/adapters/slidev.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const repository=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('Slidev adapter exports selected formats and preserves lineage as a sidecar',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'slidev-adapter-test-'));
  try {
    const input=path.join(root,'deck.md'),lineage=path.join(root,'lineage.json'),out=path.join(root,'out');
    await writeFile(input,'# Synthetic slide\n');
    await writeFile(lineage,'{"slides":[{"slide_id":"S01","evidence_ids":["E_SYN_01"]}]}\n');
    const calls=[],workingDirs=[];
    const adapter=createSlidevAdapter({runCommand:async(_bin,args,options)=>{
      calls.push(args);
      workingDirs.push(options?.cwd);
      if(args[0]==='--version')return 'v53.1.0';
      const format=args[args.indexOf('--format')+1],target=args[args.indexOf('--output')+1];
      if(format==='png') {await mkdir(target,{recursive:true});await writeFile(path.join(target,'1.png'),'png');}
      else if(format==='pptx-editable') await writeFile(target,zipSync({'ppt/notesSlides/notesSlide1.xml':strToU8('<p:notes><a:t>slide_id: S01</a:t><a:t>evidence: E_SYN_01</a:t></p:notes>'),'ppt/slides/slide1.xml':strToU8('<p:sld><a:t>Synthetic slide</a:t></p:sld>')}));
      else await writeFile(target,'artifact');
      return '';
    }});
    const result=await adapter.run({inputFile:input,outputDir:out,formats:['pptx-editable','pdf','png'],lineageFile:lineage,binary:'fake-slidev',projectDir:root,renderTimeoutMs:120000,waitUntil:'load'});
    assert.equal(result.backendVersion,'v53.1.0');
    assert.deepEqual(result.artifacts.map(a=>a.kind),['source-manifest','pptx','lineage-validation','pdf','png','source-manifest']);
    assert.equal(calls.filter(args=>args[0]==='export').length,3);
    assert.ok(calls.some(args=>args.includes('--with-clicks')&&args.includes('false')));
    assert.ok(calls.some(args=>args.includes('--timeout')&&args.includes('120000')&&args.includes('--wait-until')&&args.includes('load')));
    assert.ok(workingDirs.includes(root));
    assert.equal(await readFile(path.join(out,'slide-lineage.json'),'utf8'),await readFile(lineage,'utf8'));
    const manifest=JSON.parse(await readFile(path.join(out,'slidev-backend-manifest.json'),'utf8'));
    assert.equal(manifest.backend_version,'v53.1.0');
    assert.equal(manifest.render.timeout_ms,120000);
    assert.equal(manifest.render.wait_until,'load');
    assert.equal(manifest.render.project_root,path.basename(root));
    assert.equal(manifest.artifacts.length,5);
    assert.equal(JSON.parse(await readFile(path.join(out,'lineage-validation.json'),'utf8')).status,'passed');
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

test('Slidev runIR stages local image assets, compiles process elements and preserves lineage offline',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'slidev-ir-adapter-test-'));
  try{
    const ir=JSON.parse(fs.readFileSync(path.join(repository,'examples/open-source-bakeoff/synthetic-presentation-ir.json'),'utf8'));
    await mkdir(path.join(root,'public/assets'),{recursive:true});const source=path.join(root,'public/assets/fixture.png');await writeFile(source,fs.readFileSync(path.join(repository,'tests/fixtures/ocr-synthetic.png')));
    const bytes=await readFile(source);ir.assets=[{asset_id:'A_SLIDEV',uri:'public/assets/fixture.png',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),media_type:'image/png',source_id:'E_SYN_01',license:'Synthetic fixture',rights_status:'pending'}];
    ir.slides[0].elements.push({element_id:'S01-I01',kind:'image',asset_id:'A_SLIDEV',alt:'Synthetic local image',x:1,y:1,w:3,h:2,source_ids:['E_SYN_01']});
    ir.slides[0].elements.push({element_id:'S01-P01',kind:'process',steps:[{title:'Prepare'},{title:'Render'}],source_ids:['E_SYN_01']});
    const adapter=createSlidevAdapter({runCommand:async(_bin,args)=>{if(args[0]==='--version')return'v53.1.0';await writeFile(args[args.indexOf('--output')+1],'synthetic pdf');return'';}});
    const out=path.join(root,'out'),result=await adapter.runIR({presentationIR:ir,inputDir:root,outputDir:out,formats:['pdf'],binary:'fake-slidev'});
    assert.ok(result.artifacts.some(item=>item.path===path.join(out,'public/assets/fixture.png')));
    assert.match(await readFile(path.join(out,'presentation.md'),'utf8'),/<img src="\/assets\/fixture.png" alt="Synthetic local image"/);
    assert.match(await readFile(path.join(out,'presentation.md'),'utf8'),/01 · Prepare/);
    assert.deepEqual(JSON.parse(await readFile(path.join(out,'presentation.lineage.json'),'utf8')).assets.map(asset=>asset.asset_id),['A_SLIDEV']);
    assert.ok(result.warnings.some(warning=>warning.includes('A_SLIDEV rights status is pending')));
    const modified=structuredClone(ir);modified.assets[0].sha256='0'.repeat(64);
    await assert.rejects(adapter.runIR({presentationIR:modified,inputDir:root,outputDir:path.join(root,'bad'),formats:['pdf'],binary:'fake-slidev'}),/SHA-256 does not match/);
  }finally{await rm(root,{recursive:true,force:true});}
});
