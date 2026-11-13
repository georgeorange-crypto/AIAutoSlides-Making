import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {quartoAdapter} from '../packages/adapters/quarto.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),fixture=path.join(root,'examples','open-source-bakeoff','quarto-synthetic.json'),ledger=path.join(root,'examples','open-source-bakeoff','synthetic-evidence.json');
test('Quarto rejects external resources, malformed slide structures and unknown source IDs before running the CLI',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quarto-contract-')),input=path.join(dir,'spec.json'),base=JSON.parse(fs.readFileSync(fixture,'utf8'));
 try{for(const change of [{source_ids:['E_UNKNOWN']},{slides:[{title:'# injection',bullets:['<script>alert(1)</script>']},{title:'Two',bullets:['ok']}]},{title:'https://example.invalid/'},{extra:'not allowed'}]){fs.writeFileSync(input,JSON.stringify({...base,...change}));await assert.rejects(quartoAdapter.run({inputFile:input,evidenceFile:ledger,outputDir:path.join(dir,'out')}));}}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('installed Quarto renders source-linked native-text PPTX and standalone reveal.js HTML',async t=>{
 const doctor=await quartoAdapter.doctor();if(!doctor.ok){t.skip(doctor.reason);return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'quarto-e2e-'));
 try{const result=await quartoAdapter.run({inputFile:fixture,evidenceFile:ledger,outputDir:path.join(dir,'out')}),out=path.join(dir,'out'),html=fs.readFileSync(path.join(out,'quarto-synthetic.html'),'utf8');assert.equal(result.manifest.tool.version,'1.11.9');assert.equal(result.pptx_inspection.native_editable_text,true);assert.equal(result.pptx_inspection.source_ids_on_every_slide,true);assert.ok(result.pptx_inspection.slide_count>=2);assert.match(html,/reveal/);assert.ok(fs.statSync(path.join(out,'quarto-synthetic.pptx')).size>1000);assert.ok(fs.statSync(path.join(out,'quarto-synthetic.quarto.json')).size>0);await assert.rejects(quartoAdapter.run({inputFile:fixture,evidenceFile:ledger,outputDir:out}),/output must be absent or an empty directory/);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
