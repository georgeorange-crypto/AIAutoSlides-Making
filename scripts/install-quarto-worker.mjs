#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version='1.11.9',archiveName=`quarto-${version}-win.zip`;
const archiveUrl=`https://github.com/quarto-dev/quarto-cli/releases/download/v${version}/${archiveName}`;
const archiveSha256='eda220a2f39c392f622049de013ddf7b4dfdf019ba877f251be14ce43e5734d1';
const installDir=path.join(root,'workers','quarto','.tools',version),executable=path.join(installDir,'bin','quarto.exe');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(args,timeout=120000)=>{const result=spawnSync('tar',args,{encoding:'utf8',timeout,maxBuffer:4*1024*1024,windowsHide:true});if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||`tar exited ${result.status}`);return result.stdout||'';};
function findExecutable(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const candidate=path.join(directory,entry.name);if(entry.isDirectory()){const found=findExecutable(candidate);if(found)return found;}else if(entry.isFile()&&entry.name.toLowerCase()==='quarto.exe'&&path.basename(path.dirname(candidate)).toLowerCase()==='bin')return candidate;}return null;}

try{
 if(process.platform!=='win32')throw new Error('Pinned installer supplies the official Windows ZIP. Install Quarto using official platform instructions and set AI4SLIDES_QUARTO_BIN elsewhere.');
 if(process.env.AI4SLIDES_QUARTO_BIN){const result=spawnSync(process.env.AI4SLIDES_QUARTO_BIN,['--version'],{encoding:'utf8',timeout:20000,windowsHide:true});if(result.error||result.status!==0)throw new Error(`Configured Quarto executable failed: ${result.stderr||result.error?.message||result.status}`);console.log(`Using configured Quarto: ${(result.stdout||result.stderr).trim()}`);process.exit(0);}
 if(!fs.existsSync(executable)){
  console.log(`Downloading official Quarto ${version} Windows ZIP...`);
  const response=await fetch(archiveUrl,{signal:AbortSignal.timeout(10*60*1000)});if(!response.ok)throw new Error(`Quarto archive request returned HTTP ${response.status}`);
  const archive=new Uint8Array(await response.arrayBuffer());if(archive.length>250*1024*1024)throw new Error('Quarto archive exceeds the 250 MiB download bound.');
  const actual=sha256(archive);if(actual!==archiveSha256)throw new Error(`Quarto archive SHA-256 mismatch: expected ${archiveSha256}, got ${actual}`);
  const temp=path.join(root,'workers','quarto','.tools',`${version}.archive.zip`),stage=path.join(root,'workers','quarto','.tools',`${version}.staging`);fs.mkdirSync(path.dirname(temp),{recursive:true});fs.writeFileSync(temp,archive);
  try{
   const entries=run(['-tf',temp]).split(/\r?\n/).filter(Boolean);
   for(const entry of entries){const normalized=entry.replaceAll('\\','/');if(normalized.startsWith('/')||/^[A-Za-z]:/.test(normalized)||normalized.split('/').includes('..'))throw new Error(`Unsafe Quarto archive path: ${entry}`);}
   fs.mkdirSync(stage,{recursive:true});run(['-xf',temp,'-C',stage]);
   const executableSource=findExecutable(stage);if(!executableSource)throw new Error('Quarto ZIP does not contain a bin/quarto.exe executable.');const source=path.dirname(path.dirname(executableSource));
   fs.rmSync(installDir,{recursive:true,force:true});fs.renameSync(source,installDir);
  }finally{fs.rmSync(temp,{force:true});fs.rmSync(stage,{recursive:true,force:true});}
 }
 const result=spawnSync(executable,['--version'],{encoding:'utf8',timeout:30000,windowsHide:true});if(result.error||result.status!==0)throw new Error(`Installed Quarto failed: ${result.stderr||result.error?.message||result.status}`);
 const versionText=(result.stdout||result.stderr).trim();if(!versionText.includes(version))throw new Error(`Expected Quarto ${version}, got ${versionText}`);
 console.log(`${versionText}; archive SHA-256 ${archiveSha256}; installed under ignored worker directory ${installDir}`);
}catch(error){console.error(`[deps:quarto] ${error.message}`);process.exitCode=1;}
