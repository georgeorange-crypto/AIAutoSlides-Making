import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validatePresentationIR,assertValidPresentationIR,createProject,createUserProfile,createSource,createEvidence,createAsset,createClaim,createSlideIR,createDeckIR,createJobState,transitionJob} from '../packages/core/index.mjs';
import {mapPresentationIRToLegacy,pptxgenjsIRAdapter} from '../packages/adapters/pptxgenjs-ir.mjs';
import {pptxgenjsAdapter} from '../packages/adapters/pptxgenjs.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'examples/phase1/pptxgenjs-ir.json'),'utf8'));

test('canonical IR validates stable IDs, source references and keeps verification warnings',()=>{
 const result=validatePresentationIR(fixture);
 assert.equal(result.valid,true,result.errors.join('; '));
 assert.ok(result.warnings.some(message=>message.includes('E_PHASE1_SYN remains unverified')));
});

test('canonical IR rejects unknown/duplicate IDs, malformed chart data and unsupported elements',()=>{
 const unknown=structuredClone(fixture);unknown.slides[1].elements[1].source_ids=['E_MISSING'];
 assert.throws(()=>assertValidPresentationIR(unknown),/unknown source\/evidence ID 'E_MISSING'/);
 const duplicate=structuredClone(fixture);duplicate.slides[2].slide_id='S02';
 assert.throws(()=>assertValidPresentationIR(duplicate),/Duplicate slide_id 'S02'/);
 const chart=structuredClone(fixture);chart.slides[1].elements[1].series[0].values=[12,18];
 assert.throws(()=>assertValidPresentationIR(chart),/chart series must be named, finite, and aligned/);
 const unsupported=structuredClone(fixture);unsupported.slides[0].elements[0].kind='video';
 assert.throws(()=>assertValidPresentationIR(unsupported),/unsupported element kind 'video'/);
 const badImage=structuredClone(fixture);badImage.slides[0].elements.push({element_id:'S01-I01',kind:'image',asset_id:'A_MISSING',alt:'diagram',x:1,y:1,w:2,h:2});
 assert.throws(()=>assertValidPresentationIR(badImage),/image refers to unknown asset ID/);
 const outOfBounds=structuredClone(fixture);outOfBounds.assets=[{asset_id:'A_TEST',media_type:'image/png',rights_status:'pending'}];outOfBounds.slides[0].elements.push({element_id:'S01-I01',kind:'image',asset_id:'A_TEST',alt:'diagram',x:12,y:1,w:2,h:2});
 assert.throws(()=>assertValidPresentationIR(outOfBounds),/image requires positive x\/y\/w\/h within 16:9 slide bounds/);
 const malformedProcess=structuredClone(fixture);malformedProcess.slides[0].elements.push({element_id:'S01-P01',kind:'process',steps:[{detail:'missing title'}]});
 assert.throws(()=>assertValidPresentationIR(malformedProcess),/process requires 2–6 steps with a title/);
});

test('PptxGenJS IR mapping preserves provenance and reports native chart requirements',()=>{
 const result=mapPresentationIRToLegacy(fixture);
 assert.deepEqual(result.deck.slides[1].evidence_ids,['E_PHASE1_SYN']);
 assert.equal(result.evidence.entries[0].verified,false);
 assert.deepEqual(result.deck.slides[1].chart.values,[12,18,15]);
 assert.deepEqual(result.deck.slides[1].chart.categories,['A','B','C']);
});

test('separate evidence records and claim mappings resolve through their parent source',()=>{
 const richer=structuredClone(fixture);
 richer.source_ir.evidence=[{evidence_id:'EV_SYN_01',source_id:'E_PHASE1_SYN',excerpt:'Synthetic excerpt for a contract test.',locator:'fixture row 1',verification_status:'pending'}];
 richer.source_ir.claims=[{claim_id:'C_SYN_01',statement:'A synthetic fixture claim.',evidence_ids:['EV_SYN_01'],review_status:'pending'}];
 richer.slides[1].evidence_ids=['EV_SYN_01'];
 const checked=validatePresentationIR(richer),mapped=mapPresentationIRToLegacy(richer);
 assert.equal(checked.valid,true,checked.errors.join('; '));
 assert.deepEqual(mapped.evidence.entries.map(entry=>entry.id),['E_PHASE1_SYN','EV_SYN_01']);
 assert.equal(mapped.evidence.entries[1].source,'fixture://phase1/native-chart');
 assert.ok(mapped.warnings.some(message=>message.includes('EV_SYN_01 remains pending')));
});

test('PptxGenJS adapter renders IR to native editable PPTX, QA and source/run manifests',async()=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-ir-e2e-'));
 try{
  const inputPath=path.join(root,'examples/phase1/pptxgenjs-ir.json'),inputHash=crypto.createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex');
  const result=await pptxgenjsIRAdapter.render({presentationIR:fixture,workspace,outputDir:workspace,inputHash,inputPath});
  assert.equal(result.status,'completed');
  assert.equal(result.slideCount,3);
  assert.equal(result.slideEditability.length,3);
  assert.ok(result.slideEditability.every(slide=>slide.text));
  assert.equal(result.slideEditability.reduce((sum,slide)=>sum+slide.native_charts,0),1);
  assert.equal(result.qa.chartValuesExact,true);
  assert.deepEqual(result.qa.errors,[]);
  assert.ok(result.warnings.some(message=>message.includes('E_PHASE1_SYN remains unverified')));
  for(const suffix of ['presentation.pptx','presentation.lineage.json','presentation.run-manifest.json','presentation.qa.json'])assert.ok(fs.existsSync(path.join(workspace,suffix)),`${suffix} must exist`);
  const lineage=JSON.parse(fs.readFileSync(path.join(workspace,'presentation.lineage.json'),'utf8'));
  assert.equal(lineage.slides[1].elements[1].source_ids[0],'E_PHASE1_SYN');
  assert.equal(lineage.source_ir_sha256,inputHash);
  const run=JSON.parse(fs.readFileSync(path.join(workspace,'presentation.run-manifest.json'),'utf8'));
  assert.equal(run.inputs[0].sha256,inputHash);assert.equal(run.policy.network,'local-only');assert.equal(run.policy.paid_api_calls,0);assert.equal(run.policy.source_verification,'pending');
  const pptx=result.artifacts.find(item=>item.path.endsWith('presentation.pptx'));
  assert.equal(pptx.editable,'native');
  assert.equal(new Set(result.artifacts.map(item=>item.path)).size,result.artifacts.length);
 }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('ToolAdapter run delegates validated IR to the same end-to-end PPTX workflow',async()=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-tool-run-'));
 try{
  const result=await pptxgenjsAdapter.run({presentationIR:fixture,workspace,outputDir:workspace});
  assert.equal(result.status,'completed');assert.equal(result.slideCount,3);assert.equal(result.qa.chartValuesExact,true);assert.ok(result.artifacts.some(item=>item.path.endsWith('presentation.pptx')));
  await assert.rejects(()=>pptxgenjsAdapter.run({workspace,outputDir:workspace}),/requires presentationIR/);
 }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('IR image assets embed locally with hash, rights warnings, accessible notes and lineage',async()=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-ir-image-')),assetPath=path.join(workspace,'fixture.png');
 try{
  fs.copyFileSync(path.join(root,'tests/fixtures/ocr-synthetic.png'),assetPath);
  const bytes=fs.readFileSync(assetPath),ir=structuredClone(fixture);ir.assets=[{asset_id:'A_PHASE1',uri:'fixture.png',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),media_type:'image/png',source_id:'E_PHASE1_SYN',license:'Synthetic test fixture; original project asset',rights_status:'pending'}];
  ir.slides[0].asset_ids=['A_PHASE1'];ir.slides[0].elements.push({element_id:'S01-I01',kind:'image',asset_id:'A_PHASE1',alt:'Synthetic OCR fixture image',x:9,y:1,w:3,h:1.6,source_ids:['E_PHASE1_SYN']});
  const result=await pptxgenjsIRAdapter.render({presentationIR:ir,workspace,outputDir:workspace});
  assert.equal(result.slideEditability[0].images,1);assert.ok(result.warnings.some(message=>message.includes('A_PHASE1 rights status is pending')));
  const lineage=JSON.parse(fs.readFileSync(path.join(workspace,'presentation.lineage.json'),'utf8'));
  assert.equal(lineage.assets[0].asset_id,'A_PHASE1');assert.equal(lineage.assets[0].sha256,ir.assets[0].sha256);assert.equal(lineage.slides[0].elements.at(-1).alt,'Synthetic OCR fixture image');
  const run=JSON.parse(fs.readFileSync(path.join(workspace,'presentation.run-manifest.json'),'utf8'));assert.ok(run.inputs.some(input=>input.path==='assets/A_PHASE1/fixture.png'&&input.sha256===ir.assets[0].sha256));
  const deck=JSON.parse(fs.readFileSync(path.join(workspace,'presentation.storyboard.json'),'utf8'));assert.equal(deck.slides[0].visuals[0].asset_id,'A_PHASE1');assert.match(deck.slides[0].speaker_notes,/Image description: Synthetic OCR fixture image/);
  const bad=structuredClone(ir);bad.assets[0].sha256='0'.repeat(64);await assert.rejects(()=>pptxgenjsIRAdapter.render({presentationIR:bad,workspace,outputDir:path.join(workspace,'bad')}),/SHA-256 does not match/);
  const restricted=structuredClone(ir);restricted.assets[0].rights_status='restricted';await assert.rejects(()=>pptxgenjsIRAdapter.render({presentationIR:restricted,workspace,outputDir:path.join(workspace,'restricted')}),/restricted and cannot be embedded/);
  const remote=structuredClone(ir);remote.assets[0].uri='https://example.invalid/asset.png';await assert.rejects(()=>pptxgenjsIRAdapter.render({presentationIR:remote,workspace,outputDir:path.join(workspace,'remote')}),/must be a local workspace file/);
  const traversal=structuredClone(ir);traversal.assets[0].uri='../fixture.png';await assert.rejects(()=>pptxgenjsIRAdapter.render({presentationIR:traversal,workspace,outputDir:path.join(workspace,'traversal')}),/must be inside the adapter workspace/);
  const svgPath=path.join(workspace,'unsafe.svg'),svgBytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');fs.writeFileSync(svgPath,svgBytes);
  const unsafeSvg=structuredClone(ir);unsafeSvg.assets[0]={...ir.assets[0],uri:'unsafe.svg',sha256:crypto.createHash('sha256').update(svgBytes).digest('hex'),media_type:'image/svg+xml'};await assert.rejects(()=>pptxgenjsIRAdapter.render({presentationIR:unsafeSvg,workspace,outputDir:path.join(workspace,'unsafe-svg')}),/SVG contains executable or external references/);
 }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('PptxGenJS IR adapter rejects output paths outside the run workspace',async()=>{
 const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-ir-path-'));
 try{await assert.rejects(()=>pptxgenjsIRAdapter.render({presentationIR:fixture,workspace,outputDir:path.dirname(workspace)}),/inside the adapter workspace/);}
 finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('core domain factories preserve versioned project, profile, evidence, claim, asset and job state',()=>{
 const source=createSource({source_id:'SRC1',type:'paper',verification_status:'pending'});
 const evidence=createEvidence({evidence_id:'EV1',source_id:'SRC1',excerpt:'Synthetic excerpt'});
 const asset=createAsset({asset_id:'A1',media_type:'image/png',rights_status:'pending',source_id:'SRC1'});
 const claim=createClaim({claim_id:'C1',statement:'Example claim',evidence_ids:['EV1']});
 const profile=createUserProfile({profile_id:'U1',preferences:{language:'en'}});
 const project=createProject({project_id:'P1',title:'Local project',profile,source_ids:['SRC1']});
 assert.equal(project.profile.profile_id,'U1');assert.equal(source.verification_status,'pending');assert.equal(evidence.verification_status,'pending');assert.equal(asset.rights_status,'pending');assert.deepEqual(claim.evidence_ids,['EV1']);
 const deck=createDeckIR({meta:{title:'Model fixture'},source_ir:{schema_version:'1.0.0',sources:[source]},slides:[createSlideIR({slide_id:'S1',type:'cover',title:'Cover',elements:[]})]});
 assert.equal(deck.schema_version,'1.0.0');
 const job=createJobState({job_id:'J1',project_id:'P1',workflow:'render'}),running=transitionJob(job,'running',{at:'2026-11-12T12:00:00.000Z'}),done=transitionJob(running,'completed',{at:'2026-11-12T12:00:01.000Z'});
 assert.equal(done.status,'completed');assert.equal(done.events.length,2);assert.throws(()=>transitionJob(done,'running'),/Invalid job transition/);
});
