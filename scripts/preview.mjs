#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const input=path.resolve(process.argv[2]||'outputs/research-demo.pptx');
if(!fs.existsSync(input))throw new Error(`Cannot find PPTX ${input}`);
const dir=path.dirname(input),stem=path.basename(input,'.pptx'),pdf=path.join(dir,`${stem}.pdf`);
if(fs.existsSync(pdf))fs.rmSync(pdf);
for(const name of fs.readdirSync(dir))if(new RegExp(`^${stem}-page-\\d+\\.png$`).test(name))fs.rmSync(path.join(dir,name));
function run(cmd,args,options={}){const r=spawnSync(cmd,args,{encoding:'utf8',...options});if(r.error||r.status!==0)throw new Error(`${cmd} failed: ${r.error?.message||r.stderr||r.stdout}`);return r;}
if(process.platform==='win32'){
 const ps=`$ErrorActionPreference='Stop'; $app=New-Object -ComObject PowerPoint.Application; try { $p=$app.Presentations.Open('${input.replaceAll("'","''")}', $true, $false, $false); try { $p.SaveAs('${pdf.replaceAll("'","''")}', 32); $p.Close() } finally { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($p) } } finally { $app.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) }`;
 const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
 run(powershell,['-NoProfile','-NonInteractive','-Command',ps]);
}else{
 const cmd=process.platform==='darwin'?'soffice':'libreoffice';
 run(cmd,[`-env:UserInstallation=${new URL(`file://${path.join(os.tmpdir(),'aiautoslides-lo-profile')}`).href}`,'--headless','--convert-to','pdf','--outdir',dir,input]);
}
if(!fs.existsSync(pdf))throw new Error(`Renderer completed without creating ${pdf}`);
const prefix=path.join(dir,`${stem}-page`);
run('pdftoppm',['-png','-r','120',pdf,prefix]);
const pages=fs.readdirSync(dir).filter(n=>new RegExp(`^${stem}-page-\\d+\\.png$`).test(n)).sort((a,b)=>Number(a.match(/-(\d+)\.png$/)[1])-Number(b.match(/-(\d+)\.png$/)[1]));
if(!pages.length)throw new Error('Poppler created no page PNGs');
console.log(`PDF preview: ${pdf}`);
console.log(`Rendered ${pages.length} pages: ${pages.map(n=>path.join(dir,n)).join(', ')}`);
console.log('Open every PNG for visual review; no pixel-level clipping check is claimed by this script.');
