import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {openProjectStore} from './store.mjs';
import {runPresentationWorkflow} from '../workflow/index.mjs';
import {pptxgenjsIRAdapter} from '../adapters/pptxgenjs-ir.mjs';
import {metadataSearch as defaultMetadataSearch} from '../research/metadata-search.mjs';

const loopback=new Set(['127.0.0.1','::1','localhost']);
const mime={'pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','pdf':'application/pdf','png':'image/png','json':'application/json','svg':'image/svg+xml'};
const jsonBytes=value=>Buffer.from(JSON.stringify(value));
const contentHash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function researchSearchInput(input){
  if(input.allow_network!==true)throw Object.assign(new Error('Research search is disabled unless allow_network is explicitly true.'),{status:400});
  if(!['openalex','crossref','arxiv'].includes(input.provider))throw Object.assign(new Error('provider must be openalex, crossref, or arxiv.'),{status:400});
  if(typeof input.query!=='string'||input.query.trim().length<2||input.query.trim().length>500)throw Object.assign(new Error('query must contain 2-500 characters.'),{status:400});
  if(input.limit!==undefined&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>10))throw Object.assign(new Error('limit must be an integer from 1 to 10.'),{status:400});
  return{provider:input.provider,query:input.query,limit:input.limit??5};
}

function send(res,status,value){const body=JSON.stringify(value);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'});res.end(body);}
async function bodyJson(req,limit=24*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error(`Request exceeds ${limit} byte limit.`),{status:413});chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Request body must be valid JSON.'),{status:400});}}
const notFound=(kind,id)=>Object.assign(new Error(`${kind} '${id}' was not found.`),{status:404});

export async function createLocalApi({workspaceDir,adapter=pptxgenjsIRAdapter,preview=true,researchSearch=defaultMetadataSearch}={}){
  if(!workspaceDir)throw new TypeError('workspaceDir is required');
  const store=await openProjectStore(workspaceDir),controllers=new Map(),running=new Map();
  store.recoverInterruptedJobs();
  async function runJob(jobId){
    if(running.has(jobId))return running.get(jobId);
    const task=(async()=>{
      const controller=new AbortController();controllers.set(jobId,controller);
      try{
        let job=store.getJob(jobId);if(!job)return;
        if(job.cancel_requested){store.setJob(jobId,{status:'cancelled'});store.event(jobId,'job','cancelled',{reason:'cancel requested before worker start'});return;}
        const project=store.getProject(job.project_id);if(!project)throw notFound('Project',job.project_id);
        store.setJob(jobId,{status:'running'});store.event(jobId,'job','running',{workflow:job.workflow});
        const outputDir=path.join(store.root,'runs',jobId);
        const result=await runPresentationWorkflow({jobId,project,presentationIR:project.presentationIR,workspace:store.root,outputDir,preview:job.options.preview??preview,signal:controller.signal,adapter,onEvent:(stage,status,detail)=>store.event(jobId,stage,status,detail)});
        if(controller.signal.aborted){store.setJob(jobId,{status:'cancelled'});store.event(jobId,'job','cancelled',{reason:'cancel accepted at stage boundary'});return;}
        store.addArtifacts(job,result.artifacts);store.setJob(jobId,{status:'completed',result:{...result,artifacts:store.listArtifacts({jobId})}});store.event(jobId,'job','completed',{artifact_count:result.artifacts.length,adapter:result.adapter});
      }catch(error){const cancelled=error.name==='AbortError'||controller.signal.aborted;store.setJob(jobId,{status:cancelled?'cancelled':'failed',error:cancelled?null:error.message});store.event(jobId,'job',cancelled?'cancelled':'failed',{message:error.message});}
      finally{controllers.delete(jobId);running.delete(jobId);}
    })();running.set(jobId,task);return task;
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const remote=req.socket.remoteAddress?.replace(/^::ffff:/,'');if(!loopback.has(remote)&&!remote?.startsWith('127.'))return send(res,403,{error:'loopback_only'});
      const url=new URL(req.url,'http://127.0.0.1'),segments=url.pathname.split('/').filter(Boolean).map(decodeURIComponent),method=req.method;
      if(method==='GET'&&segments[0]==='health')return send(res,200,{ok:true,service:'aiautoslides-local-api',network:'loopback-only'});
      if(segments[0]==='research'&&segments[1]==='search'&&segments.length===2&&method==='POST'){
        const input=researchSearchInput(await bodyJson(req,16*1024));
        const result=await researchSearch.search(input);return send(res,200,result);
      }
      if(segments[0]==='projects'&&segments.length===1&&method==='GET')return send(res,200,{projects:store.listProjects()});
      if(segments[0]==='projects'&&segments.length===1&&method==='POST'){
        const input=await bodyJson(req);const project=store.createProject({title:input.title,presentationIR:input.presentation_ir});return send(res,201,{project});
      }
      if(segments[0]==='projects'&&segments[1]){
        const projectId=segments[1],project=store.getProject(projectId);if(!project)throw notFound('Project',projectId);
        if(segments.length===2&&method==='GET')return send(res,200,{project});
        if(segments[2]==='slides'&&segments.length===3&&method==='GET')return send(res,200,{slides:store.getSlides(projectId)});
        if(segments[2]==='slides'&&segments.length===4&&method==='GET'){const slide=store.getSlides(projectId).find(item=>item.slide_id===segments[3]);if(!slide)throw notFound('Slide',segments[3]);return send(res,200,slide);}
        if(segments[2]==='slides'&&segments.length===4&&method==='PATCH'){
          const patch=await bodyJson(req),edited=await adapter.edit({presentationIR:project.presentationIR,slideId:segments[3],patch}),saved=store.savePresentationIR(projectId,edited.presentationIR);return send(res,200,{...saved,slide:edited.presentationIR.slides.find(slide=>slide.slide_id===segments[3]),render_required:true,edit_scope:edited.scope,limitations:edited.limitations});
        }
        if(segments[2]==='sources'&&segments.length===3&&method==='POST'){
          const input=await bodyJson(req);const source=store.importSource(projectId,{sourceId:input.source_id,filePath:input.file_path,type:input.type,locator:input.locator,verificationStatus:input.verification_status||'unverified'});return send(res,201,{source});
        }
        if(segments[2]==='research'&&segments[3]==='search'&&segments.length===4&&method==='POST'){
          const input=researchSearchInput(await bodyJson(req,16*1024)),result=await researchSearch.search(input);store.saveResearchCandidates(projectId,result);return send(res,200,{...result,saved_candidate_count:result.results.length});
        }
        if(segments[2]==='research'&&segments[3]==='candidates'&&segments.length===4&&method==='GET')return send(res,200,{candidates:store.listResearchCandidates(projectId)});
        if(segments[2]==='research'&&segments[3]==='candidates'&&segments.length===6&&segments[5]==='import'&&method==='POST'){
          const result=store.importResearchCandidate(projectId,segments[4]);return send(res,200,result);
        }
        if(segments[2]==='evidence'&&segments.length===3&&method==='GET')return send(res,200,{evidence:store.listEvidence(projectId)});
        if(segments[2]==='evidence'&&segments.length===3&&method==='POST'){
          const input=await bodyJson(req,16*1024),result=store.addEvidenceRecord(projectId,{evidenceId:input.evidence_id,sourceId:input.source_id,excerpt:input.excerpt,locator:input.locator??null});return send(res,201,result);
        }
        if(segments[2]==='evidence'&&segments.length===5&&segments[4]==='review'&&method==='POST'){
          const input=await bodyJson(req,16*1024),result=store.reviewEvidence(projectId,segments[3],{reviewer:input.reviewer,decision:input.decision,contentSha256:input.content_sha256,note:input.note??null});return send(res,200,result);
        }
        if(segments[2]==='jobs'&&segments.length===3&&method==='GET')return send(res,200,{jobs:store.listJobs(projectId)});
        if(segments[2]==='jobs'&&segments.length===3&&method==='POST'){
          const options=await bodyJson(req);if(options.preview!==undefined&&typeof options.preview!=='boolean')throw Object.assign(new Error('preview must be boolean.'),{status:400});const job=store.createJob(projectId,options);setImmediate(()=>void runJob(job.job_id));return send(res,202,{job});
        }
        if(segments[2]==='artifacts'&&segments.length===3&&method==='GET')return send(res,200,{artifacts:store.listArtifacts({projectId})});
      }
      if(segments[0]==='jobs'&&segments[1]){
        const jobId=segments[1],job=store.getJob(jobId);if(!job)throw notFound('Job',jobId);
        if(segments.length===2&&method==='GET')return send(res,200,{job});
        if(segments[2]==='cancel'&&segments.length===3&&method==='POST'){
          const updated=store.requestCancel(jobId);controllers.get(jobId)?.abort();if(updated.status==='queued')setImmediate(()=>void runJob(jobId));return send(res,202,{job:updated,cancellation:'accepted_at_stage_boundary'});
        }
        if(segments[2]==='artifacts'&&segments.length===3&&method==='GET')return send(res,200,{artifacts:store.listArtifacts({jobId})});
      }
      if(segments[0]==='artifacts'&&segments[1]&&segments.length===2&&method==='GET'){
        const artifact=store.getArtifact(segments[1]);if(!artifact)throw notFound('Artifact',segments[1]);const bytes=fs.readFileSync(artifact.path);if(contentHash(artifact.path)!==artifact.sha256)throw new Error('Artifact hash check failed.');res.writeHead(200,{'content-type':mime[artifact.format]||'application/octet-stream','content-length':bytes.length,'content-disposition':`attachment; filename="${path.basename(artifact.path).replace(/["\r\n]/g,'_')}"`,'x-content-sha256':artifact.sha256,'cache-control':'no-store'});return res.end(bytes);
      }
      return send(res,404,{error:'route_not_found'});
    }catch(error){return send(res,error.status||(/Unknown (project|slide|source|job|research candidate)|Unknown slide_id/.test(error.message)?404:/outside|incoming|symlink|travers/i.test(error.message)?403:/required|Unsupported|must be|valid Presentation|validation failed|Unknown slide_id/.test(error.message)?400:500),{error:error.message});}
  });
  async function listen({port=8787,host='127.0.0.1'}={}){if(!loopback.has(host))throw new Error('The API only binds to loopback addresses.');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});for(const job of store.listQueuedJobs())setImmediate(()=>void runJob(job.job_id));return server.address();}
  async function waitForIdle(){while(running.size)await Promise.allSettled([...running.values()]);}
  async function close(){for(const controller of controllers.values())controller.abort();await waitForIdle();if(server.listening)await new Promise(resolve=>server.close(resolve));store.close();}
  return{server,store,listen,close,waitForIdle};
}
