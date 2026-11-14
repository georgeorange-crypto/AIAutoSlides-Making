import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {runPresentationWorkflow} from '../packages/workflow/index.mjs';

const fixture=JSON.parse(fs.readFileSync('examples/phase1/pptxgenjs-ir.json','utf8'));
const qualityPlan={task:{target_duration_seconds:420,expected_slide_count:fixture.slides.length},quality_contract:{language:'English',content_priorities:['Results'],priority_depth:[{priority_id:'Results',depth_level:'standard',minimum_core_slides:2}],visual_slide_ratio_min:0.5,minimum_explanation_units:40,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5},slides:fixture.slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'opening':index===fixture.slides.length-1?'closing':'result',importance:index===1?'core':'supporting',priority_ids:index===1?['Results']:[],visual_type:'diagram',layout_intent:`layout-${index}`,evidence_ids:slide.evidence_ids||[]}))};
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

test('formal Harness rejects a duplicate architecture link before probing a renderer',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-harness-diagram-'));let probes=0;
  try{
    const ir=structuredClone(fixture),slide=ir.slides[1];slide.type='architecture';slide.elements.push({element_id:'S02-D01',kind:'diagram',groups:[{label:'Request path',x:0.8,y:2.5,w:11.5,h:3.5}],nodes:[{id:'client',label:'Client application',x:1,y:3.5,w:2,h:1},{id:'queue',label:'Request queue',x:4.5,y:3.5,w:2,h:1},{id:'worker',label:'Inference worker',x:8,y:3.5,w:2,h:1}],edges:[{from:'client',to:'queue',label:'queues request'},{from:'client',to:'queue',label:'dispatches request'}]});
    const neverRoute={manifest:{id:'must-not-run'},async probe(){probes++;return{status:'available'};},async negotiate(){probes++;return{ok:true,formats:['pptx'],capabilities:{}};},async render(){probes++;throw new Error('invalid architecture reached rendering');}};
    await assert.rejects(()=>runPresentationWorkflow({jobId:'duplicate-architecture-link',presentationIR:ir,workspace,outputDir:path.join(workspace,'runs','duplicate-architecture-link'),preview:false,adapters:[neverRoute]}),/repeats the directed client → queue connection/);
    assert.equal(probes,0,'invalid graph must fail during IR validation before any renderer is probed');
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

test('formal Harness blocks distinct caveats spread across multiple content pages',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-caveat-frequency-workflow-'));
  try{
    const ir=structuredClone(fixture);
    const caveats=['This result does not prove causation.','The sample cannot represent every institution.','This correlation does not establish that the intervention caused improvement.'];
    for(const [index,caveat] of caveats.entries()){const body=ir.slides[index].elements.find(element=>['text','callout'].includes(element.kind));body.text+=` ${caveat}`;}
    const result=await runPresentationWorkflow({jobId:'caveat-frequency-workflow-test',presentationIR:ir,qualityPlan,workspace,outputDir:path.join(workspace,'runs','caveat-frequency'),preview:false,adapters:[adapter('only',{nativeCharts:true})]});
    assert.equal(result.review_context.quality_gate_status,'fail');
    const finding=result.report.critique.quality_gate.blockers.find(item=>item.code==='QUALITY_CAVEAT_PERVASIVE');
    assert.ok(finding,'the formal workflow must expose the deck-wide caveat blocker');
    assert.equal(finding.caveat_page_count,3);
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('formal Harness blocks assistant-facing Chinese copy in the rendered deck path',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-voice-workflow-'));
  try{
    const ir=structuredClone(fixture),body=ir.slides[1].elements.find(element=>element.kind==='text');
    body.text='本页解释测量机制如何影响观察结果，并结合证据说明变化原因。希望这能对您有帮助；如果您愿意，请告诉我还想了解什么。';
    const result=await runPresentationWorkflow({jobId:'voice-workflow-test',presentationIR:ir,qualityPlan,workspace,outputDir:path.join(workspace,'runs','voice'),preview:false,adapters:[adapter('only',{nativeCharts:true})]});
    assert.equal(result.review_context.quality_gate_status,'fail');
    assert.ok(result.report.critique.quality_gate.blockers.some(item=>item.code==='QUALITY_ASSISTANT_VOICE'&&item.slide_id===ir.slides[1].slide_id));
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('formal Harness blocks a full deck built from two alternating repeated page compositions',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-layout-diversity-workflow-'));
  try{
    const ir=structuredClone(fixture),cover=structuredClone(ir.slides[0]),chartTemplate=structuredClone(ir.slides[1]),closing=structuredClone(ir.slides.at(-1));
    const textSlide=(slide_id,title,text)=>({slide_id,type:'statement',title,evidence_ids:['E_PHASE1_SYN'],speaker_notes:'Synthetic layout diversity test.',elements:[{element_id:`${slide_id}-TEXT`,kind:'text',text,source_ids:['E_PHASE1_SYN']}]});
    const agenda=textSlide('S02','Contents','Results'),divider=textSlide('S03','Results','This section explains the mechanism, then connects its steps to the observed outcome.');
    const content=Array.from({length:8},(_,index)=>{
      const slideId=`S${String(index+4).padStart(2,'0')}`;
      if(index%2===0){const slide=structuredClone(chartTemplate);slide.slide_id=slideId;slide.title=`Synthetic chart explanation ${index+1}`;slide.elements.forEach((element,n)=>element.element_id=`${slideId}-E${n+1}`);return slide;}
      return textSlide(slideId,`Synthetic text explanation ${index+1}`,'This page explains one step of the supplied synthetic mechanism and how it connects to the reported outcome.');
    });
    closing.slide_id='S12';closing.elements.forEach((element,index)=>element.element_id=`S12-E${index+1}`);ir.slides=[cover,agenda,divider,...content,closing];
    const plan={task:{target_duration_seconds:600,expected_slide_count:ir.slides.length},quality_contract:{language:'English',content_priorities:['Results'],priority_depth:[{priority_id:'Results',depth_level:'standard',minimum_core_slides:2}],visual_slide_ratio_min:0.5,minimum_explanation_units:40,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5,narrative_sections:['Results']},slides:ir.slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:index===0?'opening':index===1?'agenda':index===2?'section_transition':index===ir.slides.length-1?'closing':'result',...(index>=3&&index<ir.slides.length-1?{section_name:'Results'}:{}),importance:index>=3&&index<7?'core':index>=7&&index<11?'supporting':'standard',priority_ids:index>=3&&index<7?['Results']:[],visual_type:slide.type==='chart'?'chart':'text',layout_intent:`unique-label-${index}`,evidence_ids:slide.evidence_ids||[]}))};
    const result=await runPresentationWorkflow({jobId:'layout-diversity-workflow-test',presentationIR:ir,qualityPlan:plan,workspace,outputDir:path.join(workspace,'runs','layout-diversity'),preview:false,adapters:[adapter('only',{nativeCharts:true})]});
    const gate=result.report.critique.quality_gate,finding=gate.blockers.find(item=>item.code==='QUALITY_LAYOUT_DIVERSITY');
    assert.equal(result.review_context.quality_gate_status,'fail');assert.ok(finding);assert.equal(finding.distinct_signature_count,2);assert.equal(finding.unique_signature_share,0.25);
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('formal Harness does not count Mermaid source rendered as fallback text toward visual coverage',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-unmaterialized-visual-workflow-'));
  try{
    const ir=structuredClone(fixture),slide=ir.slides.find(slide=>slide.type==='chart'),source=slide.evidence_ids[0];
    slide.type='statement';slide.elements=slide.elements.filter(element=>element.kind!=='chart');slide.elements.push({element_id:`${slide.slide_id}-MERMAID`,kind:'mermaid',source:'flowchart LR\nA -.- B',source_ids:[source]});
    const result=await runPresentationWorkflow({jobId:'unmaterialized-visual-workflow-test',presentationIR:ir,qualityPlan,workspace,outputDir:path.join(workspace,'runs','unmaterialized-visual'),preview:false,adapters:[(await import('../packages/adapters/pptxgenjs-ir.mjs')).pptxgenjsIRAdapter]});
    const gate=result.report.critique.quality_gate,finding=gate.blockers.find(item=>item.code==='QUALITY_VISUAL_COVERAGE');
    assert.ok(result.report.critique.structural.renderer_warnings.some(item=>/Mermaid source was preserved as text/.test(item)));assert.equal(result.review_context.quality_gate_status,'fail');assert.ok(finding);assert.equal(gate.visual_slide_count,0);assert.equal(finding.unmaterialized_visuals.length,1);
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
    const plan={task:{target_duration_seconds:480,expected_slide_count:ir.slides.length},quality_contract:{language:'English',content_priorities:['Mechanism','Result'],priority_depth:[{priority_id:'Mechanism',depth_level:'standard',minimum_core_slides:2},{priority_id:'Result',depth_level:'standard',minimum_core_slides:2}],visual_slide_ratio_min:0.5,minimum_explanation_units:40,minimum_priority_slide_share:0.25,minimum_priority_time_share:0.5,narrative_sections:['Results']},slides:ir.slides.map((slide,index)=>({slide_id:slide.slide_id,narrative_role:roles.get(slide.slide_id)||'result',section_name:['S04','S05','S06','S07','S08'].includes(slide.slide_id)?'Results':undefined,importance:slide.slide_id==='S04'?'core':['S05','S06','S07','S08'].includes(slide.slide_id)?'supporting':'standard',priority_ids:slide.slide_id==='S04'?['Mechanism']:slide.slide_id==='S05'?['Result']:[],visual_type:slide.type==='chart'?'chart':'text',layout_intent:`layout-${slide.slide_id}`,evidence_ids:slide.evidence_ids||[]}))};
    const result=await runPresentationWorkflow({jobId:'priority-workflow-test',presentationIR:ir,qualityPlan:plan,workspace,outputDir:path.join(workspace,'runs','priority'),preview:false,adapters:[adapter('only',{nativeCharts:true})]});
    const allocation=result.report.critique.quality_gate.priority_allocation,codes=new Set(result.report.critique.quality_gate.blockers.map(item=>item.code));
    assert.equal(allocation.priority_slide_share,0.2);assert.ok(allocation.priority_time_share<0.5);
    assert.ok(codes.has('QUALITY_PRIORITY_SLIDE_SHARE'));assert.ok(codes.has('QUALITY_PRIORITY_TIME_SHARE'));
    assert.ok(codes.has('QUALITY_PRIORITY_UNCOVERED'),'a stated result cannot be left entirely on supporting pages while an unrelated topic receives the core label');
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});

test('formal Harness treats opening-context pages as content for density and priority allocation',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-opening-context-workflow-'));
  try{
    const ir=structuredClone(fixture),plan=structuredClone(qualityPlan),base=plan.slides.find(slide=>slide.narrative_role==='result');
    plan.quality_contract.minimum_priority_slide_share=0.5;
    for(let index=0;index<3;index++){
      const id=`HIDDEN-${index+1}`;
      ir.slides.push({slide_id:id,type:'statement',title:'Low-priority filler',evidence_ids:['E_PHASE1_SYN'],elements:[{element_id:`${id}-T`,kind:'text',text:'少量文字。'}]});
      plan.slides.push({...base,slide_id:id,narrative_role:'opening_context',importance:'supporting',visual_type:'text',evidence_ids:['E_PHASE1_SYN']});
    }
    plan.task.expected_slide_count=ir.slides.length;
    const result=await runPresentationWorkflow({jobId:'opening-context-workflow-test',presentationIR:ir,qualityPlan:plan,workspace,outputDir:path.join(workspace,'runs','opening-context'),preview:false,adapters:[adapter('only',{nativeCharts:true})]});
    const gate=result.report.critique.quality_gate,codes=new Set(gate.blockers.map(item=>item.code));
    assert.equal(gate.content_slide_count,4);
    assert.ok(codes.has('QUALITY_PRIORITY_SLIDE_SHARE'));
    assert.ok(codes.has('QUALITY_CONTENT_TOO_THIN'));
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
});
