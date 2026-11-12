import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {defineToolAdapter} from './protocol.mjs';

const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url)))),workerRoot=path.join(root,'workers','mermaid'),workerPackage=path.join(workerRoot,'package.json');
const require=createRequire(workerPackage);
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
function command(args,{timeout=60000}={}){const cli=path.join(workerRoot,'node_modules','@mermaid-js','mermaid-cli','src','cli.js');if(!fs.existsSync(cli))throw new Error('Mermaid worker is not installed. Run npm run deps:mermaid.');const result=spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8',timeout,maxBuffer:8*1024*1024,windowsHide:true});if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||result.stdout||`mmdc exited ${result.status}`);return(result.stdout||'').trim();}
function validateSource(file){
 if(!fs.existsSync(file))throw new Error(`Mermaid source not found: ${file}`);
 if(path.extname(file).toLowerCase()!=='.mmd')throw new Error('Only a single .mmd DSL file is supported; Markdown multi-diagram extraction is not enabled.');
 const stat=fs.statSync(file);if(stat.size===0||stat.size>2*1024*1024)throw new Error('Mermaid DSL must contain 1 byte to 2 MiB.');
 const source=fs.readFileSync(file,'utf8');if(/(?:https?:\/\/|file:\/\/|data:(?:image|text)\/)/i.test(source))throw new Error('Network and data URI references are not allowed in local Mermaid input.');
 return{source,sha256:sha256(fs.readFileSync(file))};
}
function inDirectory(file,directory){const relative=path.relative(directory,file);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));}

export const mermaidAdapter=defineToolAdapter({
 manifest:{id:'mermaid',version:'12.2.0',status:'e2e-tested',kind:'diagram',invoke:'isolated Node worker CLI',inputs:['mermaid-dsl'],outputs:['svg','png','pdf','diagram-manifest'],needsNetwork:false,needsAuth:false},
 async doctor(){
  try{if(!fs.existsSync(workerPackage))throw new Error('Isolated worker package manifest is missing.');if(!fs.existsSync(path.join(workerRoot,'node_modules','@mermaid-js','mermaid-cli','src','cli.js')))throw new Error('Mermaid worker dependencies are not installed; run npm run deps:mermaid.');const cliPackage=require(path.join(workerRoot,'node_modules','@mermaid-js','mermaid-cli','package.json')),puppeteer=require(path.join(workerRoot,'node_modules','puppeteer'));const browser=await puppeteer.executablePath();if(!fs.existsSync(browser))throw new Error(`Puppeteer browser is missing at ${browser}; run npm run deps:mermaid to install the worker.`);return{ok:true,status:'available',version:cliPackage.version,browser:browser.split(path.sep).slice(-3).join('/'),warnings:[]};}
  catch(error){return{ok:false,status:'blocked',reason:`Mermaid worker unavailable: ${error.message}`,warnings:[]};}
 },
 async probeCapabilities(){return{formats:['svg','png','pdf'],editableSource:true,pptxEditability:'SVG is a vector image object; PNG is raster; neither becomes native editable PowerPoint shapes.',network:'input URLs rejected; browser networking disabled for rendering'};},
 async smokeTest(){
  const doctor=await this.doctor();if(!doctor.ok)return{ok:false,reason:doctor.reason};
  const input=path.join(root,'examples','phase1','mermaid','synthetic-architecture.mmd'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-mermaid-smoke-'));
  try{const result=await this.run({inputFile:input,outputDir:dir,format:'svg'});const svg=fs.readFileSync(result.artifacts.find(file=>file.endsWith('.svg')),'utf8');const nodeIds=['Client','Gateway','Scheduler','Worker'];if(!/<svg\b/.test(svg)||!nodeIds.every(id=>new RegExp(`id=["'][^"']*${id}[^"']*["']`).test(svg))||!['<path','<rect','<polygon'].some(tag=>svg.includes(tag)))throw new Error('Mermaid SVG is missing the root, expected fixture nodes, or diagram geometry.');return{ok:true,version:doctor.version,format:'svg',bytes:Buffer.byteLength(svg),nodes_verified:nodeIds.length,source_sha256:result.report.source_sha256,output_sha256:result.report.output_sha256,network:'local-only'};}finally{fs.rmSync(dir,{recursive:true,force:true});}
 },
 async run({inputFile,outputDir,outputFile,format='svg',theme='neutral'}){
  const input=path.resolve(inputFile||''),dir=path.resolve(outputDir||'');if(!inputFile||!outputDir)throw new Error('run() requires inputFile and outputDir.');
  if(!['svg','png','pdf'].includes(format))throw new Error('format must be svg, png, or pdf.');
  if(!['neutral','default','dark','forest','base'].includes(theme))throw new Error('Unsupported Mermaid theme.');
  const source=validateSource(input),name=`${path.basename(input,path.extname(input))}.${format}`,output=path.resolve(outputFile||path.join(dir,name));
  if(!inDirectory(output,dir))throw new Error('Output file must stay inside outputDir.');if(output===input)throw new Error('Output must not overwrite the Mermaid source.');if(fs.existsSync(output))throw new Error(`Output already exists; refusing to overwrite: ${output}`);
  const doctor=await this.doctor();if(!doctor.ok)throw new Error(doctor.reason);
  fs.mkdirSync(dir,{recursive:true});const configDir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-mermaid-config-')),configFile=path.join(configDir,'mermaid.json'),puppeteerFile=path.join(configDir,'puppeteer.json');
  try{
   fs.writeFileSync(configFile,JSON.stringify({theme,securityLevel:'strict',startOnLoad:false,htmlLabels:false,flowchart:{htmlLabels:false}}));
   fs.writeFileSync(puppeteerFile,JSON.stringify({args:['--disable-background-networking','--disable-default-apps','--disable-sync','--metrics-recording-only','--no-first-run','--no-default-browser-check','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost']}));
   command(['-i',input,'-o',output,'-e',format,'-t',theme,'-c',configFile,'-p',puppeteerFile,'-q']);
  }finally{fs.rmSync(configDir,{recursive:true,force:true});}
  if(!fs.existsSync(output)||fs.statSync(output).size===0)throw new Error('Mermaid CLI returned without a non-empty artifact.');
  const bytes=fs.readFileSync(output),report={schema_version:'1.0.0',tool:{id:'mermaid',version:doctor.version},input:{path:input,sha256:source.sha256,bytes:Buffer.byteLength(source.source)},output:{path:output,format,sha256:sha256(bytes),bytes:bytes.length},theme,network:'local-only',editable:{source_dsl:true,output:format==='svg'?'vector-image':'raster-or-page-image',native_powerpoint_shapes:false},limitations:['Output is not native editable PowerPoint geometry. Keep the .mmd source and rebuild with native shapes when that editability is required.','Only one .mmd file is accepted; external URL/data references, custom CSS, and user Puppeteer configs are disabled.']};
  const reportFile=output.replace(/\.(svg|png|pdf)$/i,'.diagram.json');fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  return{artifacts:[output,reportFile],report,logs:[`mmdc ${doctor.version}; local-only render; ${format} ${bytes.length} bytes`],warnings:['SVG/PNG/PDF output is not a native editable PowerPoint diagram.']};
 }
});
