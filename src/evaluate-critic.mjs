#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {loadEvidence} from './validate.mjs';
import {evaluateClaimCritic,evaluationMarkdown} from './critic-evaluation.mjs';

const args=process.argv.slice(2),get=(key,fallback)=>{const i=args.indexOf(`--${key}`);return i<0?fallback:args[i+1];};
if(args.includes('--help')){console.log('Usage: node src/evaluate-critic.mjs [--cases tests/fixtures/critic-claim-eval.json] [--evidence sources/evidence.json] [--out docs/CRITIC_EVALUATION.md]');process.exit(0);}
try{
 const casesPath=path.resolve(get('cases','tests/fixtures/critic-claim-eval.json')),evidence=loadEvidence(path.resolve(get('evidence','sources/evidence.json'))),annotation=JSON.parse(fs.readFileSync(casesPath,'utf8'));
 const evalEvidence={entries:[...evidence.entries,{id:'EVAL1',label:'Evaluation fixture',source:'Synthetic evaluation fixture',verified:true}]},result=evaluateClaimCritic(annotation,evalEvidence),out=path.resolve(get('out','docs/CRITIC_EVALUATION.md'));
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,evaluationMarkdown(result));fs.writeFileSync(out.replace(/\.md$/i,'.json'),JSON.stringify(result,null,2)+'\n');
 console.log(`Evaluated ${result.case_count} hand-labeled claim review cases -> ${out}`);for(const [rule,m] of Object.entries(result.rules))console.log(`${rule}: precision=${m.precision} recall=${m.recall} F1=${m.f1} (TP=${m.tp}, FP=${m.fp}, FN=${m.fn}, TN=${m.tn})`);
}catch(error){console.error(`[ERROR] ${error.message}`);process.exit(1);}
