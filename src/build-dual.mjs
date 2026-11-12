#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createTalkReadingDecks} from './deck-profiles.mjs';
import {loadEvidence,validateDeck} from './validate.mjs';

const [inputArg,evidenceArg='sources/evidence.json',prefixArg='outputs/research-demo']=process.argv.slice(2);
const root=process.cwd();
function digest(value){return crypto.createHash('sha256').update(value).digest('hex');}
function run(args){const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error(`${args.join(' ')} failed (${r.status}): ${r.stderr||r.stdout}`);return r.stdout;}
if(!inputArg||inputArg==='--help'||inputArg==='-h'){
  console.log('Usage: node src/build-dual.mjs <storyboard.json> [evidence.json] [output-prefix]\nBuilds talk and reading decks from one validated storyboard/evidence graph. Reading appends cited-source and figure-data pages.');
  if(inputArg)process.exit(0);process.exit(1);
}
try{
  const input=path.resolve(inputArg),ledgerPath=path.resolve(evidenceArg),prefix=path.resolve(prefixArg),raw=JSON.parse(fs.readFileSync(input,'utf8')),evidence=loadEvidence(ledgerPath),sourceGraphSha256=digest(`${digest(fs.readFileSync(input))}:${digest(fs.readFileSync(ledgerPath))}`);
  const base=validateDeck(raw,evidence);if(base.errors.length)throw new Error(`Storyboard failed validation: ${base.errors.join('; ')}`);
  const {talk,reading,appendixSlides,sourceIds}=createTalkReadingDecks(base.deck,evidence),variants={talk,reading},reports=[];
  for(const mode of ['talk','reading']){
    const variant=variants[mode],checked=validateDeck(variant,evidence);if(checked.errors.length)throw new Error(`${mode} profile failed validation: ${checked.errors.join('; ')}`);
    const storyboardPath=`${prefix}-${mode}.storyboard.json`,ledgerOut=`${prefix}-${mode}.evidence.json`,pptx=`${prefix}-${mode}.pptx`;
    fs.mkdirSync(path.dirname(pptx),{recursive:true});fs.writeFileSync(storyboardPath,JSON.stringify(variant,null,2)+'\n');fs.writeFileSync(ledgerOut,JSON.stringify(evidence,null,2)+'\n');
    run(['src/cli.mjs','build','--input',storyboardPath,'--evidence',ledgerOut,'--out',pptx]);
    run(['src/qa.mjs',pptx]);
    const qa=JSON.parse(fs.readFileSync(pptx.replace(/\.pptx$/i,'.qa.json'),'utf8'));
    if(qa.errors.length)throw new Error(`${mode} profile QA failed: ${qa.errors.join('; ')}`);
    reports.push({mode,storyboard:path.relative(root,storyboardPath).replaceAll('\\','/'),pptx:path.relative(root,pptx).replaceAll('\\','/'),pptx_sha256:digest(fs.readFileSync(pptx)),slides:variant.slides.length,qa_status:qa.status,native_chart_count:qa.nativeChartCount,native_error_bar_series_count:qa.nativeErrorBarSeriesCount||0,source_graph_sha256:sourceGraphSha256});
  }
  const report={schema_version:1,generated_at:new Date().toISOString(),source:{storyboard:path.relative(root,input).replaceAll('\\','/'),storyboard_sha256:digest(fs.readFileSync(input)),evidence:path.relative(root,ledgerPath).replaceAll('\\','/'),evidence_sha256:digest(fs.readFileSync(ledgerPath)),source_graph_sha256:sourceGraphSha256},shared_evidence_ids:sourceIds,profile_design:'Both variants start from the same validated storyboard and evidence ledger. Talk preserves the authored slide sequence; Reading appends source records, figure methods, and deterministic data pages. No claims or values are generated.',reading_appendix_slide_count:appendixSlides,variants:reports,limitations:['Source graph hashes establish input identity, not source authenticity or scientific verification.','Review any reading deck page whose QA report has warnings; unverified sources remain visible.']};
  const reportPath=`${prefix}-dual-report.json`;fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(`${prefix}-dual-report.md`,[`# Talk / Reading build report`,'',`- Shared source graph SHA-256: \`${sourceGraphSha256}\``,`- Evidence IDs: ${sourceIds.join(', ')}`,`- Reading appendix pages: ${appendixSlides}`,'',...reports.map(r=>`- **${r.mode}**: ${r.slides} slides · ${r.native_chart_count} native charts · QA ${r.qa_status} · \`${r.pptx}\``),'','## Limitations','',...report.limitations.map(x=>`- ${x}`),''].join('\n'));
  console.log(`Built shared-evidence profiles: ${reports.map(r=>`${r.mode} ${r.slides} slides (${r.qa_status})`).join('; ')}`);
}catch(error){console.error(`[FATAL] ${error.message}`);process.exit(1);}
