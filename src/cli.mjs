#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadEvidence,validateDeck} from './validate.mjs';
import {generatePresentation} from './render.mjs';
import {patchPptxErrorBars} from './chart-error-bars.mjs';
import {buildGateError} from './review-state.mjs';
import {loadAssetManifest,assetManifestReport} from './assets.mjs';

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
  const assetFile=arg('assets',null),assets=loadAssetManifest(assetFile,deck);
  const used=new Set(deck?.slides?.flatMap(s=>s.evidence_ids||[])||[]);
  for(const e of evidence.entries) if(used.has(e.id) && !e.verified) warnings.push(`Evidence ${e.id} is not independently verified (${e.locator||'no locator'})`);
  const report={ok:errors.length===0,errors,warnings,source:path.relative(process.cwd(),input),evidence:path.relative(process.cwd(),evidenceFile),slides:deck?.slides?.length??0};
  for (const e of errors) console.error(`[ERROR] ${e}`);
  for (const w of warnings) console.warn(`[WARN] ${w}`);
  if(errors.length){console.error('Validation failed; no PPTX generated.');process.exit(1);}
  if(verb==='validate'){console.log(`Validation passed: ${report.slides} slides, ${warnings.length} warnings`);process.exit(0);}
  const gate=buildGateError(raw);if(gate)throw new Error(gate);
  const themeName=arg('theme',deck.meta.theme||'academic-light');
  if(!/^[a-z-]+$/.test(themeName)) throw new Error('Invalid theme name');
  const themeFile=path.join(root,'themes',`${themeName}.json`);
  const theme=JSON.parse(fs.readFileSync(themeFile,'utf8'));
  const output=abs(arg('out','outputs/presentation.pptx'));
  await generatePresentation(deck,evidence,theme,output,assets);
  const errorBarSeries=patchPptxErrorBars(output,deck);
  report.theme=themeName;
  report.output=path.relative(process.cwd(),output);
  fs.writeFileSync(output.replace(/\.pptx$/i,'')+'.review.json',JSON.stringify(report,null,2)+'\n');
  const lineageSlides=deck.slides.map((s,i)=>({slide_id:s.slide_id||`S${String(i+1).padStart(2,'0')}`,slide_number:i+1,assertion:s.assertion_title||s.title,evidence_ids:s.evidence_ids||[],sources:(s.evidence_ids||[]).map(id=>{const e=evidence.entries.find(v=>v.id===id),hash=(e.locator||'').match(/SHA-256\s+([a-f0-9]{64})/i)?.[1]||null;return{id,label:e.label,source:e.source,source_sha256:hash,locator:e.locator||null,verification_status:e.verified?'verified':'unverified'};})}));
  const lineage={schema_version:1,generated_at:new Date().toISOString(),storyboard:{path:path.relative(process.cwd(),input),sha256:crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex')},evidence_ledger:{path:path.relative(process.cwd(),evidenceFile),sha256:crypto.createHash('sha256').update(fs.readFileSync(evidenceFile)).digest('hex')},assets:assetManifestReport(assets),slides:lineageSlides,figures:deck.slides.flatMap((s,i)=>s.type==='chart'?[{figure_id:s.figure_id||`F${String(i+1).padStart(2,'0')}`,slide_id:lineageSlides[i].slide_id,assertion:s.assertion_title||s.title,kind:s.chart.kind,unit:s.chart.unit,categories:s.chart.categories||null,x_values:s.chart.x_values||null,raw_values:s.chart.raw_values||null,series:s.chart.series||[{name:s.chart.series_name||'Series',values:s.chart.values}],uncertainty:s.chart.uncertainty||null,transform:s.chart.uncertainty?'per-condition mean and Student-t interval from independent run_values; run IDs, observation IDs, and source row numbers retained':s.chart.kind==='cdf'?'empirical CDF right-continuous staircase; ties grouped; probability = cumulative count / raw n':s.chart.kind==='scatter'?'row-wise x/y observations copied from source values':(s.chart.series?.length>1?'one-to-one source values grouped by series and category':'identity mapping from storyboard values to editable PptxGenJS chart'),source_ids:s.evidence_ids,source_locators:lineageSlides[i].sources.map(x=>x.locator),source_sha256:lineageSlides[i].sources.map(x=>x.source_sha256).filter(Boolean)}]:[]),diagrams:deck.slides.flatMap(s=>s.type==='architecture'?[{slide_id:s.slide_id,kind:'architecture',editability:'native PowerPoint shapes, text, and connectors',groups:s.diagram.groups,nodes:s.diagram.nodes,edges:s.diagram.edges}]:[]),tables:deck.slides.flatMap((s,i)=>s.type==='table'?[{slide_id:lineageSlides[i].slide_id,kind:'data_table',editability:'native editable PowerPoint table cells',headers:s.table.headers,rows:s.table.rows,caption:s.table.caption||null,source_ids:s.evidence_ids,source_locators:lineageSlides[i].sources.map(x=>x.locator),source_sha256:lineageSlides[i].sources.map(x=>x.source_sha256).filter(Boolean)}]:[])};
  fs.writeFileSync(output.replace(/\.pptx$/i,'')+'.evidence-manifest.json',JSON.stringify(lineage,null,2)+'\n');
  console.log(`Created ${output} (${report.slides} slides) and review report${errorBarSeries?`; ${errorBarSeries} series with editable native error bars`:''}`);
}catch(err){console.error(`[FATAL] ${err.message}`);process.exit(1);}
