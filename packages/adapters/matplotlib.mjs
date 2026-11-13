import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {defineToolAdapter} from './protocol.mjs';

const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const worker=path.join(root,'workers','matplotlib');
const defaultPython=process.platform==='win32'?path.join(worker,'.venv','Scripts','python.exe'):path.join(worker,'.venv','bin','python');
const python=process.env.AI4SLIDES_MATPLOTLIB_PYTHON||defaultPython;
const renderer=path.join(worker,'render_chart.py');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_INPUT_BYTES=1_000_000;

function invoke(args,{timeout=120000}={}){
  const result=spawnSync(python,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:8*1024*1024,windowsHide:true,env:{...process.env,MPLBACKEND:'Agg',MPLCONFIGDIR:path.join(os.tmpdir(),'ai4slides-matplotlib-config')}});
  if(result.error)throw new Error(result.error.message);
  if(result.status!==0)throw new Error((result.stderr||result.stdout||`Python exited with ${result.status}`).trim().slice(-2000));
  return (result.stdout||'').trim();
}

function readBoundedJson(file,maxBytes=MAX_INPUT_BYTES){
  const resolved=path.resolve(file),info=fs.statSync(resolved);
  if(!info.isFile()||info.size===0||info.size>maxBytes)throw new Error(`JSON input must be a regular file from 1 byte to ${maxBytes} bytes.`);
  const bytes=fs.readFileSync(resolved);
  return {file:resolved,bytes,value:JSON.parse(bytes.toString('utf8'))};
}

function knownSourceIds(ledger){
  if(Array.isArray(ledger?.entries))return new Set(ledger.entries.map(entry=>entry.id).filter(id=>typeof id==='string'));
  const ids=(ledger?.sources||[]).map(item=>item.source_id);
  return new Set(ids.filter(id=>typeof id==='string'));
}

export function createMatplotlibAdapter({runCommand=invoke}={}){
  return defineToolAdapter({
    manifest:{id:'matplotlib',version:'3.10.8',status:'adapter-ready',kind:'scientific-figure',invoke:'isolated Python venv worker',inputs:['bounded-json-chart','evidence-ledger'],outputs:['svg','png','figure-manifest'],needsNetwork:false,needsAuth:false},
    async doctor(){
      if(!fs.existsSync(renderer)||!fs.existsSync(python))return {ok:false,status:'blocked',reason:'Isolated Matplotlib worker is not installed. Run npm run deps:matplotlib or set AI4SLIDES_MATPLOTLIB_PYTHON.',warnings:[]};
      try{const info=JSON.parse(runCommand(['-c','import json,matplotlib,sys; print(json.dumps({"python":sys.version.split()[0],"version":matplotlib.__version__}))']));if(info.version!=='3.10.8')throw new Error(`Expected Matplotlib 3.10.8, found ${info.version}.`);return {ok:true,status:'available',version:info.version,python:info.python,warnings:['SVG/PNG figures are image objects in PPTX; native PowerPoint chart editability is not provided.']};}
      catch(error){return {ok:false,status:'blocked',reason:`Matplotlib worker unavailable: ${error.message}`,warnings:[]};}
    },
    async probeCapabilities(){return {formats:['svg','png'],kinds:['line','bar','scatter','cdf'],deterministic:true,network:false,sourceIds:true,pptxEmbedding:'vector picture object; not native chart',nativePowerPointCharts:false};},
    async smokeTest(){
      const doctor=await this.doctor();if(!doctor.ok)return {ok:false,reason:doctor.reason};
      const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-matplotlib-smoke-'));
      try{
        const input=path.join(root,'examples','open-source-bakeoff','matplotlib-synthetic.json');
        const ledger=path.join(root,'examples','open-source-bakeoff','synthetic-evidence.json');
        const result=await this.run({inputFile:input,evidenceFile:ledger,outputDir:dir});
        const svg=fs.readFileSync(path.join(dir,'figure.svg'),'utf8');
        const png=fs.readFileSync(path.join(dir,'figure.png'));
        if(!svg.includes('Synthetic latency by payload size')||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Matplotlib fixture did not produce the expected SVG title and PNG signature.');
        return {ok:true,version:doctor.version,formats:['svg','png'],kind:result.manifest.kind,observations:result.manifest.observations,source_ids:result.manifest.source_ids,output_sha256:result.manifest.artifacts.map(item=>item.sha256),network:'local-only'};
      }finally{fs.rmSync(dir,{recursive:true,force:true});}
    },
    async run({inputFile,evidenceFile,outputDir,timeoutMs=120000}={}){
      if(!inputFile||!evidenceFile||!outputDir)throw new TypeError('Matplotlib run() requires inputFile, evidenceFile, and outputDir.');
      if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw new Error('timeoutMs must be an integer from 1000 to 300000.');
      const input=readBoundedJson(inputFile),ledger=readBoundedJson(evidenceFile);
      if(path.extname(input.file).toLowerCase()!=='.json'||path.extname(ledger.file).toLowerCase()!=='.json')throw new Error('Chart and evidence inputs must be .json files.');
      const ids=knownSourceIds(ledger.value);
      const sourceIds=input.value?.source_ids;
      if(!Array.isArray(sourceIds)||!sourceIds.length||sourceIds.some(id=>!ids.has(id)))throw new Error(`Unknown or missing source ID(s): ${(sourceIds||[]).filter(id=>!ids.has(id)).join(', ')||'(none)'}`);
      const doctor=await this.doctor();if(!doctor.ok)throw new Error(doctor.reason);
      const out=path.resolve(outputDir),manifestFile=path.join(out,'figure-manifest.json');
      if(fs.existsSync(out)&&(!fs.statSync(out).isDirectory()||['figure.svg','figure.png','figure-manifest.json'].some(name=>fs.existsSync(path.join(out,name)))))throw new Error('Matplotlib output already exists; refusing to overwrite.');
      const stdout=runCommand([renderer,input.file,out],{timeout:timeoutMs});
      let manifest;try{manifest=JSON.parse(stdout);}catch{throw new Error('Matplotlib worker returned a malformed run manifest.');}
      if(manifest.tool?.version!=='3.10.8'||manifest.input?.sha256!==sha256(input.bytes)||!manifest.artifacts?.some(item=>item.path==='figure.svg')||!manifest.artifacts?.some(item=>item.path==='figure.png'))throw new Error('Matplotlib worker manifest failed version, input-hash, or artifact validation.');
      for(const item of manifest.artifacts){
        if(!['figure.svg','figure.png'].includes(item.path))throw new Error('Matplotlib worker manifest listed an unexpected artifact path.');
        const bytes=fs.readFileSync(path.join(out,item.path));
        if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)throw new Error(`Matplotlib artifact failed its manifest hash: ${item.path}`);
      }
      const evidenceHash=sha256(ledger.bytes);
      manifest.lineage={evidence_file:path.basename(ledger.file),evidence_sha256:evidenceHash,source_ids:sourceIds};
      manifest.verification_status='pending';
      if(Array.isArray(ledger.value.entries))manifest.verification_status=sourceIds.every(id=>ledger.value.entries.find(entry=>entry.id===id)?.verified===true)?'verified':'unverified';
      else manifest.verification_status=sourceIds.every(id=>(ledger.value.sources||[]).find(entry=>entry.source_id===id)?.verification_status==='verified')?'verified':'unverified';
      manifest.warnings.push(`Source lineage status: ${manifest.verification_status}. Rendering does not upgrade source verification.`);
      fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
      const artifacts=[...manifest.artifacts.map(item=>({...item,path:path.join(out,item.path)})),{path:manifestFile,media_type:'application/json',bytes:fs.statSync(manifestFile).size,sha256:sha256(fs.readFileSync(manifestFile))}];
      return {ok:true,manifest,artifacts,warnings:manifest.warnings};
    }
  });
}

export const matplotlibAdapter=createMatplotlibAdapter();
