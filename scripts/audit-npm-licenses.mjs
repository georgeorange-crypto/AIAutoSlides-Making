#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const roots=['node_modules','workers/mermaid/node_modules'].map(item=>path.join(root,item)).filter(item=>fs.existsSync(item));
const packages=new Map();
function walkModules(directory){
  let entries;try{entries=fs.readdirSync(directory,{withFileTypes:true});}catch{return;}
  for(const entry of entries){
    if(!entry.isDirectory()||entry.isSymbolicLink())continue;
    const candidate=path.join(directory,entry.name);
    if(entry.name.startsWith('@')){walkScope(candidate);continue;}
    inspect(candidate);
  }
}
function walkScope(directory){
  let entries;try{entries=fs.readdirSync(directory,{withFileTypes:true});}catch{return;}
  for(const entry of entries)if(entry.isDirectory()&&!entry.isSymbolicLink())inspect(path.join(directory,entry.name));
}
function inspect(directory){
  const manifest=path.join(directory,'package.json');
  if(!fs.existsSync(manifest))return;
  let pkg;try{pkg=JSON.parse(fs.readFileSync(manifest,'utf8'));}catch{return;}
  if(!pkg.name||!pkg.version)return;
  const key=`${pkg.name}@${pkg.version}`;
  if(!packages.has(key))packages.set(key,{name:pkg.name,version:pkg.version,license:typeof pkg.license==='string'?pkg.license:pkg.license?.type||null,license_file:['LICENSE','LICENSE.md','LICENSE.txt','LICENCE','LICENCE.md','COPYING'].some(name=>fs.existsSync(path.join(directory,name))),manifest_path:path.relative(root,manifest).replaceAll(path.sep,'/')});
  walkModules(path.join(directory,'node_modules'));
}
for(const directory of roots)walkModules(directory);
const lockPath=path.join(root,'package-lock.json'),lockSha256=fs.existsSync(lockPath)?crypto.createHash('sha256').update(fs.readFileSync(lockPath)).digest('hex'):null;
const report={schema_version:'aiautoslides.npm-license-inventory.v1',generated_at:new Date().toISOString(),scope:'Installed npm packages in root and workers/mermaid node_modules trees; package metadata only, not legal review.',package_lock_sha256:lockSha256,package_count:packages.size,license_missing:[],license_file_missing:[],packages:[...packages.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.version.localeCompare(b.version))};
report.license_missing=report.packages.filter(item=>!item.license).map(({name,version,manifest_path})=>({name,version,manifest_path}));
report.license_file_missing=report.packages.filter(item=>!item.license_file).map(({name,version,license,manifest_path})=>({name,version,license,manifest_path}));
const output=path.join(root,'docs','NPM_DEPENDENCY_LICENSE_INVENTORY_2026-11-12.json');fs.writeFileSync(output,`${JSON.stringify(report,null,2)}\n`,{flag:'w'});
console.log(JSON.stringify({output:path.relative(root,output),package_count:report.package_count,license_missing:report.license_missing.length,license_file_missing:report.license_file_missing.length,package_lock_sha256:lockSha256},null,2));
