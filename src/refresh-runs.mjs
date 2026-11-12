#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {buildRunManifest,diffRunManifests} from './run-audit.mjs';

const [inputArg,outputArg,baselineArg,manualRepairArg]=process.argv.slice(2);
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function command(args){const result=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true});if(result.status!==0)throw new Error(`${args.join(' ')} failed (${result.status}): ${result.stderr||result.stdout}`);return result.stdout.trim();}
function help(){console.log('Usage: node src/refresh-runs.mjs <run-summary.csv> <deck.pptx> [baseline-refresh.json] [manual-repair-minutes]\nReads only local files. Stores the source-derived storyboard, evidence ledger, QA, timing, hashes, and row diff beside the deck. Enter measured human repair minutes when available.');}
if(!inputArg||inputArg==='--help'||inputArg==='-h'){help();if(inputArg)process.exit(0);process.exit(1);}
const started=process.hrtime.bigint();
try{
  const input=path.resolve(inputArg),output=path.resolve(outputArg||'outputs/experiment-runs.pptx');
  const manualRepairMinutes=manualRepairArg===undefined?null:Number(manualRepairArg);
  if(manualRepairMinutes!==null&&(!Number.isFinite(manualRepairMinutes)||manualRepairMinutes<0))throw new Error('manual-repair-minutes must be a nonnegative number');
  if(!fs.existsSync(input))throw new Error(`Input CSV not found: ${input}`);
  const outputDir=path.dirname(output),stem=path.basename(output,'.pptx'),base=path.join(outputDir,stem),storyboard=`${base}.storyboard.json`,evidence=`${base}.storyboard-evidence.json`,reportPath=`${output}.refresh.json`,reportMd=`${output}.refresh.md`;
  fs.mkdirSync(outputDir,{recursive:true});const csv=fs.readFileSync(input,'utf8'),sourcePath=path.relative(process.cwd(),input).replaceAll('\\','/'),sourceManifest=buildRunManifest(csv,sourcePath);
  const baseline=baselineArg?JSON.parse(fs.readFileSync(path.resolve(baselineArg),'utf8')):null;
  if(baseline&&(!baseline.source_manifest||!baseline.production_ms||!baseline.build?.pptx_sha256))throw new Error('Baseline refresh report is missing source_manifest, production_ms, or build.pptx_sha256');
  const diff=baseline?diffRunManifests(baseline.source_manifest,sourceManifest):null;
  const changed=Boolean(diff?.source_changed),pptxExists=fs.existsSync(output),mustBuild=!baseline||changed||!pptxExists;
  command(['src/import-repeated.mjs',input,storyboard]);
  command(['src/cli.mjs','validate','--input',storyboard,'--evidence',evidence]);
  if(mustBuild){command(['src/cli.mjs','build','--input',storyboard,'--evidence',evidence,'--out',output]);command(['src/qa.mjs',output]);}
  const productionMs=Number(process.hrtime.bigint()-started)/1e6;
  const firstRunMs=baseline?(baseline.first_run_ms??baseline.production_ms):productionMs;
  const status=!baseline?'first-run':changed?'updated':mustBuild?'rebuilt-missing-output':'unchanged';
  const report={schema_version:1,status,generated_at:new Date().toISOString(),input:{path:sourcePath,sha256:sourceManifest.source.sha256,row_count:sourceManifest.observations.length,run_count:sourceManifest.runs.length},source_manifest:sourceManifest,diff,build:{performed:mustBuild,pptx:path.relative(process.cwd(),output).replaceAll('\\','/'),pptx_sha256:sha(output),qa_path:path.relative(process.cwd(),`${base}.qa.json`).replaceAll('\\','/')},production_ms:productionMs,first_run_ms:firstRunMs,second_run_ms:baseline?productionMs:null,manual_repair_minutes:manualRepairMinutes,manual_repair_status:manualRepairMinutes===null?'not supplied by operator':'operator-supplied measurement; not independently timed',runtime:{node:process.version,platform:process.platform,arch:process.arch,hostname:os.hostname()},limitations:['Timing includes local CSV import, storyboard validation, PPTX build, and structural QA when a build occurs; it excludes rendering and human review.','Run-level t intervals assume independent, approximately normal values; inspect input provenance and design.','No source authenticity, scientific validity, or protocol comparability is established automatically.']};
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  const counts=diff?`added ${diff.added.length}, changed ${diff.changed.length}, removed ${diff.removed.length}`:'no baseline';
  fs.writeFileSync(reportMd,[`# Run refresh report: ${stem}`,'',`- Status: **${status}**`,`- Input SHA-256: \`${report.input.sha256}\``,`- Runs / observations: ${report.input.run_count} / ${report.input.row_count}`,`- Row diff: ${counts}`,`- Build performed: ${mustBuild?'yes':'no'}`,`- Production pipeline time: ${productionMs.toFixed(2)} ms`,`- First-run time: ${firstRunMs.toFixed(2)} ms`,`- Second-run time: ${report.second_run_ms===null?'not measured':`${report.second_run_ms.toFixed(2)} ms`}`,`- Manual repair time: ${manualRepairMinutes===null?'not supplied':`${manualRepairMinutes} minutes (operator supplied)`}`,`- PPTX SHA-256: \`${report.build.pptx_sha256}\``,'','## Interpretation','',...report.limitations.map(x=>`- ${x}`),''].join('\n'));
  console.log(`Refresh ${status}: ${counts}; ${productionMs.toFixed(2)} ms; ${output}`);
}catch(error){console.error(`[FATAL] ${error.message}`);process.exit(1);}
