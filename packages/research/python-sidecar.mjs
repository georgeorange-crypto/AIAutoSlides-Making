import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';

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
export function runResearchWorkerAsync(config,{timeoutMs=60000,maxBuffer=12*1024*1024,signal,allowModelDownload=false,spawnImpl=spawn,python=pythonExecutable(),workerPath=worker}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Object.assign(new Error('Research worker was cancelled.'),{name:'AbortError'}));return;}
  if(!fs.existsSync(python)){reject(new Error(`Research Python runtime is not configured. Create .venv/research using workers/research/install.ps1 (or install.sh), or set AIAUTOSLIDES_PYTHON. Expected: ${python}`));return;}
  const child=spawnImpl(python,[workerPath],{windowsHide:true,cwd:process.cwd(),env:{...process.env,HF_HUB_OFFLINE:allowModelDownload?'0':'1',HF_HUB_DISABLE_TELEMETRY:'1',CRAWL4AI_DISABLE_TELEMETRY:'true',PYTHONUTF8:'1'}}),stdout=[],stderr=[];let outBytes=0,errBytes=0,settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
  const abort=()=>{child.kill();finish(Object.assign(new Error('Research worker was cancelled.'),{name:'AbortError'}));};
  const timer=setTimeout(()=>{child.kill();finish(new Error(`Research Python worker timed out after ${timeoutMs} ms`));},timeoutMs);
  child.stdout.on('data',chunk=>{outBytes+=chunk.length;if(outBytes>maxBuffer){child.kill();finish(new Error(`Research worker output exceeds ${maxBuffer} byte limit`));return;}stdout.push(chunk);});
  child.stderr.on('data',chunk=>{if(errBytes<16384){const kept=chunk.subarray(0,16384-errBytes);stderr.push(kept);errBytes+=kept.length;}});
  child.on('error',error=>finish(new Error(`Python research worker failed to start: ${error.message}`)));
  child.on('close',(code)=>{if(settled)return;if(code!==0){finish(new Error(`Python research worker exited ${code}: ${Buffer.concat(stderr).toString('utf8').trim().slice(0,2000)||Buffer.concat(stdout).toString('utf8').slice(0,500)}`));return;}try{const output=Buffer.concat(stdout).toString('utf8').trim().split(/\r?\n/).at(-1);finish(null,JSON.parse(output));}catch{finish(new Error(`Python research worker returned malformed JSON: ${Buffer.concat(stdout).toString('utf8').slice(0,500)}`));}});
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify(config));
 });
}
export function pythonWorkerDoctor(){try{return{ok:true,python:pythonExecutable(),...runResearchWorker({action:'doctor'},{timeoutMs:90000})};}catch(error){return{ok:false,python:pythonExecutable(),reason:error.message};}}

