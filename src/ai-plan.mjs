#!/usr/bin/env node
// Optional AI planning only. Numeric charts are created separately from verified input.
import fs from 'node:fs';
import path from 'node:path';
import {loadEvidence,validateDeck} from './validate.mjs';

const argv=process.argv.slice(2);
function arg(name,fallback){const i=argv.indexOf(`--${name}`);return i>=0?argv[i+1]:fallback;}
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
const ledger=loadEvidence(path.resolve(arg('evidence','sources/evidence.json')));
const brief=fs.readFileSync(input,'utf8');
if(brief.length>45000) throw new Error('Source text is >45k characters; curate it manually, do not silently truncate');
const slidesSchema={
  type:'object',additionalProperties:false,required:['title','subtitle','slides'],properties:{
    title:{type:'string'},subtitle:{type:'string'},slides:{type:'array',items:{type:'object',additionalProperties:false,
      required:['type','title','kicker','body','evidence_ids'],properties:{
        type:{type:'string',enum:['cover','statement','bullets','closing']},title:{type:'string'},
        kicker:{type:'string'},body:{type:'array',items:{type:'string'}},evidence_ids:{type:'array',items:{type:'string'}}
      }
    }}
  }
};
const policy=`Create exactly 6 to 9 slides as JSON for an evidence-first research talk. Use ONLY claims stated in the brief. NEVER invent numeric results, statistical significance, citations, company endorsement, or a benchmark. The only permitted evidence IDs are ${ledger.entries.map(x=>x.id).join(', ')}. Cover with a punchy narrative, explain key observations, uncertainty, implications, and decisions. Each slide title is a conclusion, not a topic. At most 3 short body entries per slide. When evidence IDs lack support, use none and clearly mark as hypothesis. Avoid unsupported inference. Use native title/statement/bullets/closing types. Charts and metrics must be curated manually from verified files. Return JSON.`;
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
 const planned=JSON.parse(text);
 const {deck,errors,warnings}=validateDeck(planned,ledger);
 if(errors.length)throw new Error(`Model output failed validation: ${errors.join('; ')}`);
 if(deck.slides.length<6||deck.slides.length>9)throw new Error('AI must create 6–9 slides; regenerate or edit manually');
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(planned,null,2)+'\n');
 console.log(`Wrote ${output} (${deck.slides.length} slides) / warnings: ${warnings.length}. Human evidence review required.`);
}
main().catch(err=>{console.error(`[ERROR] ${err.message}`);process.exit(1);});
