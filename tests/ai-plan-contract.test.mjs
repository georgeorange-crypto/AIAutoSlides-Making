import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEvidence,validateDeck} from '../src/validate.mjs';
import {generatePresentation} from '../src/render.mjs';
import {auditTextLayout} from '../src/layout-audit.mjs';
import {unzipSync} from 'fflate';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {auditPlannerQuality,createPlannerContract,createPlannerDraft,createPlannerReviewRecord} from '../src/ai-plan-contract.mjs';

const ledger=loadEvidence('sources/evidence.json');
const slide=(type,title,evidence_ids=[])=>({type,title,kicker:'Synthetic draft',assertion_title:`Draft assertion: ${title}`,body:['The first source-grounded explanation describes the mechanism and its role in the argument.','The second explanation connects this point to evidence, implications, or a concrete decision.'],evidence_ids,layout:type==='bullets'?'two-column-contrast':'assertion-evidence',visual_needs:['statement','bullets'].includes(type)?[{kind:'process',description:`Explain ${title} with a labeled evidence-linked visual`,evidence_ids,nodes:[],edges:[],steps:['Receive the source input','Check the evidence link','Produce a reviewable output']}]:[],speaker_notes:`Draft speaker notes for ${title}.`});
const response={title:'Draft research talk',subtitle:'Review required',narrative_structure:'problem-method-evidence-limitations-next-steps',structure_rationale:'Start with motivation, then evidence and limitations.',slides:[slide('cover','Motivation'),slide('statement','Question',['E1']),slide('bullets','Approach',['E1']),slide('statement','Evidence',['E1']),slide('statement','Limitations',['E2']),slide('closing','Next steps',['E2'])]};

test('AI planning contract asks for narrative, per-slide assertion, layout, visuals and speaker notes without a network call',()=>{
  const {schema,policy}=createPlannerContract({audienceProfile:'research_group',duration:7,goal:'Agree on the next experiment',evidenceIds:['E1','E2']});
  assert.deepEqual(schema.required,['title','subtitle','narrative_structure','structure_rationale','slides']);
  assert.deepEqual(schema.properties.slides.items.required,['type','title','kicker','assertion_title','body','evidence_ids','layout','visual_needs','speaker_notes']);
  assert.match(policy,/target duration 7 minutes/);assert.match(policy,/Agree on the next experiment/);assert.match(policy,/Never invent numbers/);assert.match(policy,/do not label any source verified/);
  assert.match(policy,/at least 30%/);assert.match(policy,/never address the user/);
});

test('AI planner draft preserves rich storyboard fields and stays behind the existing human review gate',()=>{
  const draft=createPlannerDraft(response,{audienceProfile:'research_group',duration:7,goal:'Agree on the next experiment'});
  assert.equal(draft.meta.requires_human_review,true);assert.equal(draft.meta.narrative_structure,response.narrative_structure);
  assert.equal(draft.slides[2].speaker_notes,response.slides[2].speaker_notes);assert.deepEqual(draft.slides[2].steps,response.slides[2].visual_needs[0].steps);
  assert.equal(auditPlannerQuality(response).status,'pass');
  assert.deepEqual(validateDeck(draft,ledger).errors,[]);
});

test('planner quality gate rejects title-only pages, missing visual plans, repetitive layouts, and assistant voice',()=>{
  const bad={...response,slides:[...response.slides.slice(0,-1),slide('statement','Repeated fifth page'),response.slides.at(-1)].map((item,index)=>index>0&&index<6?{...item,body:['Short text'],visual_needs:[],type:'statement',layout:'assertion-evidence',...(index===1?{kicker:'Please note this for you'}:{})}:item)};
  const audit=auditPlannerQuality(bad);const rules=new Set(audit.findings.map(x=>x.rule_id));
  assert.equal(audit.status,'blocked');
  for(const rule of ['PLAN-THIN','PLAN-DEPTH','PLAN-VISUAL-RATIO','PLAN-REPETITION','PLAN-ASSISTANT-VOICE'])assert.ok(rules.has(rule),`missing ${rule}`);
});

test('planner quality gate does not count an empty visual placeholder toward coverage',()=>{
  const weak={...response,slides:response.slides.map((item,index)=>index===1?{...item,visual_needs:[{kind:'architecture',description:'',evidence_ids:['E1'],nodes:[{id:'N1',label:'Client'},{id:'N2',label:'Gateway'},{id:'N3',label:'Worker'}],edges:[{from:'N1',to:'N2',label:'request'},{from:'N2',to:'N3',label:'dispatch'}],steps:[]}]}:item)};
  const audit=auditPlannerQuality(weak);
  assert.equal(audit.metrics.visual_slides,3);
  assert.equal(audit.metrics.visual_slides,auditPlannerQuality(response).metrics.visual_slides-1);
  assert.ok(audit.findings.some(x=>x.rule_id==='PLAN-VISUAL-SPEC'));
});

test('planner quality gate checks every requested visual and rejects unsupported bookend visuals',()=>{
  const mixed={...response,slides:response.slides.map((item,index)=>index===1?{...item,visual_needs:[...item.visual_needs,{kind:'data-figure',description:'Use an image-like chart to show the trend.',evidence_ids:['E1'],nodes:[],edges:[],steps:[]}]}:index===0?{...item,visual_needs:[{kind:'process',description:'Show the presentation production stages.',evidence_ids:[],nodes:[],edges:[],steps:['Plan story','Build slides','Review output']}]}:item)};
  const rules=new Set(auditPlannerQuality(mixed).findings.map(item=>item.rule_id));
  assert.ok(rules.has('PLAN-VISUAL-UNMATERIALIZED'));
  assert.ok(rules.has('PLAN-BOOKEND-VISUAL'));
});

test('planner quality gate rejects multiple visual specs that cannot all fit the current slide renderer',()=>{
  const mixed={...response,slides:response.slides.map((item,index)=>index===1?{...item,visual_needs:[...item.visual_needs,{kind:'process',description:'Show a second sequential process for comparison.',evidence_ids:['E1'],nodes:[],edges:[],steps:['Read the second input','Review the second evidence','Render the second result']}]}:item)};
  assert.ok(auditPlannerQuality(mixed).findings.some(item=>item.rule_id==='PLAN-MULTIPLE-VISUALS'));
});

test('planner compiles an evidence-linked architecture specification into bounded editable diagram geometry',()=>{
  const diagramSlide={...slide('statement','Synthetic routing',['E1']),visual_needs:[{kind:'architecture',description:'Show the request path and named stages from input to execution.',evidence_ids:['E1'],nodes:[{id:'N1',label:'Client'},{id:'N2',label:'Gateway'},{id:'N3',label:'Scheduler'},{id:'N4',label:'Worker'}],edges:[{from:'N1',to:'N2',label:'request'},{from:'N2',to:'N3',label:'forward'},{from:'N3',to:'N4',label:'dispatch'}],steps:[]}]};
  const draft=createPlannerDraft({...response,slides:[response.slides[0],diagramSlide,...response.slides.slice(2)]},{audienceProfile:'research_group',duration:7,goal:'Explain the synthetic request path'});
  const diagram=draft.slides[1].diagram;
  assert.equal(diagram.nodes.length,4);assert.equal(diagram.edges.length,3);
  assert.ok(diagram.nodes.every(node=>node.x>=0&&node.y>=2.35&&node.x+node.w<=13.333&&node.y+node.h<=6.85));
});

test('planner-generated process and architecture visuals render as native editable PowerPoint shapes with explanatory text',async()=>{
  const process={...slide('statement','Synthetic process',['E1']),layout:'two-column-contrast'};
  const architecture={...slide('statement','Synthetic architecture',['E1']),visual_needs:[{kind:'architecture',description:'Map the request path and its two distinct execution destinations.',evidence_ids:['E1'],nodes:[{id:'N1',label:'Client'},{id:'N2',label:'Gateway'},{id:'N3',label:'Scheduler'},{id:'N4',label:'Worker'},{id:'N5',label:'Cache'}],edges:[{from:'N1',to:'N2',label:'request'},{from:'N2',to:'N3',label:'forward'},{from:'N3',to:'N4',label:'dispatch'},{from:'N3',to:'N5',label:'lookup'}],steps:[]}]};
  const storyboard={...response,slides:[response.slides[0],process,architecture,response.slides[2],response.slides[3],response.slides[4],response.slides[5]]};
  const draft=createPlannerDraft(storyboard,{audienceProfile:'research_group',duration:7,goal:'Check editable visuals'}),dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-planner-visuals-'));
  try{
    const output=path.join(dir,'visuals.pptx'),theme=JSON.parse(fs.readFileSync('themes/academic-light.json','utf8'));
    await generatePresentation(draft,ledger,theme,output);
    const files=unzipSync(new Uint8Array(fs.readFileSync(output))),xml=new TextDecoder().decode(files['ppt/slides/slide2.xml']),archXml=new TextDecoder().decode(files['ppt/slides/slide3.xml']);
    assert.ok(xml.includes('Receive the source input')&&xml.includes('Produce a reviewable output'));
    assert.ok((xml.match(/<p:sp>/g)||[]).length>=12,'process visual should be native shapes and editable text');
    assert.ok(archXml.includes('Client')&&archXml.includes('Gateway')&&archXml.includes('Scheduler')&&archXml.includes('Worker')&&archXml.includes('Cache'));
    assert.ok((archXml.match(/<p:sp>/g)||[]).length>=8,'architecture visual should use native shapes and editable text');
    for(const pageXml of [xml,archXml]){const audit=auditTextLayout(pageXml,13.333*914400,7.5*914400);assert.ok(audit.textBounds.every(item=>item.ok),'planner visuals must stay inside slide bounds');assert.deepEqual(audit.overlaps,[],'planner visual text must not overlap');assert.deepEqual(audit.smallText,[],'non-footer planner visual text must be at least 12 pt');}
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('AI planner output with fabricated evidence IDs fails local validation',()=>{
  const draft=createPlannerDraft({...response,slides:response.slides.map((item,index)=>index===1?{...item,evidence_ids:['FABRICATED']}:item)},{audienceProfile:'research_group',duration:7,goal:'Agree on the next experiment'});
  assert.match(validateDeck(draft,ledger).errors.join(' '),/FABRICATED.*absent from ledger/);
  assert.equal(ledger.entries.find(item=>item.id==='E1').verified,false);
});

test('AI planner review record serializes the critic report and binds it to the brief hash',()=>{
  const report=createPlannerReviewRecord({inputPath:'brief.md',brief:'source brief',critique:{status:'review',issues:[{rule_id:'NARR-001'}]},numberAudit:{status:'literal-match-only',findings:[]}});
  assert.equal(report.review_status,'pending');
  assert.equal(report.critic.status,'review');
  assert.equal(report.quality_audit,null);
  assert.equal(report.critic.issues[0].rule_id,'NARR-001');
  assert.match(report.source_brief.sha256,/^[a-f0-9]{64}$/);
  assert.throws(()=>createPlannerReviewRecord({inputPath:'brief.md',brief:'x',critique:null,numberAudit:{}}),/critique and numberAudit/);
});
