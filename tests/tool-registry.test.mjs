import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {migrateLegacyEvidence,migrateLegacyStoryboard,createRunManifest} from '../packages/contracts/migrate.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const run=(...args)=>spawnSync(process.execPath,[path.join(root,'src/tools.mjs'),...args],{cwd:root,encoding:'utf8',timeout:30000});

test('catalog entries carry required metadata and safe initial verification states',()=>{
 const dir=path.join(root,'registry/catalog'),files=fs.readdirSync(dir).filter(x=>x.endsWith('.yaml'));
 assert.ok(files.length>=50);
 for(const file of files){const x=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));for(const key of ['id','official_url','license','version','interface','platforms','capabilities','inputs','outputs','dependencies','needs_network','needs_auth','expected_cost','editable','verification_status'])assert.ok(key in x,`${file} missing ${key}`);assert.ok(['needs-review','verified-in-repository','verified-from-package-metadata'].includes(x.license.review_status));}
});
test('the versioned IR, project and job schemas are valid JSON with contract IDs and version',()=>{
 const dir=path.join(root,'packages/contracts');
 for(const [file,id] of [['source-evidence.schema.json','source-evidence-1.0.0.json'],['presentation.schema.json','presentation-1.0.0.json'],['run-manifest.schema.json','run-manifest-1.0.0.json'],['project.schema.json','project-1.0.0.json'],['job.schema.json','job-1.0.0.json']]){const schema=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));assert.ok(schema.$id.endsWith(id));assert.equal(schema.properties.schema_version.const,'1.0.0');}
});
test('tools list is local and includes the full catalogue',()=>{const r=run('tools','list');assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/55 catalog entries/);assert.match(r.stdout,/pptxgenjs-ir/);assert.match(r.stdout,/ooxml-text-replacer/);assert.match(r.stdout,/mermaid/);assert.match(r.stdout,/tesseract-js.*e2e-tested/);});
test('tools doctor gives actionable blocked status for catalog-only tool',()=>{const r=run('tools','doctor','docling');assert.equal(r.status,1);assert.match(r.stdout,/docling: blocked/);assert.match(r.stdout,/Executable 'docling' not found/);});
test('Mermaid doctor and smoke test distinguish installed from blocked optional worker',()=>{const doctor=run('tools','doctor','mermaid');if(doctor.status===0){assert.match(doctor.stdout,/mermaid: available \(12\.2\.0\)/);const smoke=run('tools','test','mermaid');assert.equal(smoke.status,0,smoke.stdout+smoke.stderr);assert.match(smoke.stdout,/mermaid: smoke-tested/);assert.match(smoke.stdout,/nodes_verified/);}else{assert.match(doctor.stdout,/mermaid: blocked/);assert.match(doctor.stdout,/npm run deps:mermaid/);}});
test('tools test creates and inspects a real PptxGenJS deck with a native chart',()=>{const r=run('tools','test','pptxgenjs');assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/pptxgenjs: smoke-tested/);assert.match(r.stdout,/native_chart.*true/);});
test('tools test runs the Presentation IR to editable PPTX end-to-end smoke path',()=>{const r=run('tools','test','pptxgenjs-ir');assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/pptxgenjs-ir: smoke-tested/);assert.match(r.stdout,/"native_charts":1/);assert.match(r.stdout,/"chart_values_exact":true/);});
test('tools test performs a real local PPTX text-edit smoke test',()=>{const r=run('tools','test','ooxml-text-replacer');assert.equal(r.status,0,r.stdout+r.stderr);assert.match(r.stdout,/ooxml-text-replacer: smoke-tested/);assert.match(r.stdout,/untouched_slides_identical_xml/);});
test('workflow recommendation returns stage-specific alternatives without running them',()=>{const r=run('tools','recommend','research');assert.equal(r.status,0,r.stderr);const x=JSON.parse(r.stdout);assert.ok(x.stages.length>=3);assert.equal(x.stages[0].primary.id,'pdfjs-dist');assert.ok(x.stages[0].alternatives.some(t=>t.id==='docling'));assert.match(x.stages.find(s=>s.stage==='editable deck').primary.implementation,/validated Presentation IR/);assert.equal(x.stages.find(s=>s.stage==='editable deck').alternatives[0].execution,'not run by recommendation');assert.match(x.policy,/never invoked/);});
test('OAuth status and doctor are local config-only and do not contact providers',()=>{const r=run('tools','auth-status');assert.equal(r.status,0);assert.match(r.stdout,/google-slides: not configured/);const d=run('tools','doctor','google-slides');assert.equal(d.status,1);assert.match(d.stdout,/Set GOOGLE_OAUTH_CLIENT_FILE/);});
test('legacy evidence and storyboard migrate while preserving IDs, notes and unknown-ID errors',()=>{
 const ev=migrateLegacyEvidence({entries:[{id:'E1',source:'paper.pdf',locator:'p. 2',verified:false}]});assert.equal(ev.sources[0].source_id,'E1');assert.equal(ev.sources[0].verification_status,'unverified');
 const ir=migrateLegacyStoryboard({meta:{title:'Example'},slides:[{type:'statement',title:'Claim',evidence_ids:['E1'],speaker_notes:'Say this.'}]},{evidence:{entries:[{id:'E1',source:'paper.pdf'}]}});assert.equal(ir.slides[0].slide_id,'S01');assert.equal(ir.slides[0].speaker_notes,'Say this.');assert.deepEqual(ir.slides[0].evidence_ids,['E1']);
 assert.throws(()=>migrateLegacyStoryboard({slides:[{type:'chart',title:'Bad',evidence_ids:['EX']} ]},{evidence:{entries:[]}}),/Unknown evidence IDs/);
});
test('run manifest preserves outputs and hashes provided content',()=>{const m=createRunManifest({runId:'r1',workflow:'research',outputs:[{path:'deck.pptx',content:'fixture'}]});assert.match(m.outputs[0].sha256,/^[a-f0-9]{64}$/);assert.equal(m.schema_version,'1.0.0');});
