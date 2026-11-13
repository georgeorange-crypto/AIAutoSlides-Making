import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {runPresentationWorkflow} from '../packages/workflow/index.mjs';

const fixture=JSON.parse(fs.readFileSync('examples/phase1/pptxgenjs-ir.json','utf8'));
const qualityPlan={task:{target_duration_seconds:420,expected_slide_count:fixture.slides.length},quality_contract:{language:'English',visual_slide_ratio_min:0.4,minimum_explanation_units:28,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5},slides:fixture.slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'opening':index===fixture.slides.length-1?'closing':'result',importance:index===1?'core':'supporting',visual_type:'diagram',layout_intent:`layout-${index}`}))};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function adapter(id,{fail=false,nativeCharts=false}={}){
  return{
    manifest:{id,status:'e2e-tested'},
    async probe(){return{status:'available'};},
    async negotiate(){return{ok:true,formats:['pptx'],capabilities:{nativeCharts}};},
    async render({outputDir,presentationIR}){if(fail)throw new Error(`${id} render failed`);const pptx=path.join(outputDir,'presentation.pptx');fs.writeFileSync(pptx,Buffer.from(`synthetic pptx from ${id}`));const warnings=[];return{slideCount:presentationIR.slides.length,qa:{status:'warning',errors:[],warnings,chartValuesExact:false},warnings,artifacts:[{path:pptx,format:'pptx',sha256:hash(pptx)}]};},
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

test('formal Harness reports under-allocated core pages and speaking time',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-priority-workflow-'));
  try{
    const ir=structuredClone(fixture),chartSlide=structuredClone(ir.slides[1]),closing=structuredClone(ir.slides.at(-1));
    const textSlide=(slide_id,title,text)=>({slide_id,type:'statement',title,evidence_ids:['E_PHASE1_SYN'],speaker_notes:'Synthetic allocation test.',elements:[{element_id:`${slide_id}-TEXT`,kind:'text',text,source_ids:['E_PHASE1_SYN']}]});
    const agenda=textSlide('S02','Contents','Results');
    const divider=textSlide('S03','Results','This section explains the mechanism and how the result follows from the supplied evidence.');
    const core=structuredClone(chartSlide);core.slide_id='S04';core.elements.forEach((element,index)=>element.element_id=`S04-E${index+1}`);
    const details=Array.from({length:4},(_,index)=>{const slide=structuredClone(chartSlide);slide.slide_id=`S${String(index+5).padStart(2,'0')}`;slide.elements.forEach((element,n)=>element.element_id=`${slide.slide_id}-E${n+1}`);return slide;});
    closing.slide_id='S09';closing.elements.forEach((element,index)=>element.element_id=`S09-E${index+1}`);
    ir.slides=[ir.slides[0],agenda,divider,core,...details,closing];
    const roles=new Map([['S01','opening'],['S02','agenda'],['S03','section_transition'],['S04','result'],['S09','closing']]);
    const plan={task:{target_duration_seconds:480,expected_slide_count:ir.slides.length},quality_contract:{language:'English',visual_slide_ratio_min:0.4,minimum_explanation_units:18,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5,narrative_sections:['Results']},slides:ir.slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:roles.get(slide.slide_id)||'result',section_name:['S04','S05','S06','S07','S08'].includes(slide.slide_id)?'Results':undefined,importance:slide.slide_id==='S04'?'core':['S05','S06','S07','S08'].includes(slide.slide_id)?'supporting':'standard',visual_type:slide.type==='chart'?'chart':'text',layout_intent:`layout-${slide.slide_id}`}))};
    const result=await runPresentationWorkflow({jobId:'priority-workflow-test',presentationIR:ir,qualityPlan:plan,workspace,outputDir:path.join(workspace,'runs','priority'),preview:false,adapters:[adapter('only',{nativeCharts:true})]});
    const allocation=result.report.critique.quality_gate.priority_allocation,codes=new Set(result.report.critique.quality_gate.blockers.map(item=>item.code));
    assert.equal(allocation.priority_slide_share,0.2);assert.ok(allocation.priority_time_share<0.5);
    assert.ok(codes.has('QUALITY_PRIORITY_SLIDE_SHARE'));assert.ok(codes.has('QUALITY_PRIORITY_TIME_SHARE'));
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
