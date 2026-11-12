#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {loadEvidence,validateDeck} from './validate.mjs';
import {critiqueDeck} from './critic.mjs';
import {approvalContentHash} from './review-state.mjs';

const argv=process.argv.slice(2),arg=name=>{const i=argv.indexOf(`--${name}`);return i<0?null:argv[i+1];};
const input=arg('input'),evidencePath=arg('evidence')||'sources/evidence.json',output=arg('out'),reviewer=arg('reviewer'),note=arg('note'),decision=arg('decision'),ack=arg('ack-findings');
if(!input||!output||!reviewer||!note||!['approve','reject'].includes(decision)||(decision==='approve'&&ack!=='all')){console.log('Usage: node src/review-draft.mjs --input draft.json --out reviewed.json --decision approve|reject --reviewer "Name" --note "Review record" [--ack-findings all] [--evidence evidence.json]');process.exit(process.argv.includes('--help')?0:2);}
try{
  const deck=JSON.parse(fs.readFileSync(path.resolve(input),'utf8')),ledger=loadEvidence(path.resolve(evidencePath)),checked=validateDeck(deck,ledger),critique=critiqueDeck(deck,ledger);
  if(decision==='approve'&&checked.errors.length)throw new Error(`Cannot approve: schema errors remain: ${checked.errors.join('; ')}`);
  if(deck.meta?.requires_human_review!==true)throw new Error('Input is not marked as requiring human review');
  const reviewed=JSON.parse(JSON.stringify(deck));reviewed.meta.human_review={decision,reviewer,note,reviewed_at:new Date().toISOString(),content_sha256:approvalContentHash(deck),critic_rule_ids_presented:[...new Set(critique.issues.map(x=>x.rule_id))],acknowledged_all_critic_findings:decision==='approve'&&ack==='all'};
  fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(path.resolve(output),JSON.stringify(reviewed,null,2)+'\n');
  console.log(`Saved ${decision} review for ${reviewed.meta.title} -> ${path.resolve(output)} (${critique.issues.length} critic findings recorded)`);
}catch(error){console.error(`[ERROR] ${error.message}`);process.exit(1);}
