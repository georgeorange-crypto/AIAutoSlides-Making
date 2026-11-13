#!/usr/bin/env node
import {pathToFileURL} from 'node:url';

const MODERN_PROTOCOL='2026-07-28';
const LEGACY_PROTOCOLS=['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
const SUPPORTED_PROTOCOLS=[MODERN_PROTOCOL,...LEGACY_PROTOCOLS];
const MAX_FRAME_BYTES=4*1024*1024,MAX_RESPONSE_BYTES=8*1024*1024,MAX_REQUEST_BYTES=12*1024*1024;
const UUID={type:'string',pattern:'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'};
const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const projectArg={project_id:UUID},jobArg={job_id:UUID};

const TOOLS=[
  {name:'aiautoslides_health',description:'Read the status of the already-running local AIAutoSlides API. No project data is returned.',inputSchema:obj({}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:()=>'/health'},
  {name:'aiautoslides_list_projects',description:'List projects belonging to the local API principal.',inputSchema:obj({}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:()=>'/projects'},
  {name:'aiautoslides_create_project',description:'Create a project from a supplied Presentation IR and optionally apply a local preference profile. This writes a local project; call only after user approval.',inputSchema:obj({title:{type:'string',minLength:1,maxLength:180},presentation_ir:{type:'object'},profile_id:UUID},['title','presentation_ir']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:()=>'/projects',body:a=>({title:a.title,presentation_ir:a.presentation_ir,profile_id:a.profile_id})},
  {name:'aiautoslides_create_profile',description:'Create a local-only user preference profile. No network or paid API access can be enabled. Ask the user before writing this profile.',inputSchema:obj({preferences:obj({language:{type:'string',maxLength:80},audience_profile:{type:'string',enum:['general','research_group','academic_conference','investment_committee']},duration_seconds:{type:'integer',minimum:60,maximum:7200},theme:{type:'string',maxLength:80},tone:{type:'string',maxLength:80},slide_density:{type:'string',maxLength:80}}),profile_id:UUID},['preferences']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:()=>'/profiles',body:a=>({profile_id:a.profile_id,preferences:a.preferences})},
  {name:'aiautoslides_list_profiles',description:'List local user preference profiles without exposing credentials; profile data stays in the local API workspace.',inputSchema:obj({}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:()=>'/profiles'},
  {name:'aiautoslides_get_profile',description:'Read one local user preference profile.',inputSchema:obj({profile_id:UUID},['profile_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/profiles/${encodeURIComponent(a.profile_id)}`},
  {name:'aiautoslides_update_profile',description:'Replace all preferences in a local-only user profile. This changes future project defaults; ask the user before updating.',inputSchema:obj({profile_id:UUID,preferences:obj({language:{type:'string',maxLength:80},audience_profile:{type:'string',enum:['general','research_group','academic_conference','investment_committee']},duration_seconds:{type:'integer',minimum:60,maximum:7200},theme:{type:'string',maxLength:80},tone:{type:'string',maxLength:80},slide_density:{type:'string',maxLength:80}})},['profile_id','preferences']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'PATCH',route:a=>`/profiles/${encodeURIComponent(a.profile_id)}`,body:a=>({preferences:a.preferences})},
  {name:'aiautoslides_get_project',description:'Read project metadata, current Presentation IR and source verification states.',inputSchema:obj(projectArg,['project_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/projects/${encodeURIComponent(a.project_id)}`},
  {name:'aiautoslides_plan_deck',description:'Create a deterministic audience-aware content, narrative-role, media-candidate and time-budget plan from the current local Presentation IR. Does not invent content or call a model.',inputSchema:obj(projectArg,['project_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/projects/${encodeURIComponent(a.project_id)}/plan`},
  {name:'aiautoslides_research_topic',description:'Search OpenAlex, Crossref or arXiv scholarly metadata and attach the returned metadata candidates to one local project as unverified sources. This sends the query text to the selected public provider; call only after the user explicitly approves this outbound request and allow_network is true. It downloads no full text and creates no evidence excerpts or verified claims.',inputSchema:obj({...projectArg,provider:{type:'string',enum:['openalex','crossref','arxiv']},query:{type:'string',minLength:2,maxLength:500},limit:{type:'integer',minimum:1,maximum:10},allow_network:{type:'boolean'}},['project_id','provider','query','allow_network']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/research/topic`,body:a=>({provider:a.provider,query:a.query,limit:a.limit,allow_network:a.allow_network})},
  {name:'aiautoslides_enqueue_research',description:'Queue a durable single-stage scholarly metadata search for one project. Sends the query to OpenAlex, Crossref or arXiv and stores results as unverified source candidates. Requires explicit user approval and allow_network=true; no full text or evidence excerpts are created.',inputSchema:obj({...projectArg,provider:{type:'string',enum:['openalex','crossref','arxiv']},query:{type:'string',minLength:2,maxLength:500},limit:{type:'integer',minimum:1,maximum:10},timeout_ms:{type:'integer',minimum:500,maximum:30000},allow_network:{type:'boolean'}},['project_id','provider','query','allow_network']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/research/jobs`,body:a=>({provider:a.provider,query:a.query,limit:a.limit,timeout_ms:a.timeout_ms,allow_network:a.allow_network})},
  {name:'aiautoslides_enqueue_arxiv_ingest',description:'Queue download and local PDF.js extraction for one selected arXiv source already attached to a project. Requires explicit user approval and allow_download=true. Stores the PDF by SHA-256 and page excerpts as pending evidence; paper reuse rights remain unreviewed.',inputSchema:obj({...projectArg,source_id:{type:'string',pattern:'^SRC_[A-Z0-9_]+$'},allow_download:{type:'boolean'}},['project_id','source_id','allow_download']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/research/papers`,body:a=>({source_id:a.source_id,allow_download:a.allow_download})},
  {name:'aiautoslides_enqueue_document_ingest',description:'Queue local PDF.js, Docling or MarkItDown text extraction for one imported PDF or DOCX. Requires allow_extract=true; Docling model downloads are disabled unless separately approved with allow_model_download=true. Excerpts remain pending human verification.',inputSchema:obj({...projectArg,source_id:{type:'string',minLength:1,maxLength:100},engine:{type:'string',enum:['pdfjs','docling','markitdown']},allow_extract:{type:'boolean'},allow_model_download:{type:'boolean'}},['project_id','source_id','allow_extract']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/research/documents`,body:a=>({source_id:a.source_id,engine:a.engine,allow_extract:a.allow_extract,allow_model_download:a.allow_model_download})},
  {name:'aiautoslides_enqueue_page_crawl',description:'Queue a single-page Crawl4AI request for one user-authorized public HTTPS URL. Requires explicit approval, allow_network=true and site_authorized=true. Enforces robots, public-address and same-host rules; excerpts remain unverified and reuse rights require review.',inputSchema:obj({...projectArg,source_id:{type:'string',pattern:'^SRC_[A-Z0-9_]{1,90}$'},url:{type:'string',format:'uri',maxLength:4096},timeout_seconds:{type:'integer',minimum:10,maximum:45},allow_network:{type:'boolean'},site_authorized:{type:'boolean'}},['project_id','source_id','url','allow_network','site_authorized']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/research/pages`,body:a=>({source_id:a.source_id,url:a.url,timeout_seconds:a.timeout_seconds,allow_network:a.allow_network,site_authorized:a.site_authorized})},
  {name:'aiautoslides_critique_deck',description:'Run local structural/content rules and deterministic plan review against the current project. Scientific accuracy and visual approval remain unverified/pending.',inputSchema:obj(projectArg,['project_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/projects/${encodeURIComponent(a.project_id)}/critique`},
  {name:'aiautoslides_list_slides',description:'List the ordered slide records of a local project.',inputSchema:obj(projectArg,['project_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/projects/${encodeURIComponent(a.project_id)}/slides`},
  {name:'aiautoslides_patch_slide',description:'Patch supported fields on one slide. This creates a new IR revision; call only after user approval. Re-render is required.',inputSchema:obj({...projectArg,slide_id:{type:'string',pattern:'^S[0-9]{2,3}$'},patch:{type:'object'}},['project_id','slide_id','patch']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'PATCH',route:a=>`/projects/${encodeURIComponent(a.project_id)}/slides/${encodeURIComponent(a.slide_id)}`,body:a=>a.patch},
  {name:'aiautoslides_import_source',description:'Import an existing local file from the API workspace incoming/ directory. The API enforces that boundary and records the source as unverified by default. Call only after user approval.',inputSchema:obj({...projectArg,source_id:{type:'string',minLength:1,maxLength:128},file_path:{type:'string',minLength:1,maxLength:2048},type:{type:'string',maxLength:80},locator:{type:'string',maxLength:1000}},['project_id','source_id','file_path']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/sources`,body:a=>({source_id:a.source_id,file_path:a.file_path,type:a.type,locator:a.locator,verification_status:'unverified'})},
  {name:'aiautoslides_enqueue_render',description:'Enqueue local PPTX generation and structural QA; optionally request PDF/PNG preview. This creates files and a durable job. Obtain user approval before calling; it never invokes an AI or web API.',inputSchema:obj({...projectArg,preview:{type:'boolean'}},['project_id']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/jobs`,body:a=>a.preview===undefined?{}:{preview:a.preview}},
  {name:'aiautoslides_get_job',description:'Read job status, stage events and workflow result.',inputSchema:obj(jobArg,['job_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/jobs/${encodeURIComponent(a.job_id)}`},
  {name:'aiautoslides_cancel_job',description:'Request cancellation of a queued/running job; rendering cancellation is honored at workflow stage boundaries.',inputSchema:obj(jobArg,['job_id']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'POST',route:a=>`/jobs/${encodeURIComponent(a.job_id)}/cancel`,body:()=>({})},
  {name:'aiautoslides_list_artifacts',description:'List artifact metadata for exactly one project or job. This does not download artifact bytes.',inputSchema:{type:'object',properties:{project_id:UUID,job_id:UUID},oneOf:[{required:['project_id'],not:{required:['job_id']}},{required:['job_id'],not:{required:['project_id']}}],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>a.project_id?`/projects/${encodeURIComponent(a.project_id)}/artifacts`:`/jobs/${encodeURIComponent(a.job_id)}/artifacts`},
  {name:'aiautoslides_export_deck',description:'Locate the newest PPTX artifact for a completed project or job and return its local API download route and SHA-256. This does not run a new render or include file bytes.',inputSchema:{type:'object',properties:{project_id:UUID,job_id:UUID},oneOf:[{required:['project_id'],not:{required:['job_id']}},{required:['job_id'],not:{required:['project_id']}}],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>a.project_id?`/projects/${encodeURIComponent(a.project_id)}/artifacts`:`/jobs/${encodeURIComponent(a.job_id)}/artifacts`,transform:(a,value,base)=>{const artifacts=(value.artifacts||[]).filter(item=>item.format==='pptx').sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at)));if(!artifacts.length)throw new Error('No PPTX artifact is available for this project or job.');const artifact=artifacts[0];return{artifact_id:artifact.artifact_id,job_id:artifact.job_id,sha256:artifact.sha256,format:artifact.format,download_url:new URL(`/artifacts/${encodeURIComponent(artifact.artifact_id)}`,base).toString(),download_method:'GET'};}}
].sort((a,b)=>a.name.localeCompare(b.name));

function apiUrl(value){
  const url=new URL(value);
  if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('AIAUTOSLIDES_API_URL must be an http URL to 127.0.0.1 or [::1], with no credentials, path, query, or fragment.');
  return url.origin;
}
function rpcError(id,code,message,data){return{jsonrpc:'2.0',id,error:{code,message,...(data===undefined?{}:{data})}};}
function result(id,value,modern=false){return{jsonrpc:'2.0',id,result:modern?{resultType:'complete',...value}:value};}
function validateRpc(message){return message&&typeof message==='object'&&!Array.isArray(message)&&message.jsonrpc==='2.0'&&typeof message.method==='string'&&(!Object.hasOwn(message,'id')||typeof message.id==='string'||Number.isSafeInteger(message.id));}
function schemaErrors(schema,value,where='arguments'){
  const errors=[];if(schema.type==='object'&&(!value||typeof value!=='object'||Array.isArray(value)))return[`${where} must be an object`];
  if(schema.type==='string'&&typeof value!=='string')return[`${where} must be a string`];if(schema.type==='boolean'&&typeof value!=='boolean')return[`${where} must be a boolean`];
  if(schema.type==='integer'&&(!Number.isInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))return[`${where} must be an integer in the supported range`];
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))errors.push(`${where}.${key} is required`);
  if(schema.additionalProperties===false)for(const key of Object.keys(value))if(!Object.hasOwn(schema.properties||{},key))errors.push(`${where}.${key} is not allowed`);
  for(const [key,child] of Object.entries(schema.properties||{}))if(Object.hasOwn(value,key)){const item=value[key];if(child.type==='object')errors.push(...schemaErrors(child,item,`${where}.${key}`));else errors.push(...schemaErrors(child,item,`${where}.${key}`));}
  if(schema.oneOf){const matches=schema.oneOf.filter(option=>(option.required||[]).every(key=>Object.hasOwn(value,key))&&!(option.not?.required||[]).some(key=>Object.hasOwn(value,key)));if(matches.length!==1)errors.push(`${where} must match exactly one supported input variant`);}
  if(typeof value==='string'){if(schema.minLength!==undefined&&value.length<schema.minLength)errors.push(`${where} is too short`);if(schema.maxLength!==undefined&&value.length>schema.maxLength)errors.push(`${where} is too long`);if(schema.pattern&&!new RegExp(schema.pattern).test(value))errors.push(`${where} has an invalid format`);}
  if(schema.enum&&!schema.enum.includes(value))errors.push(`${where} must be one of ${schema.enum.join(', ')}`);
  return errors;
}

export function createMcpProtocol({apiBase=process.env.AIAUTOSLIDES_API_URL||'http://127.0.0.1:8787',fetchImpl=fetch}={}){
  const base=apiUrl(apiBase);let initialized=false;
  async function request(method,route,body){
    const data=body===undefined?undefined:JSON.stringify(body);if(data&&Buffer.byteLength(data)>MAX_REQUEST_BYTES)throw new Error('Request exceeds local MCP payload limit.');
    const response=await fetchImpl(new URL(route,base),{method,headers:data?{'content-type':'application/json'}:undefined,body:data,signal:AbortSignal.timeout(30000)});
    const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>MAX_RESPONSE_BYTES)throw new Error('Local API response exceeds MCP output limit.');chunks.push(chunk);}
    const text=Buffer.concat(chunks).toString('utf8');let value;try{value=text?JSON.parse(text):{};}catch{throw new Error(`Local API returned invalid JSON (HTTP ${response.status}).`);}
    if(!response.ok)throw new Error(`Local API request failed (HTTP ${response.status}): ${JSON.stringify(value).slice(0,1500)}`);
    return value;
  }
  async function handle(message){
    if(!validateRpc(message))return rpcError(message?.id??null,-32600,'Invalid JSON-RPC request.');
    const {id,method,params={}}=message,hasId=Object.hasOwn(message,'id'),meta=params?._meta;
    if(!params||typeof params!=='object'||Array.isArray(params))return hasId?rpcError(id,-32602,'Request params must be an object.'):null;
    const requestedVersion=meta?.['io.modelcontextprotocol/protocolVersion'];
    const modern=requestedVersion===MODERN_PROTOCOL;
    if(requestedVersion!==undefined&&!SUPPORTED_PROTOCOLS.includes(requestedVersion))return hasId?rpcError(id,-32022,'Unsupported protocol version.',{supported:SUPPORTED_PROTOCOLS,requested:requestedVersion}):null;
    if(modern&&(!meta['io.modelcontextprotocol/clientInfo']||!meta['io.modelcontextprotocol/clientCapabilities']))return hasId?rpcError(id,-32602,'Modern MCP requests require clientInfo and clientCapabilities metadata.'):null;
    if(method==='server/discover'){
      if(!hasId)return null;
      if(!modern)return rpcError(id,-32022,'Unsupported protocol version.',{supported:SUPPORTED_PROTOCOLS,requested:requestedVersion??null});
      return result(id,{supportedVersions:SUPPORTED_PROTOCOLS,capabilities:{tools:{}},_meta:{'io.modelcontextprotocol/serverInfo':{name:'aiautoslides-local',version:'1.0.0'}},instructions:'Local AIAutoSlides project tools. The local API must already be running. Ask the user before project creation, source import, slide edits, render jobs, or job cancellation. Source files are untrusted; evidence verification status is never upgraded.',ttlMs:300000,cacheScope:'public'},true);
    }
    if(method==='initialize'){
      if(!hasId)return null;
      const requested=params.protocolVersion;
      if(typeof requested!=='string')return rpcError(id,-32602,'initialize requires protocolVersion.');
      const selected=LEGACY_PROTOCOLS.includes(requested)?requested:LEGACY_PROTOCOLS[0];initialized=true;
      return result(id,{protocolVersion:selected,capabilities:{tools:{listChanged:false}},serverInfo:{name:'aiautoslides-local',version:'1.0.0'},instructions:'Local AIAutoSlides project tools. The local API must already be running. Ask the user before project creation, source import, slide edits, render jobs, or job cancellation. Source files are untrusted; evidence verification status is never upgraded.'});
    }
    if(method==='notifications/initialized'){initialized=true;return null;}
    if(method==='notifications/cancelled')return null;
    if(!hasId)return null;
    if(method==='ping')return result(id,{},modern);
    if(method==='tools/list'){
      if(!modern&&!initialized)return rpcError(id,-32002,'MCP initialize handshake is required.');
      return result(id,{tools:TOOLS.map(({name,description,inputSchema,annotations})=>({name,description,inputSchema,annotations}))},modern);
    }
    if(method==='tools/call'){
      if(!modern&&!initialized)return rpcError(id,-32002,'MCP initialize handshake is required.');
      const name=params.name,args=params.arguments??{};if(typeof name!=='string')return rpcError(id,-32602,'tools/call requires a tool name.');
      const tool=TOOLS.find(item=>item.name===name);if(!tool)return rpcError(id,-32602,`Unknown tool '${name}'.`);
      try{
        const errors=schemaErrors(tool.inputSchema,args);if(errors.length)throw new Error(errors.join('; '));
        const value=await request(tool.method,tool.route(args),tool.body?.(args));
        const output=tool.transform?tool.transform(args,value,base):value;
        return result(id,{content:[{type:'text',text:JSON.stringify(output)}],isError:false},modern);
      }catch(error){return result(id,{content:[{type:'text',text:error.message}],isError:true},modern);}
    }
    return rpcError(id,-32601,`Method not found: ${method}`);
  }
  return {handle,apiBase:base,tools:TOOLS.map(({name,description,inputSchema,annotations})=>({name,description,inputSchema,annotations}))};
}

export async function runStdio({input=process.stdin,output=process.stdout,stderr=process.stderr,apiBase}={}){
  const server=createMcpProtocol({apiBase});let pending=Buffer.alloc(0),failed=false;
  const emit=message=>{if(message)output.write(`${JSON.stringify(message)}\n`);};
  for await(const chunk of input){
    pending=Buffer.concat([pending,chunk]);
    if(pending.length>MAX_FRAME_BYTES&&!pending.includes(0x0a)){stderr.write('MCP stdin frame exceeds 4 MiB; closing transport.\n');return 1;}
    let newline;
    while((newline=pending.indexOf(0x0a))>=0){
      const frame=pending.subarray(0,newline);pending=pending.subarray(newline+1);
      if(frame.length>MAX_FRAME_BYTES){stderr.write('MCP stdin frame exceeds 4 MiB; closing transport.\n');return 1;}
      let message;try{message=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(frame));}catch{emit(rpcError(null,-32700,'Parse error.'));continue;}
      try{emit(await server.handle(message));}catch(error){failed=true;stderr.write(`MCP request failed: ${error.message}\n`);if(message&&Object.hasOwn(message,'id'))emit(rpcError(message.id,-32603,'Internal error.'));}
    }
    if(pending.length>MAX_FRAME_BYTES){stderr.write('MCP stdin frame exceeds 4 MiB; closing transport.\n');return 1;}
  }
  if(pending.length){stderr.write('MCP input ended with an incomplete JSON-RPC frame.\n');return 1;}
  return failed?1:0;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.includes('--help')||process.argv.includes('-h'))console.log('Usage: npm run mcp\nStarts the local stdio MCP server. The loopback REST API must already be running. Optional: AIAUTOSLIDES_API_URL=http://127.0.0.1:8787.');
  else try{const code=await runStdio();if(code)process.exitCode=code;}catch(error){process.stderr.write(`MCP startup failed: ${error.message}\n`);process.exitCode=1;}
}
