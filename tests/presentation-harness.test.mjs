import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {runPresentationWorkflow} from '../packages/workflow/index.mjs';

const fixture=JSON.parse(fs.readFileSync('examples/phase1/pptxgenjs-ir.json','utf8'));
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
