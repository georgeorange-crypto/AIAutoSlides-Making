import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {matplotlibAdapter} from '../packages/adapters/matplotlib.mjs';

test('Matplotlib rejects unknown source IDs before starting the worker',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'matplotlib-unknown-id-'));
  try{
    const input=path.join(dir,'chart.json'),ledger=path.join(dir,'evidence.json');
    fs.writeFileSync(input,JSON.stringify({schema_version:'1.0.0',source_ids:['E_UNKNOWN']}));
    fs.writeFileSync(ledger,JSON.stringify({entries:[{id:'E_KNOWN',verified:false}]}));
    await assert.rejects(matplotlibAdapter.run({inputFile:input,evidenceFile:ledger,outputDir:path.join(dir,'out')}),/Unknown or missing source ID/);
    fs.writeFileSync(input,JSON.stringify({schema_version:'1.0.0',source_ids:['EVID_ONLY']}));
    fs.writeFileSync(ledger,JSON.stringify({schema_version:'1.0.0',sources:[],evidence:[{evidence_id:'EVID_ONLY',source_id:'SRC_1',excerpt:'test',verification_status:'pending'}]}));
    await assert.rejects(matplotlibAdapter.run({inputFile:input,evidenceFile:ledger,outputDir:path.join(dir,'out-evidence-only')}),/Unknown or missing source ID/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('installed Matplotlib rejects malformed and non-monotonic chart data',async t=>{
  const doctor=await matplotlibAdapter.doctor();
  if(!doctor.ok){t.skip(doctor.reason);return;}
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'matplotlib-invalid-data-'));
  try{
    const ledger=path.resolve('examples/open-source-bakeoff/synthetic-evidence.json');
    const base={schema_version:'1.0.0',figure_id:'FIG_TEST',kind:'line',title:'Test',x_label:'x',y_label:'y',x:[1,2],series:[{name:'sample',y:[2,3]}],source_ids:['E_SYN_01']};
    const malformed=path.join(dir,'malformed.json');
    fs.writeFileSync(malformed,JSON.stringify({...base,series:[{name:'sample',y:[2]}]}));
    await assert.rejects(matplotlibAdapter.run({inputFile:malformed,evidenceFile:ledger,outputDir:path.join(dir,'out-malformed')}),/same length as x/);
    const cdf=path.join(dir,'cdf.json');
    fs.writeFileSync(cdf,JSON.stringify({...base,kind:'cdf',series:[{name:'sample',y:[0.8,0.4]}]}));
    await assert.rejects(matplotlibAdapter.run({inputFile:cdf,evidenceFile:ledger,outputDir:path.join(dir,'out-cdf')}),/nondecreasing/);
    fs.writeFileSync(cdf,JSON.stringify({...base,kind:'cdf',x:[2,1],series:[{name:'sample',y:[0.4,0.8]}]}));
    await assert.rejects(matplotlibAdapter.run({inputFile:cdf,evidenceFile:ledger,outputDir:path.join(dir,'out-cdf-x')}),/x values must be nondecreasing/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('installed Matplotlib renders bar, scatter, and CDF figures from explicit mappings',async t=>{
  const doctor=await matplotlibAdapter.doctor();
  if(!doctor.ok){t.skip(doctor.reason);return;}
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'matplotlib-kinds-'));
  const evidence=path.resolve('examples/open-source-bakeoff/synthetic-evidence.json');
  const common={schema_version:'1.0.0',figure_id:'FIG_KIND',title:'Synthetic figure test',x_label:'x',y_label:'y',source_ids:['E_SYN_01']};
  try{
    const cases=[
      {kind:'bar',x:['A','B'],series:[{name:'series',y:[1,2]}]},
      {kind:'scatter',x:[1,2],series:[{name:'series',y:[1,2]}]},
      {kind:'cdf',x:[1,2],series:[{name:'series',y:[0.5,1]}]}
    ];
    for(const [index,chart] of cases.entries()){
      const input=path.join(dir,`${chart.kind}.json`),out=path.join(dir,`out-${index}`);
      fs.writeFileSync(input,JSON.stringify({...common,...chart}));
      const result=await matplotlibAdapter.run({inputFile:input,evidenceFile:evidence,outputDir:out});
      assert.equal(result.manifest.kind,chart.kind);
      assert.ok(fs.statSync(path.join(out,'figure.svg')).size>1000);
      assert.ok(fs.statSync(path.join(out,'figure.png')).size>1000);
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('installed Matplotlib renders the pinned synthetic scientific figure through the real worker',async t=>{
  const doctor=await matplotlibAdapter.doctor();
  if(!doctor.ok){t.skip(doctor.reason);return;}
  const result=await matplotlibAdapter.smokeTest();
  assert.equal(result.ok,true,result.reason);
  assert.equal(result.version,'3.10.8');
  assert.equal(result.kind,'line');
  assert.equal(result.observations,5);
  assert.deepEqual(result.source_ids,['E_SYN_01']);
});
