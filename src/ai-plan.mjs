#!/usr/bin/env node
// Optional AI planning only. Numeric charts are created separately from verified input.
import fs from 'node:fs';
import path from 'node:path';
import {loadEvidence,validateDeck} from './validate.mjs';
import {auditDraftNumbers,critiqueDeck} from './critic.mjs';
import {createPlannerContract,createPlannerDraft,createPlannerReviewRecord} from './ai-plan-contract.mjs';

const argv=process.argv.slice(2);
function arg(name,fallback){const i=argv.indexOf(`--${name}`);return i>=0?argv[i+1]:fallback;}
if(argv.includes('--help')||argv.includes('-h')){console.log('Usage: npm run plan:ai -- --input brief.md --out outputs/ai-draft.json [--evidence sources/evidence.json] [--audience research_group|academic_conference|investment_committee] [--duration 7] [--goal "Audience action"]\nThis optional command sends the brief and evidence ledger to the configured OpenAI Responses API. It writes an editable draft and requires explicit human approval before PPTX build.');process.exit(0);}
function loadEnv(){
  const p=path.resolve('.env');if(!fs.existsSync(p))return;
  for(const line of fs.readFileSync(p,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Z_]+)=(.*)\s*$/);if(m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
loadEnv();
const key=process.env.OPENAI_API_KEY;
if(!key){console.error('Missing OPENAI_API_KEY. Copy .env.example to .env, configure the key, or use the manual demo.');process.exit(2);}
const input=path.resolve(arg('input','sources/brief.md'));
const output=path.resolve(arg('out','content/ai-storyboard.json'));
const audienceProfile=arg('audience','research_group'),duration=Number(arg('duration','7')),goal=arg('goal','Explain the evidence and agree on the next research step');
if(!['research_group','academic_conference','investment_committee'].includes(audienceProfile))throw new Error('Unsupported --audience; use research_group, academic_conference, or investment_committee');
if(!Number.isFinite(duration)||duration<1||duration>120)throw new Error('--duration must be between 1 and 120 minutes');
const ledger=loadEvidence(path.resolve(arg('evidence','sources/evidence.json')));
const brief=fs.readFileSync(input,'utf8');
if(brief.length>45000) throw new Error('Source text is >45k characters; curate it manually, do not silently truncate');
const {schema:slidesSchema,policy}=createPlannerContract({audienceProfile,duration,goal,evidenceIds:ledger.entries.map(x=>x.id)});
const payload={model:process.env.OPENAI_MODEL||'gpt-6-luna',
  input:[{role:'developer',content:policy},{role:'user',content:`SOURCE BRIEF:\n${brief}\n\nEVIDENCE LEDGER:\n${JSON.stringify(ledger.entries)}`}],
  text:{format:{type:'json_schema',name:'slide_storyboard',schema:slidesSchema,strict:true}}
};
const endpoint='https://api.openai.com/v1/responses'; // Fixed endpoint; do not send user keys to arbitrary hosts.
async function main(){
 const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(120000)});
 const json=await r.json();
 if(!r.ok)throw new Error(`API request failed (${r.status}): ${JSON.stringify(json.error||json).slice(0,700)}`);
 const text=json.output_text||json.output?.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
 if(!text)throw new Error('Response did not contain output_text; inspect API response manually');
 const response=JSON.parse(text);
const planned=createPlannerDraft(response,{audienceProfile,duration,goal,theme:arg('theme','keynote-minimal')});
 const {deck,errors,warnings}=validateDeck(planned,ledger);
 if(errors.length)throw new Error(`Model output failed validation: ${errors.join('; ')}`);
 if(deck.slides.length<6||deck.slides.length>9)throw new Error('AI must create 6–9 slides; regenerate or edit manually');
 const numberAudit=auditDraftNumbers(deck,brief),critique=critiqueDeck(deck,ledger);
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(deck,null,2)+'\n');
 fs.writeFileSync(`${output}.review.json`,JSON.stringify(createPlannerReviewRecord({inputPath:input,brief,schemaErrors:errors,validationWarnings:warnings,critique,numberAudit}),null,2)+'\n');
 fs.writeFileSync(`${output}.review.md`,[`# Human review required: ${deck.meta.title}`,'',`- Status: **pending**`,`- Audience profile: ${audienceProfile}`,`- Target duration: ${duration} minutes`,`- Source brief: \`${input}\``,`- Schema errors: ${errors.length}`,`- Critic findings: ${critique.issues.length}`,`- Possible unsupported numeric tokens: ${numberAudit.findings.length}`,'','## Required review','', '- Compare each claim and evidence ID with the source.','- Confirm every numeric value against original records and check its unit/context.','- Review limitations, audience, pacing and rendered slide layout.','- Edit this JSON freely, then approve a content-hash-bound copy with `src/review-draft.mjs`.' ,'','## Limits','',...numberAudit.limitations.map(x=>`- ${x}`),''].join('\n'));
 console.log(`Wrote editable draft ${output} (${deck.slides.length} slides); review pending, ${warnings.length} validation warning(s), ${numberAudit.findings.length} possible unsupported numeric token(s).`);
}
main().catch(err=>{console.error(`[ERROR] ${err.message}`);process.exit(1);});
