#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {loadEvidence} from './validate.mjs';
import {critiqueDeck} from './critic.mjs';

const argv=process.argv.slice(2),arg=(name,fallback)=>{const i=argv.indexOf(`--${name}`);return i<0?fallback:argv[i+1];};
const input=arg('input',null),evidencePath=arg('evidence','sources/evidence.json'),out=arg('out',input?input.replace(/\.json$/i,'-critique'):'');
if(!input||!out){console.log('Usage: node src/critique.mjs --input storyboard.json [--evidence sources/evidence.json] [--out critique-report-path-without-extension]');process.exit(process.argv.includes('--help')?0:2);}
try{
  const deck=JSON.parse(fs.readFileSync(path.resolve(input),'utf8')),ledger=loadEvidence(path.resolve(evidencePath)),report=critiqueDeck(deck,ledger),base=path.resolve(out);
  fs.mkdirSync(path.dirname(base),{recursive:true});fs.writeFileSync(`${base}.json`,JSON.stringify(report,null,2)+'\n');
  const md=[`# Slide Critic: ${deck.meta?.title||deck.title||path.basename(input)}`,'',`- Status: **${report.status}**`,`- Slides: ${report.slide_count??'unavailable'}`,`- Audience: ${report.audience_profile||'not specified'}`,`- Target duration: ${report.duration_minutes?`${report.duration_minutes} minutes`:'not specified'}`,`- Findings: ${report.issues.length}`,'','| Rule | Severity | Slide | Element | Recommendation |','|---|---|---|---|---|',...report.issues.map(i=>`| ${i.rule_id} | ${i.severity} | ${i.slide_id||'Deck'} | ${i.element} | ${i.recommendation.replaceAll('|','/')} |`),'','## Rule sources','',...[...new Map(report.issues.map(i=>[i.reference.url,i.reference])).values()].map(r=>`- [${r.name}](${r.url})`),'','## Limits','', '- This is a deterministic review aid. It does not establish scientific validity or replace author, accessibility, conference, or visual review.',''].join('\n');
  fs.writeFileSync(`${base}.md`,md);console.log(`Critique ${report.status}: ${report.issues.length} findings -> ${base}.json/.md`);
}catch(error){console.error(`[ERROR] ${error.message}`);process.exit(1);}
