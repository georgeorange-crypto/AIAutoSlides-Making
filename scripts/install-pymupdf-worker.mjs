#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const worker=path.join(root,'workers','pymupdf'),venv=path.join(worker,'.venv');
const win=process.platform==='win32',venvPython=path.join(venv,win?'Scripts/python.exe':'bin/python');
const candidates=process.env.AI4SLIDES_PYMUPDF_PYTHON?[[process.env.AI4SLIDES_PYMUPDF_PYTHON,[]]]:win?[['py',['-3.14']],['py',['-3.13']],['py',['-3.12']],['py',['-3.11']],['python',[]]]:[['python3',[]],['python',[]]];
function run(command,args,timeout=900000){const result=spawnSync(command,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:8*1024*1024,windowsHide:true});if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||result.stdout||`${command} exited with ${result.status}`);return result;}
try{
 if(!fs.existsSync(venvPython)){
  const errors=[];let created=false;
  for(const [command,prefix] of candidates){
   try{
    const probe=JSON.parse(run(command,[...prefix,'-c','import json,sys; print(json.dumps({"version":list(sys.version_info[:3]),"executable":sys.executable}))'],30000).stdout);
    const [major,minor]=probe.version;if(major!==3||minor<11||minor>14)throw new Error(`Python ${major}.${minor} is outside the pinned 3.11–3.14 range`);
    console.log(`Creating isolated PyMuPDF environment with Python ${major}.${minor}...`);
    run(command,[...prefix,'-m','venv',venv],60000);created=true;break;
   }catch(error){errors.push(`${command} ${prefix.join(' ')}: ${error.message}`);}
  }
  if(!created)throw new Error(`No usable Python 3.11–3.14 interpreter found. ${errors.join(' | ')}`);
 }
 console.log('Installing the exact PyMuPDF 2.1 dependency closure into workers/pymupdf/.venv...');
 run(venvPython,['-m','pip','install','--disable-pip-version-check','--no-warn-script-location','--requirement',path.join(worker,'requirements.lock.txt')]);
 const info=JSON.parse(run(venvPython,['-c','import json,pymupdf,sys; print(json.dumps({"version":pymupdf.__version__,"python":sys.version.split()[0]}))'],30000).stdout);
 if(info.version!=='2.1')throw new Error(`Expected PyMuPDF 2.1, found ${info.version}`);
 console.log(`PyMuPDF ${info.version} ready on Python ${info.python}: ${venvPython}`);
}catch(error){console.error(`[deps:pymupdf] ${error.message}`);process.exitCode=1;}
