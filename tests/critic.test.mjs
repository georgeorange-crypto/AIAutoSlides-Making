import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {unzipSync,strFromU8} from 'fflate';
import {critiqueDeck,auditDraftNumbers} from '../src/critic.mjs';
import {loadEvidence} from '../src/validate.mjs';
import {approvalContentHash,buildGateError} from '../src/review-state.mjs';
import {createDesignProfile} from '../src/design-profile.mjs';

const ledger=loadEvidence('sources/evidence.json'),sample=JSON.parse(fs.readFileSync('examples/research-demo.json','utf8')),copy=x=>JSON.parse(JSON.stringify(x));

test('Slide Critic emits stable rules, severity, slide IDs, and element locations',()=>{
 const d=copy(sample);delete d.meta.audience_profile;delete d.meta.goal;delete d.meta.duration_minutes;d.slides[1].assertion_title=undefined;d.slides[3].chart.sample_size=undefined;d.slides[1].title='A'.repeat(80);
 const result=critiqueDeck(d,ledger),rules=new Set(result.issues.map(x=>x.rule_id));
 for(const rule of ['NARR-001','NARR-002','TIME-001','AE-001','SCI-001','SRC-001','READ-001'])assert.ok(rules.has(rule),rule);
 const actionable=result.issues.find(x=>x.rule_id==='READ-001');assert.equal(actionable.slide_id,'S02');assert.equal(actionable.element,'title');assert.ok(actionable.recommendation);assert.ok(actionable.reference.url);assert.equal(result.issues.find(x=>x.rule_id==='NARR-001').slide_id,'DECK');
});

test('numeric grounding audit identifies literal numeric tokens missing from the source brief',()=>{
 const deck={slides:[{slide_id:'S01',title:'Accuracy improved by 99%',body:['Latency fell to 5 ms']}]};
 const result=auditDraftNumbers(deck,'Accuracy was 92%; latency values were measured in milliseconds.');
 assert.deepEqual(result.findings.map(x=>x.number),['99%','5']);assert.equal(result.findings[0].rule_id,'GROUND-NUMERIC-001');assert.match(result.limitations[0],/cannot establish meaning/);
});

test('audience profiles produce specific research-method and investment-risk checks',()=>{
 const minimal={meta:{title:'Talk',audience_profile:'research_group',goal:'Discuss the project',duration_minutes:10},slides:[{slide_id:'S01',type:'cover',title:'Overview',body:[],evidence_ids:[]},{slide_id:'S02',type:'closing',title:'Summary',body:['Thank you'],evidence_ids:[]}]};
 const research=new Set(critiqueDeck(minimal,ledger).issues.map(x=>x.rule_id));assert.ok(research.has('NARR-110'));assert.ok(research.has('SCI-310'));assert.ok(research.has('NARR-120'));
 minimal.meta.audience_profile='investment_committee';minimal.slides[1].title='Approve or reject the proposal';const investment=new Set(critiqueDeck(minimal,ledger).issues.map(x=>x.rule_id));assert.ok(investment.has('INV-101'));assert.ok(!investment.has('INV-102'));
});

test('timing estimate only runs for explicitly identified full-script notes and a supplied venue window',()=>{
 const d=copy(sample);d.meta.speaker_notes_are_script=true;d.meta.speech_rate_words_per_minute=100;d.meta.duration_minutes=5;d.meta.timing_window_minutes=[4,5];d.slides.forEach(s=>{s.speaker_notes='';delete s.notes;});d.slides[0].speaker_notes='word '.repeat(300);
 const result=critiqueDeck(d,ledger);assert.equal(result.delivery_review.script_words,300);assert.equal(result.delivery_review.estimated_minutes,3);assert.ok(result.issues.some(i=>i.rule_id==='TIME-002'));
 delete d.meta.speaker_notes_are_script;assert.equal(critiqueDeck(d,ledger).delivery_review,null);
});

test('content-bound review gate blocks pending, approved, and edited-after-approval states correctly',()=>{
 const d=copy(sample);d.meta.requires_human_review=true;assert.match(buildGateError(d),/human approval/);
 d.meta.human_review={decision:'approve',reviewer:'Reviewer',note:'Checked claims',content_sha256:approvalContentHash(d)};assert.match(buildGateError(d),/inspect the critic findings/);
 d.meta.human_review.acknowledged_all_critic_findings=true;assert.equal(buildGateError(d),null);
 d.slides[1].title+=' edited';assert.match(buildGateError(d),/stale/);
});

test('explicit human review creates an approved editable copy that builds and becomes stale after edits',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-human-review-')),draft=copy(sample);draft.meta.requires_human_review=true;draft.meta.status='AI-GENERATED DRAFT — REVIEW REQUIRED';draft.slides[3].figure_description='Three bars compare reported P50 TTFT across raw miss, raw hit, and compressed hit cases.';
 const input=path.join(dir,'draft.json'),reviewed=path.join(dir,'reviewed.json'),pptx=path.join(dir,'reviewed.pptx');fs.writeFileSync(input,JSON.stringify(draft));
 try{
  const blocked=spawnSync(process.execPath,['src/cli.mjs','build','--input',input,'--evidence','sources/evidence.json','--out',pptx],{encoding:'utf8'});assert.equal(blocked.status,1);assert.match(blocked.stderr,/human approval/);assert.equal(fs.existsSync(pptx),false);
  const approval=spawnSync(process.execPath,['src/review-draft.mjs','--input',input,'--evidence','sources/evidence.json','--out',reviewed,'--decision','approve','--reviewer','Test Reviewer','--note','Checked source IDs and all values.','--ack-findings','all'],{encoding:'utf8'});assert.equal(approval.status,0,approval.stderr);
  const built=spawnSync(process.execPath,['src/cli.mjs','build','--input',reviewed,'--evidence','sources/evidence.json','--out',pptx],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);assert.ok(fs.statSync(pptx).size>10000);const files=unzipSync(new Uint8Array(fs.readFileSync(pptx))),notes=Object.keys(files).filter(x=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(x)).map(x=>strFromU8(files[x])).join('\n');assert.match(notes,/Figure description: Three bars compare reported P50 TTFT/);
  const approved=JSON.parse(fs.readFileSync(reviewed,'utf8'));approved.slides[1].title+=' changed';fs.writeFileSync(reviewed,JSON.stringify(approved));const stale=spawnSync(process.execPath,['src/cli.mjs','build','--input',reviewed,'--evidence','sources/evidence.json','--out',pptx],{encoding:'utf8'});assert.equal(stale.status,1);assert.match(stale.stderr,/stale/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('design profile requires an explicit recorded reviewer and captures selected theme tokens',()=>{
 const gallery={source_storyboard_sha256:'abc',themes:[{id:'tech-dark',preview:'tech-dark-page-1.png',chart_preview:'tech-dark-page-2.png',rendered:true,tokens:{accent:'64C9F8'}}]};
 assert.throws(()=>createDesignProfile(gallery,'tech-dark',''),/reviewer name/);
 const profile=createDesignProfile(gallery,'tech-dark','Reviewer','2026-11-12T12:00:00Z');assert.equal(profile.selected_theme,'tech-dark');assert.deepEqual(profile.tokens,{accent:'64C9F8'});assert.equal(profile.confirmed_by,'Reviewer');assert.equal(profile.preview.chart,'tech-dark-page-2.png');
});

test('design selection CLI writes reviewer-confirmed Markdown and token files',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-design-selection-')),gallery=path.join(dir,'gallery.json'),out=path.join(dir,'design.md');
 try{
  fs.writeFileSync(gallery,JSON.stringify({source_storyboard_sha256:'abc',themes:[{id:'keynote-minimal',preview:'cover.png',chart_preview:'chart.png',rendered:true,tokens:{background:'FFFFFF'}}]}));
  const result=spawnSync(process.execPath,['src/select-design.mjs','--gallery',gallery,'--theme','keynote-minimal','--reviewer','User confirmed in Codex','--confirm','yes','--out',out],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const profile=JSON.parse(fs.readFileSync(path.join(dir,'design-tokens.json'),'utf8'));assert.equal(profile.confirmed_by,'User confirmed in Codex');assert.equal(profile.selected_theme,'keynote-minimal');assert.match(fs.readFileSync(out,'utf8'),/Confirmed design tokens/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('AI planner help is local and does not require an API key',()=>{
 const r=spawnSync(process.execPath,['src/ai-plan.mjs','--help'],{encoding:'utf8',env:{...process.env,OPENAI_API_KEY:''}});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/requires explicit human approval/i);
});
