import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {runPresentationWorkflow} from '../packages/workflow/index.mjs';

const fixture=JSON.parse(fs.readFileSync('examples/phase1/pptxgenjs-ir.json','utf8'));
const qualityPlan={quality_contract:{language:'English',visual_slide_ratio_min:0.4,minimum_explanation_units:28},slides:fixture.slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'opening':index===fixture.slides.length-1?'closing':'result',visual_type:'diagram',layout_intent:`layout-${index}`}))};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function adapter(id,{fail=false,nativeCharts=false}={}){
  return{
    manifest:{id,status:'e2e-tested'},
    async probe(){return{status:'available'};},
    async negotiate(){return{ok:true,formats:['pptx'],capabilities:{nativeCharts}};},
    async render({outputDir}){if(fail)throw new Error(`${id} render failed`);const pptx=path.join(outputDir,'presentation.pptx');fs.writeFileSync(pptx,Buffer.from(`synthetic pptx from ${id}`));const warnings=[];return{slideCount:fixture.slides.length,qa:{status:'warning',errors:[],warnings,chartValuesExact:false},warnings,artifacts:[{path:pptx,format:'pptx',sha256:hash(pptx)}]};},
    async export({artifacts,workspace,outputDir}){fs.mkdirSync(outputDir,{recursive:true});return{artifacts:artifacts.map(item=>{const target=path.join(outputDir,path.basename(item.path));fs.copyFileSync(item.path,target);return{path:target,format:item.format,sha256:hash(target)};})};}
  };
}

test('Harness records adapter fallback and stops at the hash-bound human review gate',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-harness-'));
  try{
    const first=adapter('preferred',{fail:true,nativeCharts:true}),fallback=adapter('fallback',{nativeCharts:false});
    const result=await runPresentationWorkflow({jobId:'harness-test',presentationIR:fixture,workspace,outputDir:path.join(workspace,'runs','harness-test'),preview:false,adapters:[first,fallback]});
    assert.equal(result.status,'awaiting_review');assert.equal(result.adapter,'fallback');assert.equal(result.review_context.deck_sha256,hash(path.join(workspace,'runs','harness-test','presentation.pptx')));
    assert.deepEqual(result.review_context.required.visual,[]);assert.equal(result.report.visual_plan.selected_adapter,'fallback');assert.ok(result.report.visual_plan.degraded);assert.ok(result.report.visual_plan.attempts.some(item=>item.adapter==='preferred'&&item.status==='failed'));assert.ok(result.report.visual_plan.attempts.some(item=>item.adapter==='fallback'&&item.status==='fallback-selected'));
    assert.ok(result.report.critique.structural.warnings.some(item=>/degraded/i.test(item)));
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('Harness does not try a degraded fallback when disabled',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-harness-block-'));
  try{
    await assert.rejects(()=>runPresentationWorkflow({jobId:'harness-block-test',presentationIR:fixture,workspace,outputDir:path.join(workspace,'runs','blocked'),preview:false,allowDegradedFallback:false,adapters:[adapter('preferred',{fail:true,nativeCharts:true}),adapter('fallback',{nativeCharts:false})]}),/All compatible presentation adapters failed/);
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('formal Harness run records a blocking quality gate when render QA or page images are missing',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-quality-workflow-'));
  try{
    const result=await runPresentationWorkflow({jobId:'quality-workflow-test',presentationIR:fixture,qualityPlan,workspace,outputDir:path.join(workspace,'runs','quality'),preview:false,adapters:[adapter('only',{nativeCharts:true})]});
    assert.equal(result.status,'awaiting_review');assert.equal(result.review_context.quality_gate_status,'fail');
    assert.ok(result.report.critique.quality_gate.blockers.some(item=>item.code==='QUALITY_RENDER_QA_MISSING'));
    assert.ok(result.report.critique.quality_gate.blockers.some(item=>item.code==='QUALITY_RENDER_SCREEN_BLOCKED'));
    assert.ok(fs.existsSync(path.join(workspace,'runs','quality','workflow.critique.json')));
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('formal Harness reports stacked disclaimer copy as a blocking content finding',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-caveat-workflow-'));
  try{
    const ir=structuredClone(fixture),body=ir.slides[1].elements.find(element=>element.kind==='text');
    body.text='本页解释测量机制与结果之间的关系，并指出关键证据如何支持当前结论。该结果不代表因果关系。当前样本不能证明其他人群也适用。该结论不意味着部署后效果相同。';
    const result=await runPresentationWorkflow({jobId:'caveat-workflow-test',presentationIR:ir,qualityPlan,workspace,outputDir:path.join(workspace,'runs','caveat'),preview:false,adapters:[adapter('only',{nativeCharts:true})]});
    assert.equal(result.review_context.quality_gate_status,'fail');
    assert.ok(result.report.critique.quality_gate.blockers.some(item=>item.code==='QUALITY_CAVEAT_OVERLOAD'));
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
