import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {defineToolAdapter} from './protocol.mjs';

const execFileAsync=promisify(execFile);
const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const workerRoot=path.join(root,'workers','marp');
const cliFile=path.join(workerRoot,'node_modules','@marp-team','marp-cli','marp-cli.js');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const knownBrowsers=process.platform==='win32' ? [
  process.env.MARP_BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean) : [process.env.MARP_BROWSER_PATH,'/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/microsoft-edge'].filter(Boolean);

function browserPath(){return knownBrowsers.find(file=>fs.existsSync(file))||null;}
async function invoke(_binary,args,options={}){
  if(!fs.existsSync(cliFile))throw new Error('Marp worker is not installed. Run npm run deps:marp.');
  const {stdout='',stderr=''}=await execFileAsync(process.execPath,[cliFile,...args],{cwd:workerRoot,windowsHide:true,maxBuffer:8*1024*1024,timeout:120000,...options});
  return `${stdout}${stderr}`.trim();
}
function safeMarkdown(input){
  const info=fs.statSync(input);
  if(!info.isFile()||info.size===0||info.size>2*1024*1024)throw new Error('Marp Markdown must be a regular file from 1 byte to 2 MiB.');
  const content=fs.readFileSync(input,'utf8');
  if(/!\[[^\]]*\]\(\s*<?\s*(?:https?:|\/\/|data:|file:)|^\s*\[[^\]]+\]:\s*<?\s*(?:https?:|\/\/|data:|file:)|<(?:img|iframe|script|video|audio|object|embed|link)\b[^>]*(?:src|href)\s*=\s*["']?\s*(?:https?:|\/\/|data:|file:)|url\(\s*["']?\s*(?:https?:|\/\/|data:|file:)/im.test(content))throw new Error('Remote/data/file media and active HTML references are not allowed in Marp input.');
  if(/<\s*script\b|<\s*iframe\b|<\s*object\b|<\s*embed\b/i.test(content))throw new Error('Active HTML is not allowed in Marp input.');
  return {content,bytes:fs.readFileSync(input)};
}
function inspectPptx(bytes){
  const files=unzipSync(new Uint8Array(bytes));
  const slides=Object.keys(files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
  if(!slides.length)throw new Error('Marp output contains no PPTX slides.');
  const textObjects=slides.reduce((sum,file)=>sum+[...strFromU8(files[file]).matchAll(/<a:t>/g)].length,0);
  const media=Object.keys(files).filter(name=>/^ppt\/media\//.test(name));
  return {slide_count:slides.length,editable_text_runs:textObjects,media_objects:media.length,rasterized_page_deck:media.length>=slides.length&&textObjects===0};
}
function inDirectory(file,directory){const relative=path.relative(directory,file);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));}

export function createMarpAdapter({runCommand=invoke}={}){
  return defineToolAdapter({
    manifest:{id:'marp',version:'4.5.1',status:'adapter-ready',kind:'deck-backend',invoke:'isolated npm worker CLI',inputs:['marp-markdown'],outputs:['html','pdf','pptx','backend-manifest'],needsNetwork:false,needsAuth:false},
    async doctor(){
      try{
        if(!fs.existsSync(cliFile))throw new Error('isolated Marp dependencies are not installed; run npm run deps:marp.');
        const version=(await runCommand(process.execPath,['--version'])).trim();
        const browser=browserPath();
        return {ok:true,status:'available',version,browser:browser||null,warnings:[...(browser?[]:['HTML output is available; PDF/PPTX output also needs Chrome, Edge, or Firefox.']),'Default PPTX conversion uses rendered slide-page images, not editable PowerPoint objects.']};
      }catch(error){return {ok:false,status:'blocked',reason:`Marp worker unavailable: ${error.message}`,warnings:[]};}
    },
    async probeCapabilities(){return {formats:['html','pdf','pptx'],editableText:false,editableShapes:false,nativeCharts:false,sourceMarkdown:true,offline:true,importsExistingDecks:false};},
    async smokeTest(){
      const dir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'ai4slides-marp-smoke-'));
      try{
        const input=path.join(dir,'synthetic.md');
        await writeFile(input,'---\nmarp: true\ntheme: default\n---\n# Synthetic fixture\n\nNo factual results.\n\n---\n\n## Evidence boundary\n\nAll content is synthetic.\n');
        const result=await this.run({inputFile:input,outputDir:dir,formats:['html','pptx']});
        const pptx=result.artifacts.find(item=>item.kind==='pptx');
        const html=result.artifacts.find(item=>item.kind==='html');
        const qa=inspectPptx(await readFile(pptx.path));
        if(qa.slide_count!==2||!qa.rasterized_page_deck)throw new Error(`Marp smoke output editability profile changed: ${JSON.stringify(qa)}`);
        if(!(await readFile(html.path,'utf8')).includes('Synthetic fixture'))throw new Error('Marp HTML output did not preserve fixture title.');
        return {ok:true,version:result.backendVersion,formats:['html','pptx'],...qa,editability:'rasterized slides; source Markdown remains editable',source_sha256:result.source.sha256,network:'local-only'};
      }finally{await fs.promises.rm(dir,{recursive:true,force:true});}
    },
    async run({inputFile,outputDir,formats=['pptx'],lineageFile=null,browser=browserPath(),timeoutMs=120000}={}){
      if(!inputFile||!outputDir)throw new TypeError('Marp adapter requires inputFile and outputDir.');
      const input=path.resolve(inputFile),out=path.resolve(outputDir);
      if(path.extname(input).toLowerCase()!=='.md'||!fs.existsSync(input))throw new Error('inputFile must be an existing .md file.');
      const source=safeMarkdown(input);
      const supported=new Set(['html','pdf','pptx']);
      if(!Array.isArray(formats)||!formats.length||formats.some(format=>!supported.has(format)))throw new Error('formats must be a non-empty subset of html, pdf, pptx.');
      if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw new Error('timeoutMs must be an integer from 1000 to 300000.');
      const selected=[...new Set(formats)];
      if(selected.some(format=>format!=='html')&&!browser)throw new Error('Marp PDF/PPTX output requires Chrome, Edge, or Firefox; HTML output remains available.');
      await mkdir(out,{recursive:true});
      const version=(await runCommand(process.execPath,['--version'])).trim();
      const artifacts=[];
      for(const format of selected){
        const target=path.resolve(out,`presentation.${format}`);
        if(!inDirectory(target,out)||target===input)throw new Error('Output must remain in outputDir and must not overwrite the source.');
        if(fs.existsSync(target))throw new Error(`Refusing to overwrite existing output: ${target}`);
        const flag=format==='html'?'--html':format==='pdf'?'--pdf':'--pptx';
        const args=[input,flag,'--no-stdin','--output',target,'--browser-timeout',String(Math.ceil(timeoutMs/1000))];
        if(format!=='html'&&browser)args.push('--browser-path',browser);
        await runCommand(process.execPath,args,{timeout:timeoutMs+15000});
        const info=await stat(target).catch(()=>null);
        if(!info?.isFile()||info.size===0)throw new Error(`Marp did not create a non-empty ${format} artifact.`);
        const bytes=await readFile(target),artifact={kind:format,path:target,sha256:sha256(bytes),bytes:bytes.length};
        if(format==='pptx')artifact.editability=inspectPptx(bytes);
        artifacts.push(artifact);
      }
      if(lineageFile){
        const sidecar=path.resolve(lineageFile);const bytes=await readFile(sidecar);
        const lineage=JSON.parse(bytes.toString('utf8'));
        if(!Array.isArray(lineage.slides)||!lineage.slides.length)throw new Error('lineageFile must contain a non-empty slides[] array.');
        const target=path.join(out,'source-lineage.json');
        if(fs.existsSync(target))throw new Error(`Refusing to overwrite existing output: ${target}`);
        await writeFile(target,bytes,{flag:'wx'});artifacts.push({kind:'source-manifest',path:target,sha256:sha256(bytes)});
      }
      const manifestPath=path.join(out,'marp-backend-manifest.json');
      if(fs.existsSync(manifestPath))throw new Error(`Refusing to overwrite existing output: ${manifestPath}`);
      const warnings=['Marp default PPTX conversion stores rendered slide pages as images; it does not satisfy editable-text or native-chart requirements.','Lineage sidecar records the provided mapping; Marp does not semantically validate claims against evidence.'];
      const manifest={schema_version:'1.0.0',adapter:'marp',backend_version:version,input:{path:path.basename(input),sha256:sha256(source.bytes),bytes:source.bytes.length},lineage:lineageFile?path.basename(lineageFile):null,formats:selected,artifacts,warnings};
      await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
      artifacts.push({kind:'backend-manifest',path:manifestPath,sha256:sha256(await readFile(manifestPath))});
      return {artifacts,warnings,backendVersion:version,source:{sha256:sha256(source.bytes)}};
    }
  });
}

export const marpAdapter=createMarpAdapter();
