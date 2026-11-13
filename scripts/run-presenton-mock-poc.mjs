import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const image='ghcr.io/presenton/presenton:v0.9.12-beta';
const expectedDigest='sha256:dd444e4384df0caeb7cb96a26bfa7543a12d2be19c83d661446b2087d09aed54';
const out=path.resolve(process.argv[2]||path.join(root,'outputs/open-source-bakeoff/presenton-mock-poc'));
const relative=path.relative(root,out);
if(!relative||relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error('Output must be a child of this repository.');
try{await fs.access(out);throw new Error(`Refusing to overwrite existing output: ${out}`);}catch(error){if(error.code!=='ENOENT')throw error;}
const imageInfo=spawnSync('docker',['image','inspect',image,'--format','{{.Id}}'],{encoding:'utf8',windowsHide:true});
if(imageInfo.status!==0)throw new Error(`Pinned Presenton image is not available locally: ${imageInfo.stderr||imageInfo.stdout}`);
if(imageInfo.stdout.trim()!==expectedDigest)throw new Error(`Presenton image digest mismatch: ${imageInfo.stdout.trim()}`);
const random=crypto.randomBytes(5).toString('hex'),container=`presenton-mock-${random}`;
const password=crypto.randomBytes(18).toString('base64url'),username=`synthetic-${random}`,apiKeyLabel='Codex synthetic mock POC';
const capture={requests:[],completions:0,models:0,external_calls:0};
function boundedString(key,content,schema){
 let value;
 if(key==='__speaker_note__'||key==='speaker_note'||key==='speaker_notes')value='Synthetic/hypothetical test material. No empirical claim.';
 else if(key==='title'||key==='heading')value=content.split(/\r?\n/).find(line=>line.startsWith('# '))?.replace(/^#+\s*/,'')||'Synthetic technical systems talk';
 else if(/subtitle|caption|label|text|body|description|content|summary|note/i.test(key))value=content.replace(/^#+\s*/gm,'').trim()||'Synthetic/hypothetical test content.';
 else value=`Synthetic ${key||'text'} field`;
 const min=schema.minLength||0,max=schema.maxLength||1000;
 if(value.length<min)value=(value+' Synthetic hypothetical test fixture.').repeat(Math.ceil((min-value.length)/39)).slice(0,min);
 return value.slice(0,max);
}
function schemaValue(schema,key,context,rootSchema,depth=0){
 if(depth>18)return null;
 if(schema.$ref){const ref=schema.$ref.split('/').slice(1).map(part=>part.replace(/~1/g,'/').replace(/~0/g,'~')).reduce((value,part)=>value?.[part],rootSchema);return ref?schemaValue(ref,key,context,rootSchema,depth+1):null;}
 if(schema.enum?.length)return schema.enum[0];
 if(schema.const!==undefined)return schema.const;
 for(const union of ['anyOf','oneOf'])if(schema[union]?.length){const choice=schema[union].find(item=>item.type!=='null')||schema[union][0];return schemaValue(choice,key,context,rootSchema,depth+1);}
 const type=schema.type|| (schema.properties?'object':schema.items?'array':'string');
 if(type==='object'){
  const properties=schema.properties||{},required=new Set(schema.required||Object.keys(properties));
  return Object.fromEntries(Object.entries(properties).filter(([name])=>required.has(name)).map(([name,child])=>[name,schemaValue(child,name,context,rootSchema,depth+1)]));
 }
 if(type==='array'){
  const n=Math.min(schema.maxItems??schema.minItems??1,Math.max(schema.minItems??1,1));
  return Array.from({length:n},()=>schemaValue(schema.items||{},key,context,rootSchema,depth+1));
 }
 if(type==='string')return boundedString(key,context.content,schema);
 if(type==='integer'||type==='number')return Math.max(schema.minimum??0,0);
 if(type==='boolean')return false;
 if(type==='null')return null;
 return null;
}
function collectPrompt(body){
 const user=body.messages?.find(message=>message.role==='user')?.content;
 const text=typeof user==='string'?user:Array.isArray(user)?user.map(item=>item.text||'').join('\n'):'';
 const match=text.match(/# SLIDE CONTENT: START\s*([\s\S]*?)\s*# SLIDE CONTENT: END/);
 return{content:match?.[1]||text.slice(0,1200),slide:text.match(/# Slide Number:\s*(\d+)/)?.[1]||null};
}
const modelServer=createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const raw=Buffer.concat(chunks).toString('utf8');
 let body={};try{body=raw?JSON.parse(raw):{};}catch{}
 if(req.method==='GET'&&req.url==='/v1/models'){
  capture.models++;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({object:'list',data:[{id:'codex-synthetic-mock',object:'model',created:0,owned_by:'local'}]}));return;
 }
 if(req.method==='POST'&&req.url==='/v1/chat/completions'){
  capture.completions++;const context=collectPrompt(body),format=body.response_format;
  let content='Synthetic/hypothetical fixture response.';
  if(format?.json_schema?.schema){const schema=format.json_schema.schema;content=JSON.stringify(schemaValue(schema,'',context,schema));}
  else if(format?.type==='json_object')content='{}';
  capture.requests.push({method:req.method,path:req.url,model:body.model,slide:context.slide,response_format:format?.type||null,stream:body.stream===true,schema_keys:Object.keys(format?.json_schema?.schema?.properties||{}),prompt_sha256:crypto.createHash('sha256').update(raw).digest('hex')});
  const id=`chatcmpl-${capture.completions}`,model=body.model||'codex-synthetic-mock';
  if(body.stream===true){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});const events=[{id,object:'chat.completion.chunk',created:0,model,choices:[{index:0,delta:{role:'assistant'},finish_reason:null}]},{id,object:'chat.completion.chunk',created:0,model,choices:[{index:0,delta:{content},finish_reason:null}]},{id,object:'chat.completion.chunk',created:0,model,choices:[{index:0,delta:{},finish_reason:'stop'}]}];for(const event of events)res.write(`data: ${JSON.stringify(event)}\n\n`);res.end('data: [DONE]\n\n');return;}
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({id,object:'chat.completion',created:0,model,choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}]}));return;
 }
 capture.external_calls++;
 res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'Only synthetic local OpenAI-compatible endpoints are enabled.'}}));
});
await new Promise((resolve,reject)=>{modelServer.once('error',reject);modelServer.listen(0,'0.0.0.0',resolve);});
const modelPort=modelServer.address().port;
const portProbe=net.createServer();await new Promise((resolve,reject)=>portProbe.listen(0,'127.0.0.1',resolve));const appPort=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));
const dataDir=path.join(out,'temporary-app-data');
let containerStarted=false;
async function docker(args){const child=spawn('docker',args,{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});if(code!==0)throw new Error(`docker ${args[0]} failed (${code}): ${stderr||stdout}`);return stdout.trim();}
async function waitForPresenton(){for(let i=0;i<300;i++){try{const response=await fetch(`http://127.0.0.1:${appPort}/api/v1/auth/status`,{signal:AbortSignal.timeout(1000)});if(response.ok)return await response.json();}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}throw new Error('Presenton did not become healthy within 300 seconds.');}
async function request(base,route,{method='GET',body,headers={}}={}){const response=await fetch(`${base}${route}`,{method,headers:{...(body?{'content-type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(330000)});const bytes=Buffer.from(await response.arrayBuffer()),type=response.headers.get('content-type')||'';let value;try{value=JSON.parse(bytes.toString('utf8'));}catch{value=bytes.toString('utf8');}if(!response.ok)throw new Error(`${method} ${route} returned HTTP ${response.status}: ${JSON.stringify(value).slice(0,1200)}`);return{response,value,bytes,type};}
try{
 await fs.mkdir(dataDir,{recursive:true});
 await docker(['run','-d','--name',container,'-p',`127.0.0.1:${appPort}:80`,'-e','LLM=custom','-e',`CUSTOM_LLM_URL=http://host.docker.internal:${modelPort}/v1`,'-e','CUSTOM_LLM_API_KEY=synthetic-local-only','-e','CUSTOM_MODEL=codex-synthetic-mock','-e','DISABLE_IMAGE_GENERATION=true','-e','DISABLE_ANONYMOUS_TRACKING=true','-e','WEB_SEARCH=false','-e','MEM0_ENABLED=false','--mount',`type=bind,source=${dataDir.replaceAll('\\','/')},target=/app_data`,image]);containerStarted=true;
 const base=`http://127.0.0.1:${appPort}`,status=await waitForPresenton();
 if(status.configured)throw new Error('Fresh temporary app data unexpectedly contains an administrator.');
 await request(base,'/api/v1/auth/setup',{method:'POST',body:{username,password}});
 const login=await request(base,'/api/v1/auth/login',{method:'POST',body:{username,password}});
 const cookies=login.response.headers.getSetCookie?.()||[];const cookie=cookies.map(value=>value.split(';')[0]).join('; ');
 if(!cookie)throw new Error('Presenton login did not return its local session cookie.');
 const key=await request(base,'/api/v1/admin/api-keys',{method:'POST',headers:{cookie},body:{user_id:login.value.id,label:apiKeyLabel,expiry_days:1}});
 const token=key.value.token;if(!token)throw new Error('Presenton did not issue the temporary API key.');
 const payload=JSON.parse(await fs.readFile(path.join(root,'examples/open-source-bakeoff/presenton-request.json'),'utf8'));
 const generation=await request(base,'/api/v1/ppt/presentation/generate',{method:'POST',headers:{authorization:`Bearer ${token}`},body:payload});
 async function copyExport(returnedPath,extension,filename){
  if(typeof returnedPath!=='string'||!returnedPath.startsWith('/app_data/exports/')||returnedPath.includes('..'))throw new Error(`Presenton returned an unexpected export path: ${returnedPath}`);
  const sourcePath=path.resolve(dataDir,returnedPath.slice('/app_data/'.length)),inside=path.relative(dataDir,sourcePath);
  if(inside==='..'||inside.startsWith(`..${path.sep}`)||path.isAbsolute(inside)||!sourcePath.toLowerCase().endsWith(`.${extension}`))throw new Error(`Presenton returned an unsafe or non-${extension.toUpperCase()} export path: ${returnedPath}`);
  const bytes=await fs.readFile(sourcePath),target=path.join(out,filename);await fs.writeFile(target,bytes,{flag:'wx'});
  return{path:target,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),presenton_returned_path:returnedPath};
 }
 const pptxExport=await copyExport(generation.value.path,'pptx','presenton-synthetic.pptx');
 const pdfGeneration=await request(base,`/api/v1/ppt/presentation/${generation.value.presentation_id}/export`,{method:'POST',headers:{authorization:`Bearer ${token}`},body:{export_as:'pdf'}});
 const pdfExport=await copyExport(pdfGeneration.value.path,'pdf','presenton-synthetic.pdf');
 const artifact=pptxExport.path;
 const qaRun=spawnSync(process.execPath,[path.join(root,'src/qa.mjs'),artifact],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true});
 if(qaRun.error||qaRun.status!==0)throw new Error(`Presenton PPTX structural QA failed: ${qaRun.stderr||qaRun.stdout||qaRun.error?.message}`);
 const qa=JSON.parse(await fs.readFile(artifact.replace(/\.pptx$/i,'.qa.json'),'utf8'));
 const report={schema_version:'1.0.0',status:'completed',provider:{type:'local-openai-compatible-mock',model:'codex-synthetic-mock',model_deployed:false,external_calls:0,paid_calls:0},presenton:{image,container_digest:expectedDigest,upstream_tag_commit:'93b9dcf947f70ae107b779b51dd3c491e736748a'},input:{fixture:'examples/open-source-bakeoff/presenton-request.json',slides:payload.slides_markdown.length,synthetic:true,external_sources:false},mock_api:{base_url:'http://host.docker.internal:<ephemeral>/v1',models_endpoint_requests:capture.models,chat_completions_requests:capture.completions,unhandled_or_external_requests:capture.external_calls,request_records:capture.requests},output:{pptx:{path:path.basename(pptxExport.path),bytes:pptxExport.bytes,sha256:pptxExport.sha256,presenton_returned_path:pptxExport.presenton_returned_path},pdf:{path:path.basename(pdfExport.path),bytes:pdfExport.bytes,sha256:pdfExport.sha256,presenton_returned_path:pdfExport.presenton_returned_path}},object_qa:{status:qa.status,slide_count:qa.slideCount,editable_text_slides:qa.editableTextSlideCount,native_shapes:qa.nativeShapeCount,native_connectors:qa.nativeConnectorCount,native_charts:qa.nativeChartCount,native_tables:qa.nativeTableCount,picture_objects:qa.slides.reduce((sum,slide)=>sum+slide.images,0),errors:qa.errors,warnings:qa.warnings,per_slide:qa.slides.map(slide=>({slide:slide.slide,editable_text:slide.editableText,native_shapes:slide.nativeShapes,native_connectors:slide.nativeConnectors,native_charts:slide.charts,native_tables:slide.tables,picture_objects:slide.images,overlap_pairs:slide.overlaps.length}))},visual_review:{status:'requires_manual_review',rendered_by_harness:false},limitations:['Every model response was generated mechanically from the requested JSON schema; this is API/rendering contract validation, not language model output or content quality assessment.','Image generation, web search and Mem0 were disabled for the local fixture.','Structural QA does not establish visual acceptance; inspect the exported PDF pages separately.']};
 await fs.writeFile(path.join(out,'presenton-mock-report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(report,null,2));
}catch(error){
 let logs='';if(containerStarted)try{logs=await docker(['logs','--tail','60',container]);}catch{}
 throw new Error(`${error.message}\n--- Mock API capture ---\n${JSON.stringify(capture,null,2)}${logs?`\n--- Presenton container log tail ---\n${logs}`:''}`);
}finally{
 if(containerStarted)try{await docker(['rm','-f',container]);}catch{}
 modelServer.close();
 await fs.rm(dataDir,{recursive:true,force:true});
}
