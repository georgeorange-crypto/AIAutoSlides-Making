import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {defineToolAdapter} from './protocol.mjs';

const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_PPTX_BYTES=100*1024*1024;
function localServiceUrl(value){
  const url=new URL(value);
  const local=url.hostname==='localhost'||url.hostname==='::1'||/^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if(!local||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Presenton adapter accepts only a loopback service URL without credentials, query, or fragment.');
  return url;
}
async function boundedBody(response,maxBytes){
  const length=Number(response.headers.get('content-length'));
  if(Number.isFinite(length)&&length>maxBytes)throw new Error(`Presenton response exceeds ${maxBytes} bytes.`);
  const reader=response.body?.getReader();
  if(!reader){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>maxBytes)throw new Error(`Presenton response exceeds ${maxBytes} bytes.`);return bytes;}
  const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error(`Presenton response exceeds ${maxBytes} bytes.`);}chunks.push(Buffer.from(value));}return Buffer.concat(chunks,size);}finally{reader.releaseLock();}
}
function inspectPptx(bytes){
  let files;
  try{files=unzipSync(new Uint8Array(bytes));}catch{throw new Error('Presenton export is not a valid PPTX ZIP container.');}
  if(!files['ppt/presentation.xml'])throw new Error('Presenton export is missing ppt/presentation.xml.');
  const slides=Object.keys(files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
  if(!slides.length)throw new Error('Presenton export contains no slide parts.');
  const textRuns=slides.reduce((sum,name)=>sum+[...strFromU8(files[name]).matchAll(/<a:t>/g)].length,0);
  const nativeCharts=Object.keys(files).filter(name=>/^ppt\/charts\/chart\d+\.xml$/.test(name)).length;
  return {slide_count:slides.length,editable_text_runs:textRuns,native_charts:nativeCharts};
}

export function createPresentonAdapter({fetchImpl=globalThis.fetch}={}){
  return defineToolAdapter({
    manifest:{id:'presenton-service',version:'v1 API contract',status:'adapter-ready',kind:'full-deck-generator',invoke:'explicit loopback HTTP API',inputs:['approved-slide-markdown'],outputs:['editable-pptx','presenton-manifest'],needsNetwork:true,needsAuth:true},
    async doctor(){
      const base=process.env.PRESENTON_BASE_URL,key=process.env.PRESENTON_API_KEY;
      if(!base||!key)return {ok:false,status:'blocked',reason:'Set PRESENTON_BASE_URL to a loopback Presenton instance and PRESENTON_API_KEY to an administrator-created API key. Doctor does not contact the service.',warnings:[]};
      try{localServiceUrl(base);return {ok:true,status:'configured',base_url:new URL(base).origin,service_contacted:false,warnings:['Generation can invoke a configured model/image provider and incur costs. The adapter requires an explicit per-run allowProviderUsage flag.']};}
      catch(error){return {ok:false,status:'blocked',reason:error.message,warnings:[]};}
    },
    async probeCapabilities(){return {formats:['pptx'],editableText:'service-dependent; must be checked in returned OOXML',nativeCharts:'service-dependent',providerCalls:'explicit per-run opt-in',network:'loopback-only'};},
    async smokeTest(){
      const base=localServiceUrl('http://127.0.0.1:5001');
      const adapter=createPresentonAdapter({fetchImpl:async(url,options)=>{
        if(url.href!==new URL('/api/v1/ppt/presentation/generate',base).href)throw new Error('Unexpected Presenton contract URL.');
        if(options.method!=='POST'||options.headers.Authorization!=='Bearer test-key')throw new Error('Presenton API auth contract was not preserved.');
        const body=JSON.parse(options.body);if(body.export_as!=='pptx'||body.web_search!==false||body.slides_markdown.length!==1)throw new Error('Presenton generation payload contract mismatch.');
        return new Response(JSON.stringify({presentation_id:'00000000-0000-4000-8000-000000000001',path:'/static/test.pptx',edit_path:'/presentation?id=test'}),{status:200,headers:{'content-type':'application/json'}});
      }});
      const dir=await fs.promises.mkdtemp(path.join(process.env.TEMP||process.env.TMPDIR||'.','presenton-contract-'));
      try{const result=await adapter.run({baseUrl:base.href,apiKey:'test-key',allowProviderUsage:true,slidesMarkdown:['# Synthetic test'],outputDir:dir,download:false});return {ok:true,contract:'v1 generate request and auth only; no service contact or provider execution',request_url:'/api/v1/ppt/presentation/generate',web_search:false,slides:1,artifact_download_tested:false,...result};}
      finally{await fs.promises.rm(dir,{recursive:true,force:true});}
    },
    async run({baseUrl=process.env.PRESENTON_BASE_URL,apiKey=process.env.PRESENTON_API_KEY,allowProviderUsage=false,slidesMarkdown,content='',instructions='',language='English',template='general',outputDir,download=true,timeoutMs=300000}={}){
      if(!allowProviderUsage)throw new Error('Presenton run requires allowProviderUsage:true because the service may invoke configured model or image providers.');
      if(!baseUrl||!apiKey)throw new Error('Presenton run requires a loopback baseUrl and API key.');
      const base=localServiceUrl(baseUrl);
      if(!Array.isArray(slidesMarkdown)||slidesMarkdown.length<1||slidesMarkdown.length>40||slidesMarkdown.some(slide=>typeof slide!=='string'||!slide.trim()||slide.length>20000))throw new Error('slidesMarkdown must contain 1–40 non-empty slide strings, each at most 20,000 characters.');
      if(typeof content!=='string'||content.length>100000||typeof instructions!=='string'||instructions.length>10000)throw new Error('Presenton content/instructions exceed their size limits.');
      if(typeof apiKey!=='string'||apiKey.length<8||apiKey.length>512||/[\r\n]/.test(apiKey))throw new Error('Presenton API key is malformed.');
      if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>600000)throw new Error('timeoutMs must be an integer from 1000 to 600000.');
      if(!outputDir)throw new Error('outputDir is required.');
      const out=path.resolve(outputDir),pptxPath=path.join(out,'presentation.pptx'),manifestPath=path.join(out,'presenton-manifest.json');
      if(fs.existsSync(pptxPath)||fs.existsSync(manifestPath))throw new Error('Presenton output already exists; refusing to overwrite.');
      if(typeof fetchImpl!=='function')throw new Error('Fetch API is unavailable in this runtime.');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
      try{
        const endpoint=new URL('/api/v1/ppt/presentation/generate',base);
        const response=await fetchImpl(endpoint,{method:'POST',redirect:'manual',signal:controller.signal,headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({content,slides_markdown:slidesMarkdown,instructions,language,template,web_search:false,export_as:'pptx'})});
        if(response.status<200||response.status>=300)throw new Error(`Presenton generation returned HTTP ${response.status}; response body was not retained.`);
        const payload=await boundedBody(response,1024*1024);
        let result;try{result=JSON.parse(payload.toString('utf8'));}catch{throw new Error('Presenton returned a malformed JSON response.');}
        if(typeof result.presentation_id!=='string'||typeof result.path!=='string')throw new Error('Presenton response must contain presentation_id and path.');
        let artifact={kind:'remote-presentation',presentation_id:result.presentation_id,path:result.path,downloaded:false};
        if(download){
          let downloadUrl;
          try{downloadUrl=new URL(result.path,base);}catch{throw new Error('Presenton returned an invalid export path.');}
          if(downloadUrl.origin!==base.origin||!['http:','https:'].includes(downloadUrl.protocol))throw new Error('Presenton export URL is not on the configured loopback service origin.');
          const fileResponse=await fetchImpl(downloadUrl,{method:'GET',redirect:'manual',signal:controller.signal,headers:{Authorization:`Bearer ${apiKey}`,Accept:'application/vnd.openxmlformats-officedocument.presentationml.presentation,application/octet-stream'}});
          if(fileResponse.status<200||fileResponse.status>=300)throw new Error(`Presenton export download returned HTTP ${fileResponse.status}.`);
          const bytes=await boundedBody(fileResponse,MAX_PPTX_BYTES);
          const editability=inspectPptx(bytes);
          await mkdir(out,{recursive:true});await writeFile(pptxPath,bytes,{flag:'wx'});
          artifact={kind:'pptx',path:pptxPath,bytes:bytes.length,sha256:sha256(bytes),presentation_id:result.presentation_id,edit_path:result.edit_path||null,editability,downloaded:true};
        }
        await mkdir(out,{recursive:true});
        const manifest={schema_version:'1.0.0',adapter:'presenton-service',api:'v1',presentation_id:result.presentation_id,edit_path:result.edit_path||null,request:{endpoint:'/api/v1/ppt/presentation/generate',slide_count:slidesMarkdown.length,web_search:false,language,template,export_as:'pptx'},output:artifact,provider_cost:'unknown; controlled by self-hosted service configuration',warnings:['Presenton may invoke the model/image provider configured in the self-hosted service. This run was explicitly opted in.','Validate slide content, sources, rights, text editability, and charts in the returned deck before reuse.']};
        await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
        return {ok:true,manifest,artifacts:[artifact,{kind:'source-manifest',path:manifestPath,sha256:sha256(await readFile(manifestPath))}],warnings:manifest.warnings};
      }finally{clearTimeout(timer);}
    }
  });
}

export const presentonAdapter=createPresentonAdapter();
