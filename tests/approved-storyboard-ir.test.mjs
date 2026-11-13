import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {unzipSync,strFromU8} from 'fflate';
import {createPlannerDraft} from '../src/ai-plan-contract.mjs';
import {approvalContentHash} from '../src/review-state.mjs';
import {compileApprovedStoryboard} from '../src/compile-approved-storyboard.mjs';
import {validatePresentationIR} from '../packages/core/validate-presentation.mjs';
import {mapPresentationIRToLegacy} from '../packages/adapters/pptxgenjs-ir.mjs';
import {pptxgenjsIRAdapter} from '../packages/adapters/pptxgenjs-ir.mjs';
import {approveDeckPlan,assertApprovedDeckPlan} from '../packages/workflow/deck-gate.mjs';

const response=JSON.parse(fs.readFileSync('examples/open-source-bakeoff/ai-plan/response.json','utf8'));
const evidence=JSON.parse(fs.readFileSync('examples/open-source-bakeoff/ai-plan/evidence.json','utf8'));
function approvedDraft(){
  const draft=createPlannerDraft(response,{audienceProfile:'research_group',duration:7,goal:'Explain the synthetic request flow'});
  draft.meta.human_review={decision:'approve',reviewer:'Synthetic contract-test reviewer',note:'Test fixture approval only; not a real deck review.',reviewed_at:'2026-11-13T00:00:00.000Z',acknowledged_all_critic_findings:true,content_sha256:approvalContentHash(draft)};
  return draft;
}
function planFor(ir){
  const slides=ir.slides.map((slide,index)=>({slide_id:slide.slide_id,assertion:slide.assertion_title,evidence_ids:slide.evidence_ids,visual_type:slide.type==='architecture'?'editable architecture diagram':slide.type==='process'?'editable process':'text',visual_source:'synthetic fixture',tool_id:'pptxgenjs-ir',rights_status:'original synthetic content',narrative_role:index===0?'opening':index===ir.slides.length-1?'closing':'explanation',importance:index===0||index===ir.slides.length-1?'supporting':'core',explanation_goal:'Explain the synthetic fixture',visual_rationale:'Preserve fixture narrative and editable visual',layout_intent:slide.design.legacy_layout||'assertion-evidence'}));
  return{schema_version:'1.1.0',task:{scope:'Synthetic compiler contract test',expected_slide_count:slides.length,target_duration_seconds:420},quality_contract:{audience:'Test reader',purpose:'Exercise approved storyboard compilation',language:'English',style_reference:'Synthetic fixture',content_priorities:['contract'],narrative_sections:['setup','flow','boundary'],avoid_patterns:['unreviewed draft'],visual_slide_ratio_min:0.5,minimum_explanation_units:18,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5},materials:[{path:'synthetic fixture',sha256:'a'.repeat(64),read_status:'read'}],tools:[{id:'pptxgenjs-ir',status:'e2e-tested',evidence:'Existing local adapter tests'}],slides,representative_slides:[ir.slides[1].slide_id],acceptance:{reviewer:'Test fixture only',gates:['structure','source','visual']}};
}

test('compiler blocks a pending draft and refuses a post-approval edit',()=>{
  const pending=createPlannerDraft(response,{audienceProfile:'research_group',duration:7,goal:'Explain the synthetic request flow'});
  assert.throws(()=>compileApprovedStoryboard(pending,evidence),/human approval/);
  const stale=approvedDraft();stale.slides[1].title+=' edited after review';
  assert.throws(()=>compileApprovedStoryboard(stale,evidence),/stale/);
  assert.throws(()=>compileApprovedStoryboard(approvedDraft(),{entries:[{id:'E_SYN',label:'Synthetic',source:'fixture'}]}),/verified:boolean/);
});

test('approved synthetic storyboard compiles to valid IR with editable visuals and source states preserved',async()=>{
  const ir=compileApprovedStoryboard(approvedDraft(),evidence,{sourcePath:'synthetic-storyboard.json',evidencePath:'synthetic-evidence.json'});
  assert.equal(validatePresentationIR(ir).valid,true);
  assert.equal(ir.meta.storyboard_review_status,'approved');
  assert.equal(ir.meta.human_review_record.reviewer,'Synthetic contract-test reviewer');
  assert.equal(ir.source_ir.sources.find(source=>source.source_id==='E_SYN').verification_status,'unverified');
  const cover=ir.slides[0],coverProcess=cover.elements.find(element=>element.element_id==='S01-CV01');
  assert.equal(coverProcess.kind,'process');assert.deepEqual(coverProcess.steps,response.slides[1].visual_needs[0].steps.slice(0,3));
  assert.ok(coverProcess.source_ids.every(id=>cover.evidence_ids.includes(id)));
  assert.equal(ir.slides.find(slide=>slide.type==='process').elements.find(element=>element.kind==='process').steps.length,3);
  const diagram=ir.slides.find(slide=>slide.type==='architecture').elements.find(element=>element.kind==='diagram');
  assert.equal(diagram.nodes.length,5);assert.equal(diagram.edges.length,4);assert.deepEqual(diagram.edges.map(edge=>edge.label),['forwards request','routes request','assigns work','retrieves value']);
  const mapped=mapPresentationIRToLegacy(ir).deck.slides.find(slide=>slide.slide_id==='S04');
  assert.equal(mapped.type,'statement');assert.match(mapped.figure_description,/Map scheduler branches/);assert.equal(mapped.diagram.edges.length,4);
  const mappedCover=mapPresentationIRToLegacy(ir).deck.slides[0];assert.deepEqual(mappedCover.cover_visual.steps,response.slides[1].visual_needs[0].steps.slice(0,3));
  assert.ok(ir.slides.every(slide=>slide.elements.filter(element=>element.kind==='text').every(element=>element.source_ids.every(id=>slide.evidence_ids.includes(id)))));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-storyboard-ir-render-'));
  try{
    const rendered=await pptxgenjsIRAdapter.render({presentationIR:ir,workspace:dir,outputDir:dir});
    const pptx=rendered.artifacts.find(item=>item.format==='pptx').path,files=unzipSync(new Uint8Array(fs.readFileSync(pptx))),coverXml=strFromU8(files['ppt/slides/slide1.xml']),processXml=strFromU8(files['ppt/slides/slide2.xml']);
    assert.match(coverXml,/THE STORY IN THREE STEPS/);
    for(const step of response.slides[1].visual_needs[0].steps.slice(0,3))assert.ok(coverXml.includes(step),`cover must show the source-linked story cue: ${step}`);
    assert.match(processXml,/The client sends a hypothetical request containing its task and inputs\./);
    assert.match(processXml,/The gateway receives that request as the first named stage in the synthetic brief\./);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
  assert.throws(()=>approveDeckPlan(planFor(ir),{reviewer:'Synthetic gate test',note:'Contract test only'}),/exactly one agenda/);
});

test('CLI writes canonical IR and Harness still blocks a PPT run without its deck-plan gate',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-storyboard-ir-'));
  try{
    const input=path.join(dir,'approved.json'),output=path.join(dir,'presentation-ir.json');
    fs.writeFileSync(input,`${JSON.stringify(approvedDraft(),null,2)}\n`);
    const compiled=spawnSync(process.execPath,['src/storyboard-to-ir.mjs','--input',input,'--evidence','examples/open-source-bakeoff/ai-plan/evidence.json','--out',output],{encoding:'utf8'});
    assert.equal(compiled.status,0,compiled.stderr);assert.match(compiled.stdout,/Compiled 6 reviewed storyboard slides/);
    const harness=spawnSync(process.execPath,['src/harness.mjs','run','--input',output,'--workspace',path.join(dir,'workspace'),'--task-type','ppt'],{encoding:'utf8'});
    assert.equal(harness.status,1);assert.match(harness.stderr,/PPT tasks require --deck-plan/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
