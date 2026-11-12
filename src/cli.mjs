#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEvidence,validateDeck} from './validate.mjs';
import {generatePresentation} from './render.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const argv=process.argv.slice(2);
const verb=argv[0]||'help';
function arg(name,fallback) { const i=argv.indexOf(`--${name}`); return i>=0?argv[i+1]:fallback; }
function abs(v) { return path.resolve(process.cwd(),v); }
function help(){console.log(`AIAutoSlides: editable evidence-first presentation generator
Usage:
  node src/cli.mjs validate --input examples/research-demo.json [--evidence sources/evidence.json]
  node src/cli.mjs build --input examples/research-demo.json --out outputs/demo.pptx [--theme tech-dark]
  npm run plan:ai -- --input sources/brief.md --out content/ai-storyboard.json
Themes: academic-light | tech-dark | keynote-minimal`);}
if(!['validate','build'].includes(verb)){help();process.exit(verb==='help'?0:1);}
try{
  const input=abs(arg('input','examples/research-demo.json'));
  const evidenceFile=abs(arg('evidence','sources/evidence.json'));
  const raw=JSON.parse(fs.readFileSync(input,'utf8'));
  const evidence=loadEvidence(evidenceFile);
  const {deck,errors,warnings}=validateDeck(raw,evidence);
  const used=new Set(deck?.slides?.flatMap(s=>s.evidence_ids||[])||[]);
  for(const e of evidence.entries) if(used.has(e.id) && !e.verified) warnings.push(`Evidence ${e.id} is not independently verified (${e.locator||'no locator'})`);
  const report={ok:errors.length===0,errors,warnings,source:path.relative(process.cwd(),input),evidence:path.relative(process.cwd(),evidenceFile),slides:deck?.slides?.length??0};
  for (const e of errors) console.error(`[ERROR] ${e}`);
  for (const w of warnings) console.warn(`[WARN] ${w}`);
  if(errors.length){console.error('Validation failed; no PPTX generated.');process.exit(1);}
  if(verb==='validate'){console.log(`Validation passed: ${report.slides} slides, ${warnings.length} warnings`);process.exit(0);}
  const themeName=arg('theme',deck.meta.theme||'academic-light');
  if(!/^[a-z-]+$/.test(themeName)) throw new Error('Invalid theme name');
  const themeFile=path.join(root,'themes',`${themeName}.json`);
  const theme=JSON.parse(fs.readFileSync(themeFile,'utf8'));
  const output=abs(arg('out','outputs/presentation.pptx'));
  await generatePresentation(deck,evidence,theme,output);
  report.theme=themeName;
  report.output=path.relative(process.cwd(),output);
  fs.writeFileSync(output.replace(/\.pptx$/i,'')+'.review.json',JSON.stringify(report,null,2)+'\n');
  console.log(`Created ${output} (${report.slides} slides) and review report`);
}catch(err){console.error(`[FATAL] ${err.message}`);process.exit(1);}
