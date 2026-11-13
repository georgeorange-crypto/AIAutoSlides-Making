#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const worker=path.join(root,'workers','matplotlib');
const venv=path.join(worker,'.venv');
const win=process.platform==='win32';
const python=process.env.AI4SLIDES_PYTHON||(win?'py':'python3');
const venvPython=win?path.join(venv,'Scripts','python.exe'):path.join(venv,'bin','python');
function run(file,args){
  const result=spawnSync(file,args,{cwd:root,stdio:'inherit',windowsHide:true,timeout:20*60*1000});
  if(result.error)throw new Error(`Could not start ${file}: ${result.error.message}`);
  if(result.status!==0)throw new Error(`${file} exited with status ${result.status}`);
}
try{
  if(!fs.existsSync(venvPython))run(python,[...(win?['-3.12']:[]),'-m','venv',venv]);
  run(venvPython,['-m','pip','install','--disable-pip-version-check','--requirement',path.join(worker,'requirements.lock.txt')]);
  run(venvPython,['-c','import matplotlib; print(f"Matplotlib {matplotlib.__version__}")']);
  console.log(`Matplotlib worker ready: ${venvPython}`);
}catch(error){console.error(`[deps:matplotlib] ${error.message}`);process.exitCode=1;}
