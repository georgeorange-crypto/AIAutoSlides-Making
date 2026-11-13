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
  {name:'aiautoslides_research_search',description:'Search scholarly metadata through OpenAlex, Crossref, or arXiv. Sends the query to the selected public provider only when allow_network is explicitly true; results are unverified metadata candidates, not evidence.',inputSchema:obj({provider:{type:'string',enum:['openalex','crossref','arxiv']},query:{type:'string',minLength:2,maxLength:500},limit:{type:'integer',minimum:1,maximum:10},allow_network:{type:'boolean'}},['provider','query','allow_network']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:false,openWorldHint:true},method:'POST',route:()=>'/research/search',body:a=>({provider:a.provider,query:a.query,limit:a.limit,allow_network:a.allow_network})},
  {name:'aiautoslides_project_research_search',description:'Search scholarly metadata and save unverified candidate records to a project. Sends the query to OpenAlex, Crossref, or arXiv only when allow_network is explicitly true. Requires user approval because it accesses an external service and writes project metadata.',inputSchema:obj({...projectArg,provider:{type:'string',enum:['openalex','crossref','arxiv']},query:{type:'string',minLength:2,maxLength:500},limit:{type:'integer',minimum:1,maximum:10},allow_network:{type:'boolean'}},['project_id','provider','query','allow_network']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:true},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/research/search`,body:a=>({provider:a.provider,query:a.query,limit:a.limit,allow_network:a.allow_network})},
  {name:'aiautoslides_list_research_candidates',description:'List metadata candidates previously saved from explicit project research searches. Candidates remain unverified and are not evidence.',inputSchema:obj(projectArg,['project_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/projects/${encodeURIComponent(a.project_id)}/research/candidates`},
  {name:'aiautoslides_import_research_candidate',description:'Register one saved metadata candidate as an unverified project source. This does not create an evidence excerpt or verify any claim. Obtain user approval before importing.',inputSchema:obj({...projectArg,source_id:{type:'string',pattern:'^SRC_(OPENALEX|CROSSREF|ARXIV)_[A-F0-9]{16}$'}},['project_id','source_id']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/research/candidates/${encodeURIComponent(a.source_id)}/import`,body:()=>({})},
  {name:'aiautoslides_list_evidence',description:'List the source excerpts in a project evidence ledger, including pending human review states.',inputSchema:obj(projectArg,['project_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/projects/${encodeURIComponent(a.project_id)}/evidence`},
  {name:'aiautoslides_add_evidence_excerpt',description:'Add a user-supplied source excerpt and locator to a project evidence ledger. The API always records it as pending and never marks the source or claim verified. Obtain user approval before writing.',inputSchema:obj({...projectArg,evidence_id:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9._:-]*$',minLength:1,maxLength:128},source_id:{type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9._:-]*$',minLength:1,maxLength:128},excerpt:{type:'string',minLength:1,maxLength:10000},locator:{type:'string',maxLength:1000}},['project_id','evidence_id','source_id','excerpt']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/evidence`,body:a=>({evidence_id:a.evidence_id,source_id:a.source_id,excerpt:a.excerpt,locator:a.locator})},
  {name:'aiautoslides_review_evidence',description:'Record a human-supplied verified or contradicted decision for the current exact excerpt, with reviewer and a matching content SHA-256. The source itself remains unchanged. Obtain user approval before recording this review.',inputSchema:obj({...projectArg,evidence_id:{type:'string',minLength:1,maxLength:128},reviewer:{type:'string',minLength:1,maxLength:180},decision:{type:'string',enum:['verified','contradicted']},content_sha256:{type:'string',pattern:'^[a-fA-F0-9]{64}$'},note:{type:'string',maxLength:1000}},['project_id','evidence_id','reviewer','decision','content_sha256']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/evidence/${encodeURIComponent(a.evidence_id)}/review`,body:a=>({reviewer:a.reviewer,decision:a.decision,content_sha256:a.content_sha256,note:a.note})},
  {name:'aiautoslides_list_projects',description:'List projects belonging to the local API principal.',inputSchema:obj({}),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:()=>'/projects'},
  {name:'aiautoslides_create_project',description:'Create a project from a supplied Presentation IR. This writes a local project; call only after user approval.',inputSchema:obj({title:{type:'string',minLength:1,maxLength:180},presentation_ir:{type:'object'}},['title','presentation_ir']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:()=>'/projects',body:a=>({title:a.title,presentation_ir:a.presentation_ir})},
  {name:'aiautoslides_get_project',description:'Read project metadata, current Presentation IR and source verification states.',inputSchema:obj(projectArg,['project_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/projects/${encodeURIComponent(a.project_id)}`},
  {name:'aiautoslides_list_slides',description:'List the ordered slide records of a local project.',inputSchema:obj(projectArg,['project_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/projects/${encodeURIComponent(a.project_id)}/slides`},
  {name:'aiautoslides_patch_slide',description:'Patch supported fields on one slide. This creates a new IR revision; call only after user approval. Re-render is required.',inputSchema:obj({...projectArg,slide_id:{type:'string',pattern:'^S[0-9]{2,3}$'},patch:{type:'object'}},['project_id','slide_id','patch']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'PATCH',route:a=>`/projects/${encodeURIComponent(a.project_id)}/slides/${encodeURIComponent(a.slide_id)}`,body:a=>a.patch},
  {name:'aiautoslides_import_source',description:'Import an existing local file from the API workspace incoming/ directory. The API enforces that boundary and records the source as unverified by default. Call only after user approval.',inputSchema:obj({...projectArg,source_id:{type:'string',minLength:1,maxLength:128},file_path:{type:'string',minLength:1,maxLength:2048},type:{type:'string',maxLength:80},locator:{type:'string',maxLength:1000}},['project_id','source_id','file_path']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/sources`,body:a=>({source_id:a.source_id,file_path:a.file_path,type:a.type,locator:a.locator,verification_status:'unverified'})},
  {name:'aiautoslides_enqueue_render',description:'Enqueue local PPTX generation and structural QA; optionally request PDF/PNG preview. This creates files and a durable job. Obtain user approval before calling; it never invokes an AI or web API.',inputSchema:obj({...projectArg,preview:{type:'boolean'}},['project_id']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false},method:'POST',route:a=>`/projects/${encodeURIComponent(a.project_id)}/jobs`,body:a=>a.preview===undefined?{}:{preview:a.preview}},
  {name:'aiautoslides_get_job',description:'Read job status, stage events and workflow result.',inputSchema:obj(jobArg,['job_id']),annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>`/jobs/${encodeURIComponent(a.job_id)}`},
  {name:'aiautoslides_cancel_job',description:'Request cancellation of a queued/running job; rendering cancellation is honored at workflow stage boundaries.',inputSchema:obj(jobArg,['job_id']),annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'POST',route:a=>`/jobs/${encodeURIComponent(a.job_id)}/cancel`,body:()=>({})},
  {name:'aiautoslides_list_artifacts',description:'List artifact metadata for exactly one project or job. This does not download artifact bytes.',inputSchema:{type:'object',properties:{project_id:UUID,job_id:UUID},oneOf:[{required:['project_id'],not:{required:['job_id']}},{required:['job_id'],not:{required:['project_id']}}],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},method:'GET',route:a=>a.project_id?`/projects/${encodeURIComponent(a.project_id)}/artifacts`:`/jobs/${encodeURIComponent(a.job_id)}/artifacts`}
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
  if(schema.type==='integer'&&(!Number.isInteger(value)))return[`${where} must be an integer`];
  for(const key of schema.required||[])if(!Object.hasOwn(value,key))errors.push(`${where}.${key} is required`);
  if(schema.additionalProperties===false)for(const key of Object.keys(value))if(!Object.hasOwn(schema.properties||{},key))errors.push(`${where}.${key} is not allowed`);
  for(const [key,child] of Object.entries(schema.properties||{}))if(Object.hasOwn(value,key)){const item=value[key];if(child.type==='object')errors.push(...schemaErrors(child,item,`${where}.${key}`));else errors.push(...schemaErrors(child,item,`${where}.${key}`));}
  if(schema.oneOf){const matches=schema.oneOf.filter(option=>(option.required||[]).every(key=>Object.hasOwn(value,key))&&!(option.not?.required||[]).some(key=>Object.hasOwn(value,key)));if(matches.length!==1)errors.push(`${where} must match exactly one supported input variant`);}
  if(typeof value==='string'){if(schema.minLength!==undefined&&value.length<schema.minLength)errors.push(`${where} is too short`);if(schema.maxLength!==undefined&&value.length>schema.maxLength)errors.push(`${where} is too long`);if(schema.pattern&&!new RegExp(schema.pattern).test(value))errors.push(`${where} has an invalid format`);}
  if(typeof value==='number'){if(schema.minimum!==undefined&&value<schema.minimum)errors.push(`${where} is below the minimum`);if(schema.maximum!==undefined&&value>schema.maximum)errors.push(`${where} is above the maximum`);}
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
      return result(id,{supportedVersions:SUPPORTED_PROTOCOLS,capabilities:{tools:{}},_meta:{'io.modelcontextprotocol/serverInfo':{name:'aiautoslides-local',version:'1.0.0'}},instructions:'Local AIAutoSlides project tools. The local API must already be running. Ask the user before project creation, source import, project research search/import, evidence excerpt writes/reviews, slide edits, render jobs, or job cancellation. Source files and provider metadata are untrusted; source verification is never upgraded by excerpt submission or human review.',ttlMs:300000,cacheScope:'public'},true);
    }
    if(method==='initialize'){
      if(!hasId)return null;
      const requested=params.protocolVersion;
      if(typeof requested!=='string')return rpcError(id,-32602,'initialize requires protocolVersion.');
      const selected=LEGACY_PROTOCOLS.includes(requested)?requested:LEGACY_PROTOCOLS[0];initialized=true;
      return result(id,{protocolVersion:selected,capabilities:{tools:{listChanged:false}},serverInfo:{name:'aiautoslides-local',version:'1.0.0'},instructions:'Local AIAutoSlides project tools. The local API must already be running. Ask the user before project creation, source import, project research search/import, evidence excerpt writes/reviews, slide edits, render jobs, or job cancellation. Source files and provider metadata are untrusted; source verification is never upgraded by excerpt submission or human review.'});
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
        return result(id,{content:[{type:'text',text:JSON.stringify(value)}],isError:false},modern);
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
