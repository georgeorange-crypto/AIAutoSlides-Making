#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';
import {spawnSync} from 'node:child_process';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const version='16.1.1';
const archiveUrl='https://gitlab.com/api/v4/projects/4207231/packages/generic/graphviz-releases/16.1.1/windows_10_cmake_Release_Graphviz-16.1.1-win64.zip';
const archiveSha256='72b1f3a9a1fd3f6e726478c1e044a95483a8fbddec13ba2fb395438d75d001b4';
const installDir=path.join(root,'workers','graphviz','.tools',version);
const dot=process.env.AI4SLIDES_GRAPHVIZ_DOT||path.join(installDir,'bin','dot.exe');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

try{
 if(process.platform!=='win32')throw new Error('This pinned local installer currently supplies the official Windows x64 ZIP only. On Linux/macOS install Graphviz with the OS package manager and set AI4SLIDES_GRAPHVIZ_DOT if needed.');
 if(process.env.AI4SLIDES_GRAPHVIZ_DOT){const check=spawnSync(dot,['-V'],{encoding:'utf8',timeout:5000,windowsHide:true});if(check.error||check.status!==0)throw new Error(`Configured dot executable failed: ${check.stderr||check.error?.message||check.status}`);console.log(`Using configured Graphviz executable ${dot}: ${(check.stderr||check.stdout).trim()}`);process.exit(0);}
 if(!fs.existsSync(dot)){
  console.log(`Downloading official Graphviz ${version} Windows x64 ZIP...`);
  const response=await fetch(archiveUrl,{signal:AbortSignal.timeout(10*60*1000)});if(!response.ok)throw new Error(`Graphviz archive request returned HTTP ${response.status}`);
  const archive=new Uint8Array(await response.arrayBuffer());if(archive.length>50*1024*1024)throw new Error('Graphviz archive exceeds the 50 MiB download bound.');
  const actual=sha256(archive);if(actual!==archiveSha256)throw new Error(`Graphviz ZIP SHA-256 mismatch: expected ${archiveSha256}, got ${actual}`);
  const entries=unzipSync(archive),stage=path.join(root,'workers','graphviz','.tools',`${version}.staging`);fs.mkdirSync(stage,{recursive:true});
  try{
   for(const [name,data] of Object.entries(entries)){const normalized=name.replaceAll('\\','/'),target=path.resolve(stage,...normalized.split('/'));const relative=path.relative(stage,target);if(relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error(`Unsafe Graphviz archive entry: ${name}`);if(name.endsWith('/')){fs.mkdirSync(target,{recursive:true});continue;}fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data);}
   const dotEntry=Object.keys(entries).find(name=>/(?:^|\/)bin\/dot\.exe$/i.test(name));if(!dotEntry)throw new Error('Official Graphviz ZIP does not contain bin/dot.exe.');
   const relativeDot=dotEntry.replaceAll('\\','/').split('/');const prefix=relativeDot.slice(0,-2);const source=path.join(stage,...prefix);fs.mkdirSync(path.dirname(installDir),{recursive:true});fs.renameSync(source,installDir);
  }finally{fs.rmSync(stage,{recursive:true,force:true});}
 }
 const result=spawnSync(dot,['-V'],{encoding:'utf8',timeout:60000,windowsHide:true});if(result.error||result.status!==0)throw new Error(`Installed dot failed: ${result.stderr||result.error?.message||result.status}`);
 const versionText=(result.stderr||result.stdout).trim();if(!versionText.includes(version))throw new Error(`Expected Graphviz ${version}, got ${versionText}`);
 console.log(`${versionText}; installed under ignored worker directory ${installDir}`);
}catch(error){console.error(`[deps:graphviz] ${error.message}`);process.exitCode=1;}
