import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';

const REQUIRED=['run_id','run_timestamp','observation_id'];
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');

export function parseRunCsv(text){
  const headerLine=text.replace(/^\uFEFF/,'').split(/\r?\n/).findIndex(line=>line.trim()&&!line.startsWith('#'))+1;
  text=text.replace(/^\uFEFF/,'').replace(/^#.*(?:\r?\n|$)/gm,'');
  const records=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));records.push(row);row=[];cell='';}else cell+=c;
  }
  if(quoted)throw new Error('CSV contains an unterminated quoted field');
  if(cell.length||row.length){row.push(cell.replace(/\r$/,''));records.push(row);}
  const [headers,...data]=records;
  if(!headers?.length||new Set(headers).size!==headers.length||headers.some(h=>!h.trim()))throw new Error('CSV requires unique, non-empty column names');
  if(REQUIRED.some(h=>!headers.includes(h)))throw new Error(`Run CSV requires columns: ${REQUIRED.join(', ')}`);
  if(data.some(r=>r.length!==headers.length))throw new Error('CSV rows must match the header column count');
  const rows=data.filter(r=>r.some(v=>v!=='')).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]])));
  if(!rows.length)throw new Error('Run CSV must contain at least one observation');
  return {headers,rows,headerLine};
}

export function buildRunManifest(csv,sourcePath='input.csv'){
  const {headers,rows,headerLine}=parseRunCsv(csv), seen=new Set(), timestamps=new Set();
  const observations=rows.map((row,index)=>{
    const {run_id,run_timestamp,observation_id}=row;
    if(!run_id.trim()||!observation_id.trim())throw new Error(`Row ${index+2} has an empty run_id or observation_id`);
    if(!Number.isFinite(Date.parse(run_timestamp))||!/^\d{4}-\d\d-\d\dT/.test(run_timestamp))throw new Error(`Row ${index+2} run_timestamp must be an ISO date-time`);
    timestamps.add(`${run_id}\0${run_timestamp}`);
    const key=`${run_id}\0${observation_id}`;
    if(seen.has(key))throw new Error(`Duplicate observation_id ${observation_id} in run ${run_id}`);
    seen.add(key);
    const values=Object.fromEntries(headers.filter(h=>!REQUIRED.includes(h)).map(h=>[h,row[h]]));
    return {run_id,run_timestamp,observation_id,source_row:index+headerLine+1,values,row_sha256:sha256(JSON.stringify([run_id,run_timestamp,observation_id,values]))};
  });
  const runTimestamps=new Map();
  for(const value of timestamps){const [run,timestamp]=value.split('\0');if(runTimestamps.has(run)&&runTimestamps.get(run)!==timestamp)throw new Error(`Run ${run} contains inconsistent run_timestamp values`);runTimestamps.set(run,timestamp);}
  const runs=[...new Set(observations.map(o=>o.run_id))].sort().map(run_id=>({run_id,run_timestamp:runTimestamps.get(run_id),observation_count:observations.filter(o=>o.run_id===run_id).length}));
  return {schema_version:1,created_at:new Date().toISOString(),source:{path:sourcePath,sha256:sha256(csv)},columns:headers,runs,observations};
}

export function diffRunManifests(previous,current){
  const key=o=>`${o.run_id}\0${o.observation_id}`,before=new Map(previous.observations.map(o=>[key(o),o])),after=new Map(current.observations.map(o=>[key(o),o]));
  const added=[],removed=[],changed=[];
  for(const [id,o] of after){const old=before.get(id);if(!old)added.push({run_id:o.run_id,observation_id:o.observation_id,source_row:o.source_row});else if(old.row_sha256!==o.row_sha256)changed.push({run_id:o.run_id,observation_id:o.observation_id,previous_row:old.source_row,current_row:o.source_row,previous_sha256:old.row_sha256,current_sha256:o.row_sha256});}
  for(const [id,o] of before)if(!after.has(id))removed.push({run_id:o.run_id,observation_id:o.observation_id,previous_row:o.source_row});
  const sort=(a,b)=>`${a.run_id}\0${a.observation_id}`.localeCompare(`${b.run_id}\0${b.observation_id}`);
  return {previous_source_sha256:previous.source.sha256,current_source_sha256:current.source.sha256,source_changed:previous.source.sha256!==current.source.sha256,added:added.sort(sort),changed:changed.sort(sort),removed:removed.sort(sort)};
}

function markdown(manifest,diff){
  const lines=['# Local experiment CSV audit','',`- Source: \`${manifest.source.path}\``,`- SHA-256: \`${manifest.source.sha256}\``,`- Generated: ${manifest.created_at}`,`- Runs: ${manifest.runs.length}`,`- Observations: ${manifest.observations.length}`,''];
  if(diff){lines.push('## Change from baseline','',`- Source bytes changed: **${diff.source_changed?'yes':'no'}**`,`- Added observations: **${diff.added.length}**`,`- Changed observations: **${diff.changed.length}**`,`- Removed observations: **${diff.removed.length}**`,'');for(const [name,items] of [['Added',diff.added],['Changed',diff.changed],['Removed',diff.removed]])if(items.length){lines.push(`### ${name}`,'');for(const item of items)lines.push(`- \`${item.run_id}/${item.observation_id}\``);lines.push('');}}
  return lines.join('\n');
}

const [inputArg,outputArg='outputs/run-audit.json',baselineArg]=process.argv.slice(2);
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href&&['--help','-h'].includes(inputArg)){
  console.log('Usage: node src/run-audit.mjs <experiment.csv> [output.json] [baseline-audit.json]\nRequires run_id, ISO run_timestamp, and unique observation_id columns. Writes JSON and Markdown locally.');
}else if(inputArg&&process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const input=path.resolve(inputArg),output=path.resolve(outputArg),csv=fs.readFileSync(input,'utf8'),manifest=buildRunManifest(csv,path.relative(process.cwd(),input).replaceAll('\\','/'));
    const saved=baselineArg?JSON.parse(fs.readFileSync(path.resolve(baselineArg),'utf8')):null;
    const diff=baselineArg?diffRunManifests(saved.manifest||saved,manifest):null;
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({manifest,diff},null,2)+'\n');fs.writeFileSync(output.replace(/\.json$/i,'.md'),markdown(manifest,diff));
    console.log(`Audited ${manifest.runs.length} runs / ${manifest.observations.length} observations -> ${output}${diff?`; +${diff.added.length} ~${diff.changed.length} -${diff.removed.length}`:''}`);
  }catch(error){console.error(`[FATAL] ${error.message}`);process.exit(1);}
}
