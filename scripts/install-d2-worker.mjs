#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version='0.9.0';
const archiveName=`d2-v${version}-windows-amd64.tar.gz`;
const archiveUrl=`https://github.com/d2lang/d2/releases/download/v${version}/${archiveName}`;
const archiveSha256='5f63b643de8f5a6dfb922d172e1b5496e4caf47497c33c4427cf1127f28c340f';
const installDir=path.join(root,'workers','d2','.tools',version);
const executable=path.join(installDir,'bin','d2.exe');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=(args,timeout=60000)=>{const result=spawnSync('tar',args,{encoding:'utf8',timeout,maxBuffer:4*1024*1024,windowsHide:true});if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||`tar exited ${result.status}`);return result.stdout||'';};

try{
 if(process.platform!=='win32')throw new Error('The pinned installer currently supplies the official Windows x64 release. Install D2 with the official OS instructions and set AI4SLIDES_D2_BIN on other platforms.');
 if(process.env.AI4SLIDES_D2_BIN){const result=spawnSync(process.env.AI4SLIDES_D2_BIN,['version'],{encoding:'utf8',timeout:10000,windowsHide:true});if(result.error||result.status!==0)throw new Error(`Configured D2 executable failed: ${result.stderr||result.error?.message||result.status}`);console.log(`Using configured D2 executable: ${(result.stdout||result.stderr).trim()}`);process.exit(0);}
 if(!fs.existsSync(executable)){
  console.log(`Downloading official D2 ${version} Windows x64 archive...`);
  const response=await fetch(archiveUrl,{signal:AbortSignal.timeout(10*60*1000)});if(!response.ok)throw new Error(`D2 archive request returned HTTP ${response.status}`);
  const archive=new Uint8Array(await response.arrayBuffer());if(archive.length>100*1024*1024)throw new Error('D2 archive exceeds the 100 MiB download bound.');
  const actual=sha256(archive);if(actual!==archiveSha256)throw new Error(`D2 archive SHA-256 mismatch: expected ${archiveSha256}, got ${actual}`);
  const temp=path.join(root,'workers','d2','.tools',`${version}.archive.tar.gz`),stage=path.join(root,'workers','d2','.tools',`${version}.staging`);fs.mkdirSync(path.dirname(temp),{recursive:true});fs.writeFileSync(temp,archive);
  try{
   const entries=run(['-tzf',temp]).split(/\r?\n/).filter(Boolean);
   for(const entry of entries){const normalized=entry.replaceAll('\\','/');if(normalized.startsWith('/')||/^[A-Za-z]:/.test(normalized)||normalized.split('/').includes('..'))throw new Error(`Unsafe D2 archive path: ${entry}`);}
   fs.mkdirSync(stage,{recursive:true});run(['-xzf',temp,'-C',stage,'--no-same-owner','--no-same-permissions']);
   const source=path.join(stage,`d2-v${version}`);if(!fs.existsSync(path.join(source,'bin','d2.exe')))throw new Error('D2 archive is missing bin/d2.exe.');
   fs.rmSync(installDir,{recursive:true,force:true});fs.renameSync(source,installDir);
  }finally{fs.rmSync(temp,{force:true});fs.rmSync(stage,{recursive:true,force:true});}
 }
 const result=spawnSync(executable,['version'],{encoding:'utf8',timeout:20000,windowsHide:true});if(result.error||result.status!==0)throw new Error(`Installed D2 failed: ${result.stderr||result.error?.message||result.status}`);
 const versionText=(result.stdout||result.stderr).trim();if(!versionText.includes(version))throw new Error(`Expected D2 ${version}, got ${versionText}`);
 console.log(`${versionText}; archive SHA-256 ${archiveSha256}; installed under ignored worker directory ${installDir}`);
}catch(error){console.error(`[deps:d2] ${error.message}`);process.exitCode=1;}
