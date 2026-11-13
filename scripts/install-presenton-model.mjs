#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PRESENTON_LOCAL_MODEL,verifyModelArtifact} from '../packages/adapters/presenton-model.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const modelDir=path.join(root,'workers','presenton','.models');
const modelPath=path.join(modelDir,PRESENTON_LOCAL_MODEL.filename);
const modelfilePath=path.join(modelDir,'Modelfile');
const modelUrl=`https://huggingface.co/${PRESENTON_LOCAL_MODEL.repo}/resolve/${PRESENTON_LOCAL_MODEL.revision}/${PRESENTON_LOCAL_MODEL.filename}`;
const timeout=AbortSignal.timeout(30*60*1000);

function run(args,{timeoutMs=30*60*1000,accepted=[0]}={}){
  const result=spawnSync(process.env.OLLAMA_BIN||'ollama',args,{cwd:modelDir,encoding:'utf8',timeout:timeoutMs,maxBuffer:4*1024*1024,windowsHide:true});
  if(result.error||!accepted.includes(result.status))throw new Error(result.error?.message||result.stderr||result.stdout||`ollama ${args[0]} exited with ${result.status}`);
  return (result.stdout||'').trim();
}

async function downloadModel(){
  console.log(`Downloading ${PRESENTON_LOCAL_MODEL.repo}@${PRESENTON_LOCAL_MODEL.revision} (${PRESENTON_LOCAL_MODEL.bytes} bytes)...`);
  const initial=await fetch(modelUrl,{redirect:'manual',signal:timeout});
  if(initial.status!==302&&initial.status!==307)throw new Error(`Hugging Face model request returned HTTP ${initial.status}.`);
  const location=initial.headers.get('location');if(!location)throw new Error('Hugging Face did not provide a model download redirect.');
  const downloadUrl=new URL(location,modelUrl);
  if(downloadUrl.protocol!=='https:'||!(downloadUrl.hostname==='huggingface.co'||downloadUrl.hostname.endsWith('.cdn.hf.co')))throw new Error(`Refusing model redirect host ${downloadUrl.hostname}.`);
  const response=await fetch(downloadUrl,{redirect:'manual',signal:timeout});
  if(!response.ok)throw new Error(`Hugging Face model CDN returned HTTP ${response.status}.`);
  const length=Number(response.headers.get('content-length'));
  if(length!==PRESENTON_LOCAL_MODEL.bytes)throw new Error(`Model CDN declared ${length} bytes; expected ${PRESENTON_LOCAL_MODEL.bytes}.`);
  const partial=`${modelPath}.partial`;
  if(fs.existsSync(partial))throw new Error(`Partial model file already exists at ${partial}; inspect or remove it before retrying.`);
  const hash=createHash('sha256');let received=0;
  const meter=new Transform({transform(chunk,encoding,callback){received+=chunk.length;if(received>PRESENTON_LOCAL_MODEL.bytes){callback(new Error('Model download exceeded its fixed size limit.'));return;}hash.update(chunk);callback(null,chunk);}});
  try{
    await pipeline(response.body,meter,createWriteStream(partial,{flags:'wx'}));
    const digest=hash.digest('hex');
    if(received!==PRESENTON_LOCAL_MODEL.bytes||digest!==PRESENTON_LOCAL_MODEL.sha256)throw new Error(`Model integrity check failed (bytes=${received}, sha256=${digest}).`);
    fs.renameSync(partial,modelPath);
  }catch(error){fs.rmSync(partial,{force:true});throw error;}
}

async function smokeModel(){
  const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(5*60*1000),body:JSON.stringify({model:PRESENTON_LOCAL_MODEL.ollamaName,messages:[{role:'user',content:'Reply with this exact marker and nothing else: AI4SLIDES_LOCAL_MODEL_OK'}],stream:false,options:{temperature:0,num_predict:64}})});
  if(!response.ok)throw new Error(`Local Ollama chat smoke returned HTTP ${response.status}.`);
  const result=await response.json(),content=result?.message?.content;
  if(typeof content!=='string'||!content.includes('AI4SLIDES_LOCAL_MODEL_OK'))throw new Error(`Local Ollama model did not return the smoke marker: ${String(content).slice(0,200)}`);
  return {model:PRESENTON_LOCAL_MODEL.ollamaName,marker:'AI4SLIDES_LOCAL_MODEL_OK',response_sha256:createHash('sha256').update(content).digest('hex')};
}

try{
  if(!['win32','linux','darwin'].includes(process.platform))throw new Error(`Unsupported platform ${process.platform}.`);
  fs.mkdirSync(modelDir,{recursive:true});
  if(fs.existsSync(modelPath))await verifyModelArtifact(modelPath);
  else await downloadModel();
  if(!fs.existsSync(modelfilePath))fs.writeFileSync(modelfilePath,`FROM ./${PRESENTON_LOCAL_MODEL.filename}\n`,{flag:'wx'});
  const show=spawnSync(process.env.OLLAMA_BIN||'ollama',['show',PRESENTON_LOCAL_MODEL.ollamaName],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024,windowsHide:true});
  if(show.status!==0)run(['create',PRESENTON_LOCAL_MODEL.ollamaName,'-f',modelfilePath]);
  const smoke=await smokeModel();
  console.log(JSON.stringify({ok:true,model:PRESENTON_LOCAL_MODEL,artifact:modelPath,integrity:await verifyModelArtifact(modelPath),ollama_version:run(['--version']),smoke},null,2));
}catch(error){console.error(`[deps:presenton-model] ${error.message}`);process.exitCode=1;}
