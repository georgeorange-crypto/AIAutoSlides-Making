import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {defineToolAdapter} from './protocol.mjs';

const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const worker=path.join(root,'workers','markitdown','worker.py');
const MAX_SOURCE_BYTES=50*1024*1024,MAX_OUTPUT_BYTES=8*1024*1024;
const suffixes=new Set(['.csv','.docx','.html','.htm','.json','.md','.pdf','.pptx','.txt','.xlsx','.xml']);
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function defaultPython(){const bin=process.platform==='win32'?'Scripts/python.exe':'bin/python';return path.join(root,'workers','markitdown','.venv',bin);}
function inRoot(file,base){const rel=path.relative(base,file);return rel===''||(!rel.startsWith(`..${path.sep}`)&&rel!=='..'&&!path.isAbsolute(rel));}
function call(executable,args,{timeout=60000,maxBuffer=MAX_OUTPUT_BYTES}={}){const result=spawnSync(executable,args,{encoding:'utf8',timeout,maxBuffer,windowsHide:true});if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr?.trim()||result.stdout?.trim()||`MarkItDown worker exited ${result.status}`);return result;}
function callAsync(executable,args,{timeout=60000,maxBuffer=MAX_OUTPUT_BYTES,signal}={}){return new Promise((resolve,reject)=>{if(signal?.aborted){const error=new Error('MarkItDown conversion was cancelled.');error.name='AbortError';reject(error);return;}const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']}),stdout=[],stderr=[];let size=0,settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);},abort=()=>{child.kill();const error=new Error('MarkItDown conversion was cancelled.');error.name='AbortError';finish(error);},timer=setTimeout(()=>{child.kill();finish(new Error(`MarkItDown worker exceeded ${timeout} ms.`));},timeout);signal?.addEventListener('abort',abort,{once:true});for(const[stream,target]of[[child.stdout,stdout],[child.stderr,stderr]])stream.on('data',chunk=>{size+=chunk.length;if(size>maxBuffer){child.kill();finish(new Error(`MarkItDown worker exceeded ${maxBuffer} output bytes.`));return;}target.push(chunk);});child.once('error',error=>finish(error));child.once('close',(status,code)=>{const out=Buffer.concat(stdout).toString('utf8'),err=Buffer.concat(stderr).toString('utf8');if(status!==0)finish(new Error(err.trim()||out.trim()||`MarkItDown worker exited ${status}`));else finish(null,{stdout:out,stderr:err,status,signal:code});});});}

export function createMarkItDownAdapter({pythonExecutable=defaultPython(),runCommand=call,runCommandAsync=callAsync}={}){
 const invoke=(args,options)=>runCommand(pythonExecutable,[worker,...args],options);
 const validateInput=({inputFile,allowedRoot,maxSourceBytes=MAX_SOURCE_BYTES}={})=>{if(typeof inputFile!=='string'||typeof allowedRoot!=='string')throw new Error('run() requires inputFile and allowedRoot; authorize a local input root explicitly.');if(!fs.existsSync(pythonExecutable))throw new Error('Optional MarkItDown worker is not installed. Run npm run deps:markitdown.');if(!Number.isInteger(maxSourceBytes)||maxSourceBytes<1||maxSourceBytes>MAX_SOURCE_BYTES)throw new Error('maxSourceBytes must be an integer from 1 byte to 50 MiB.');const base=fs.realpathSync(allowedRoot),input=fs.realpathSync(inputFile);if(!inRoot(input,base))throw new Error('Input resolves outside allowedRoot.');const stat=fs.statSync(input);if(!stat.isFile()||stat.size===0||stat.size>maxSourceBytes)throw new Error(`Input must be a non-empty regular file no larger than ${maxSourceBytes} bytes.`);if(!suffixes.has(path.extname(input).toLowerCase()))throw new Error('Input extension is not in the local MarkItDown allowlist.');return{base,input,bytes:fs.readFileSync(input)};};
 const validateRecord=(record,bytes)=>{if(record.error||record.schema_version!=='1.0.0'||record.converter?.id!=='markitdown'||record.content?.format!=='text/markdown'||typeof record.content.text!=='string')throw new Error(record.error||'MarkItDown worker returned an invalid source record.');if(record.source.sha256!==sha256(bytes)||record.source.bytes!==bytes.length||record.verification_status!=='unverified')throw new Error('MarkItDown worker returned mismatched provenance or verification state.');return record;};
 return defineToolAdapter({
  manifest:{id:'markitdown',version:'0.1.9',status:'adapter-ready',kind:'parser',invoke:'isolated Python worker',inputs:['authorized-local-document'],outputs:['markdown-source-record-1.0.0'],needsNetwork:false,needsAuth:false},
  async doctor(){
   if(!fs.existsSync(worker))return{ok:false,status:'blocked',reason:'MarkItDown worker is missing.',warnings:[]};
   if(!fs.existsSync(pythonExecutable))return{ok:false,status:'blocked',reason:'Optional MarkItDown environment is not installed. Run npm run deps:markitdown.',warnings:[]};
   try{const r=invoke(['--version']);const value=JSON.parse(r.stdout);if(value.available!==true||value.version!=='0.1.9')throw new Error(`expected MarkItDown 0.1.9, got ${value.version||'unknown'}`);return{ok:true,status:'available',version:value.version,warnings:[]};}
   catch(error){return{ok:false,status:'blocked',reason:`MarkItDown worker check failed: ${error.message}`,warnings:[]};}
  },
  async probeCapabilities(){return{formats:['text/markdown'],inputs:[...suffixes].sort(),localOnly:true,plugins:false,pageLocators:false,verification:'always unverified',network:'disabled by adapter; convert_local only'};},
  async smokeTest(){
   const doctor=await this.doctor();if(!doctor.ok)return{ok:false,reason:doctor.reason};
   const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-markitdown-smoke-'));
   try{const input=path.join(dir,'fixture.html');fs.writeFileSync(input,'<!doctype html><html><body><h1>Local smoke fixture</h1><p>Not evidence.</p></body></html>');const result=await this.run({inputFile:input,allowedRoot:dir});const ok=result.source.sha256===sha256(fs.readFileSync(input))&&result.converter.version===doctor.version&&result.content.text.includes('Local smoke fixture')&&result.verification_status==='unverified';return{ok,version:doctor.version,format:'text/markdown',source_sha256:result.source.sha256,network:'not-requested'};}catch(error){return{ok:false,reason:error.message};}finally{fs.rmSync(dir,{recursive:true,force:true});}
  },
  async run({inputFile,allowedRoot,maxSourceBytes=MAX_SOURCE_BYTES}={}){
   const{base,input,bytes}=validateInput({inputFile,allowedRoot,maxSourceBytes});let record;
   try{const {stdout}=invoke(['--input',input,'--allowed-root',base],{timeout:60000,maxBuffer:MAX_OUTPUT_BYTES});record=JSON.parse(stdout);}catch(error){throw new Error(`MarkItDown conversion failed: ${error.message}`);}
   return validateRecord(record,bytes);
  },
  async runAsync({inputFile,allowedRoot,maxSourceBytes=MAX_SOURCE_BYTES,signal,timeoutMs=60000}={}){
   const{base,input,bytes}=validateInput({inputFile,allowedRoot,maxSourceBytes});let record;
   try{const{stdout}=await runCommandAsync(pythonExecutable,[worker,'--input',input,'--allowed-root',base],{timeout:timeoutMs,maxBuffer:MAX_OUTPUT_BYTES,signal});record=JSON.parse(stdout);}catch(error){if(error.name==='AbortError')throw error;throw new Error(`MarkItDown conversion failed: ${error.message}`);}
   return validateRecord(record,bytes);
  }
 });
}

export const markitdownAdapter=createMarkItDownAdapter();
