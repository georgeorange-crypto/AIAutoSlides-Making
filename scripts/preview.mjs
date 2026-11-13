#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parsePreviewArgs,rendererOrder} from '../src/preview-backends.mjs';

let input,renderer='auto',stem,dir,pdf,previewManifest,rendererVersion='not-captured',rasterizer={id:'unknown',version:'not-captured'};
const attempts=[];
function writeStatus(status,extra={}){
 if(!previewManifest)return;
 const record={schema_version:1,status,pptx:input,pptx_sha256:fs.existsSync(input)?crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex'):null,renderer,renderer_version:rendererVersion,rasterizer,attempts,pdf:status==='rendered'?pdf:null,pdf_sha256:status==='rendered'&&fs.existsSync(pdf)?crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex'):null,pages:[],...extra};
 fs.writeFileSync(previewManifest,JSON.stringify(record,null,2)+'\n');
}
function run(cmd,args,options={}){
 const result=spawnSync(cmd,args,{encoding:'utf8',timeout:options.timeout??90000,maxBuffer:8*1024*1024,...options});
 if(result.error||result.status!==0)throw new Error(`${cmd} failed: ${result.error?.message||result.stderr||result.stdout||`exit ${result.status}`}`);
 return result;
}
function locate(candidates){
 if(candidates.some(name=>['soffice','libreoffice'].includes(name))&&process.env.AI4SLIDES_LIBREOFFICE_BIN&&fs.existsSync(process.env.AI4SLIDES_LIBREOFFICE_BIN))return process.env.AI4SLIDES_LIBREOFFICE_BIN;
 const lookup=process.platform==='win32'?'where.exe':'which';
 for(const candidate of candidates){const r=spawnSync(lookup,[candidate],{encoding:'utf8',timeout:5000});if(r.status===0)return candidate;}
 return null;
}
function removeStale(){
 for(const file of [pdf,previewManifest])if(fs.existsSync(file))fs.rmSync(file,{force:true});
 const re=new RegExp(`^${stem}-page-\\d+\\.png$`);
 for(const name of fs.readdirSync(dir))if(re.test(name))fs.rmSync(path.join(dir,name),{force:true});
}
function toPdf(backend){
 if(backend==='powerpoint'){
  if(process.platform!=='win32')throw new Error('PowerPoint COM rendering is only available on Windows');
  const ps=`$ErrorActionPreference='Stop'; $app=New-Object -ComObject PowerPoint.Application; $version=$app.Version; try { $app.DisplayAlerts=1; $p=$app.Presentations.Open('${input.replaceAll("'","''")}', $true, $false, $false); try { $p.SaveAs('${pdf.replaceAll("'","''")}', 32); $p.Close() } finally { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($p) } } finally { $app.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) }; Write-Output "POWERPOINT_VERSION=$version"`;
  const powershell=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const result=run(powershell,['-NoProfile','-NonInteractive','-Command',ps],{timeout:120000});rendererVersion=result.stdout.match(/POWERPOINT_VERSION=([^\r\n]+)/)?.[1]||'unknown';
  return;
 }
 const cmd=locate(process.platform==='win32'?['soffice','libreoffice']:['libreoffice','soffice']);
 if(!cmd)throw new Error('LibreOffice executable was not found on PATH');
 const version=run(cmd,['--version']);rendererVersion=(version.stdout||version.stderr||'unknown').trim().split(/\r?\n/)[0];
 const profile=path.join(os.tmpdir(),`aiautoslides-lo-${process.pid}`);
 run(cmd,[`-env:UserInstallation=${new URL(`file://${profile}`).href}`,'--headless','--convert-to','pdf','--outdir',dir,input],{timeout:90000});
}
function renderPng(){
 const prefix=path.join(dir,`${stem}-page`),ppm=locate(['pdftoppm']);
 if(ppm){const version=spawnSync(ppm,['-v'],{encoding:'utf8',timeout:4000,windowsHide:true});rasterizer={id:'pdftoppm',version:((version.stdout||'')+' '+(version.stderr||'')).trim().split(/\r?\n/)[0]||'unknown'};run(ppm,['-png','-r','120',pdf,prefix],{timeout:90000});return;}
 const cairo=locate(['pdftocairo']);
 if(cairo){const version=spawnSync(cairo,['-v'],{encoding:'utf8',timeout:4000,windowsHide:true});rasterizer={id:'pdftocairo',version:((version.stdout||'')+' '+(version.stderr||'')).trim().split(/\r?\n/)[0]||'unknown'};run(cairo,['-png','-r','120',pdf,prefix],{timeout:90000});return;}
 throw new Error('Neither pdftoppm nor pdftocairo was found on PATH');
}
try{
 ({input,renderer}=parsePreviewArgs(process.argv.slice(2)));
 input=path.resolve(input);
 if(!fs.existsSync(input))throw new Error(`Cannot find PPTX ${input}`);
 dir=path.dirname(input);stem=path.basename(input,'.pptx');pdf=path.join(dir,`${stem}.pdf`);previewManifest=`${path.join(dir,stem)}.preview.json`;
 removeStale();
 const order=rendererOrder(process.platform,renderer);
 if(!order.length)throw new Error(`Renderer ${renderer} is unsupported on ${process.platform}`);
 let used=null;
 for(const backend of order){try{toPdf(backend);if(!fs.existsSync(pdf))throw new Error(`${backend} reported success without creating ${pdf}`);used=backend;attempts.push({renderer:backend,status:'rendered'});break;}catch(error){attempts.push({renderer:backend,status:'failed',message:error.message});if(fs.existsSync(pdf))fs.rmSync(pdf,{force:true});if(renderer!=='auto')throw error;}}
 if(!used)throw new Error(`No PDF renderer succeeded: ${attempts.map(a=>`${a.renderer}: ${a.message}`).join(' | ')}`);
 renderPng();
 const pages=fs.readdirSync(dir).filter(n=>new RegExp(`^${stem}-page-\\d+\\.png$`).test(n)).sort((a,b)=>Number(a.match(/-(\d+)\.png$/)[1])-Number(b.match(/-(\d+)\.png$/)[1]));
 if(!pages.length)throw new Error('PDF renderer created no page PNGs');
 const qaFile=`${path.join(dir,stem)}.qa.json`,qa=fs.existsSync(qaFile)?JSON.parse(fs.readFileSync(qaFile,'utf8')):null,expectedSlides=qa?.pptx_sha256===crypto.createHash('sha256').update(fs.readFileSync(input)).digest('hex')?qa.slideCount:null;
 writeStatus('rendered',{renderer_used:used,pdf,pages:pages.map((name,i)=>({slide:i+1,path:path.join(dir,name),sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,name))).digest('hex')})),page_count_matches_storyboard:expectedSlides===null?null:expectedSlides===pages.length,expected_slide_count:expectedSlides});
 console.log(`Renderer: ${used} ${rendererVersion}`);console.log(`Rasterizer: ${rasterizer.id} ${rasterizer.version}`);console.log(`PDF preview: ${pdf}`);console.log(`Rendered ${pages.length} pages: ${pages.map(n=>path.join(dir,n)).join(', ')}`);console.log('Open every PNG for visual review; page generation does not itself record a human visual approval.');
}catch(error){
 try{attempts.push({renderer:renderer==='auto'?'auto':renderer,status:'failed',message:error.message});writeStatus('failed',{failure:error.message});}catch{}
 console.error(`[PREVIEW FAILED] ${error.message}`);process.exitCode=1;
}
