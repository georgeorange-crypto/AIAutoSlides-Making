import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEvidence,validateDeck} from '../src/validate.mjs';
import {createPlannerContract,createPlannerDraft} from '../src/ai-plan-contract.mjs';

const ledger=loadEvidence('sources/evidence.json');
const slide=(type,title,evidence_ids=[])=>({type,title,kicker:'Synthetic draft',assertion_title:`Draft assertion: ${title}`,body:type==='bullets'?['A source-grounded point']:[],evidence_ids,layout:'assertion-evidence',visual_needs:[],speaker_notes:`Draft speaker notes for ${title}.`});
const response={title:'Draft research talk',subtitle:'Review required',narrative_structure:'problem-method-evidence-limitations-next-steps',structure_rationale:'Start with motivation, then evidence and limitations.',slides:[slide('cover','Motivation'),slide('statement','Question',['E1']),slide('bullets','Approach',['E1']),slide('statement','Evidence',['E1']),slide('statement','Limitations',['E2']),slide('closing','Next steps',['E2'])]};

test('AI planning contract asks for narrative, per-slide assertion, layout, visuals and speaker notes without a network call',()=>{
  const {schema,policy}=createPlannerContract({audienceProfile:'research_group',duration:7,goal:'Agree on the next experiment',evidenceIds:['E1','E2']});
  assert.deepEqual(schema.required,['title','subtitle','narrative_structure','structure_rationale','slides']);
  assert.deepEqual(schema.properties.slides.items.required,['type','title','kicker','assertion_title','body','evidence_ids','layout','visual_needs','speaker_notes']);
  assert.match(policy,/target duration 7 minutes/);assert.match(policy,/Agree on the next experiment/);assert.match(policy,/Never invent numbers/);assert.match(policy,/do not label any source verified/);
});

test('AI planner draft preserves rich storyboard fields and stays behind the existing human review gate',()=>{
  const draft=createPlannerDraft(response,{audienceProfile:'research_group',duration:7,goal:'Agree on the next experiment'});
  assert.equal(draft.meta.requires_human_review,true);assert.equal(draft.meta.narrative_structure,response.narrative_structure);
  assert.equal(draft.slides[2].speaker_notes,response.slides[2].speaker_notes);assert.equal(draft.slides[2].visual_needs.length,0);
  assert.deepEqual(validateDeck(draft,ledger).errors,[]);
});

test('AI planner output with fabricated evidence IDs fails local validation',()=>{
  const draft=createPlannerDraft({...response,slides:response.slides.map((item,index)=>index===1?{...item,evidence_ids:['FABRICATED']}:item)},{audienceProfile:'research_group',duration:7,goal:'Agree on the next experiment'});
  assert.match(validateDeck(draft,ledger).errors.join(' '),/FABRICATED.*absent from ledger/);
  assert.equal(ledger.entries.find(item=>item.id==='E1').verified,false);
});
