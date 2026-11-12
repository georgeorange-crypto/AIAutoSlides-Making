import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const worker=fileURLToPath(new URL('../../workers/research/worker.py',import.meta.url));
const defaultPython=path.join(process.cwd(),'.venv','research',process.platform==='win32'?'Scripts/python.exe':'bin/python');
export function pythonExecutable(){return process.env.AIAUTOSLIDES_PYTHON||defaultPython;}
export function runResearchWorker(config,{timeoutMs=180000,maxBuffer=15*1024*1024,allowModelDownload=false}={}){
 const python=pythonExecutable();if(!fs.existsSync(python))throw new Error(`Research Python runtime is not configured. Create .venv/research using workers/research/install.ps1 (or install.sh), or set AIAUTOSLIDES_PYTHON. Expected: ${python}`);
 const result=spawnSync(python,[worker],{input:JSON.stringify(config),encoding:'utf8',windowsHide:true,timeout:timeoutMs,maxBuffer,cwd:process.cwd(),env:{...process.env,HF_HUB_OFFLINE:allowModelDownload?'0':'1',HF_HUB_DISABLE_TELEMETRY:'1',CRAWL4AI_DISABLE_TELEMETRY:'true',PYTHONUTF8:'1'}});
 if(result.error)throw new Error(`Python research worker failed to start: ${result.error.message}`);
 if(result.status!==0)throw new Error(`Python research worker exited ${result.status}: ${(result.stderr||result.stdout||'unknown error').trim().slice(0,2000)}`);
 try{return JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));}catch{throw new Error(`Python research worker returned malformed JSON: ${result.stdout.slice(0,500)}`);}
}
export function pythonWorkerDoctor(){try{return{ok:true,python:pythonExecutable(),...runResearchWorker({action:'doctor'},{timeoutMs:90000})};}catch(error){return{ok:false,python:pythonExecutable(),reason:error.message};}}
