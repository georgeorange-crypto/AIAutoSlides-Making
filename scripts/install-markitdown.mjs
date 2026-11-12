#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const worker=path.join(root,'workers','markitdown'),venv=path.join(worker,'.venv');
const pythonCandidates=process.env.PYTHON?[process.env.PYTHON.trim().split(/\s+/)]:process.platform==='win32'?[['python'],['py','-3.14'],['py','-3.13'],['py','-3.12'],['py','-3.11'],['py','-3.10']]:[['python3'],['python']];
const venvPython=path.join(venv,process.platform==='win32'?'Scripts/python.exe':'bin/python');
function run(command,args,timeout=900000){const r=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:8*1024*1024,windowsHide:true});if(r.error||r.status!==0)throw new Error(r.error?.message||r.stderr||r.stdout||`${command} exited ${r.status}`);return r;}
try{
 if(!fs.existsSync(venvPython)){
  const failures=[];let created=false;
  for(const spec of pythonCandidates){const command=spec[0],base=spec.slice(1);try{const version=run(command,[...base,'-c','import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'],30000).stdout.trim(),[major,minor]=version.split('.').map(Number);if(major!==3||minor<10||minor>14)throw new Error(`Python ${version} is outside the supported 3.10–3.14 range`);console.log(`Creating isolated MarkItDown environment with ${[command,...base].join(' ')} (Python ${version})...`);run(command,[...base,'-m','venv',venv]);created=true;break;}catch(error){failures.push(`${[command,...base].join(' ')}: ${error.message}`);}}
  if(!created)throw new Error(`No usable Python 3.10–3.14 interpreter found. ${failures.join(' | ')}`);
 }
 console.log('Installing the pinned MarkItDown base package plus PDF/DOCX/PPTX/XLSX converters (plugins and hosted-service extras are excluded)...');
 run(venvPython,['-m','pip','install','--disable-pip-version-check','--no-warn-script-location','-r',path.join(worker,'requirements.lock.txt')]);
 const r=run(venvPython,[path.join(worker,'worker.py'),'--version'],30000);const report=JSON.parse(r.stdout);
 if(report.available!==true||report.version!=='0.1.9')throw new Error(`Expected MarkItDown 0.1.9, got ${report.version||'unknown'}`);
 console.log(`Installed isolated MarkItDown ${report.version}. Python packages are local to ${venv}.`);
}catch(error){console.error(`[MarkItDown setup] ${error.message}`);process.exitCode=1;}
