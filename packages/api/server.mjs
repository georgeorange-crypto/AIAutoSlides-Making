import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {openProjectStore} from './store.mjs';
import {runPresentationWorkflow} from '../workflow/index.mjs';
import {pptxgenjsIRAdapter,mapPresentationIRToLegacy} from '../adapters/pptxgenjs-ir.mjs';
import {planPresentationIntelligence} from '../workflow/intelligence.mjs';
import {critiqueDeck} from '../../src/critic.mjs';
import {metadataSearch} from '../research/metadata-search.mjs';
import {ingestArxivPaper} from '../research/arxiv-ingest.mjs';

const loopback=new Set(['127.0.0.1','::1','localhost']);
const mime={'pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','pdf':'application/pdf','png':'image/png','json':'application/json','svg':'image/svg+xml'};
const jsonBytes=value=>Buffer.from(JSON.stringify(value));
const contentHash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function send(res,status,value){const body=JSON.stringify(value);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'});res.end(body);}
async function bodyJson(req,limit=24*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error(`Request exceeds ${limit} byte limit.`),{status:413});chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Request body must be valid JSON.'),{status:400});}}
const notFound=(kind,id)=>Object.assign(new Error(`${kind} '${id}' was not found.`),{status:404});
function arxivIdFromCandidate(source){
  if(source?.research_candidate?.provider!=='arxiv'||typeof source.research_candidate.landing_url!=='string')return null;
  try{const url=new URL(source.research_candidate.landing_url),match=url.hostname==='arxiv.org'&&url.protocol==='https:'&&url.pathname.match(/^\/abs\/([^/]+)$/);if(!match)return null;const id=decodeURIComponent(match[1]);return /^(?:\d{4}\.\d{4,5}|[a-z-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i.test(id)?id:null;}catch{return null;}
}

export async function createLocalApi({workspaceDir,adapter=pptxgenjsIRAdapter,preview=true,research=metadataSearch,arxivIngest=ingestArxivPaper}={}){
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
        if(job.workflow==='research-topic'){
          const request=job.options.research;store.event(jobId,'scholarly-metadata-search','running',{provider:request.provider,query:request.query});
          const result=await research.search({...request,timeoutMs:request.timeout_ms,signal:controller.signal});
          if(controller.signal.aborted){store.setJob(jobId,{status:'cancelled'});store.event(jobId,'job','cancelled',{reason:'cancel accepted after provider request'});return;}
          const ingestion=store.addResearchCandidates(job.project_id,result),payload={project_id:job.project_id,provider:result.provider,query:result.query,retrieved_at:result.retrieved_at,results:result.results,ingestion};
          store.setJob(jobId,{status:'completed',result:payload});store.event(jobId,'scholarly-metadata-search','completed',{candidate_count:result.results.length,added_count:ingestion.added_count});store.event(jobId,'job','completed',{candidate_count:result.results.length,added_count:ingestion.added_count});return;
        }
        if(job.workflow==='arxiv-paper-ingest'){
          const sourceId=job.options.source_id,candidate=project.presentationIR.source_ir.sources.find(source=>source.source_id===sourceId),arxivId=arxivIdFromCandidate(candidate);if(!arxivId)throw Object.assign(new Error(`Source '${sourceId}' is not a valid selected arXiv candidate.`),{status:400});
          const outputDir=path.join(store.root,'runs',jobId,'arxiv'),ingestion=await arxivIngest({results:{provider:'arxiv',results:[{source_id:sourceId,arxiv_id:arxivId,title:candidate.research_candidate.title,landing_url:candidate.research_candidate.landing_url}]},sourceId,outDir:outputDir,signal:controller.signal,onStage:(stage,status,detail)=>store.event(jobId,`arxiv-${stage}`,status,detail)});
          if(controller.signal.aborted){store.setJob(jobId,{status:'cancelled'});store.event(jobId,'job','cancelled',{reason:'cancel accepted after PDF extraction'});return;}
          const attached=store.attachArxivPaper(job.project_id,sourceId,ingestion),artifacts=['source.pdf','extracted.md','source.manifest.json','evidence.json'].map(name=>{const file=path.join(ingestion.directory,name);return{path:file,format:path.extname(name).slice(1)||'text',sha256:contentHash(file),metadata:{kind:'arxiv-paper-ingest',source_id:sourceId,verification_status:name==='source.pdf'?'unverified':'pending_human_review'}};});
          store.addArtifacts(job,artifacts);const savedArtifacts=store.listArtifacts({jobId});store.setJob(jobId,{status:'completed',result:{project_id:job.project_id,source_id:sourceId,manifest:ingestion.manifest,ingestion:attached,artifacts:savedArtifacts,scientific_verification:'pending_human_review',reuse_rights:'needs_review'}});store.event(jobId,'job','completed',{page_count:ingestion.manifest.page_count,evidence_count:attached.evidence_count,artifact_count:savedArtifacts.length});return;
        }
        const outputDir=path.join(store.root,'runs',jobId);
        const result=await runPresentationWorkflow({jobId,project,presentationIR:project.presentationIR,workspace:store.root,outputDir,preview:job.options.preview??preview,signal:controller.signal,adapter,onEvent:(stage,status,detail)=>store.event(jobId,stage,status,detail)});
        if(controller.signal.aborted){store.setJob(jobId,{status:'cancelled'});store.event(jobId,'job','cancelled',{reason:'cancel accepted at stage boundary'});return;}
        store.addArtifacts(job,result.artifacts);store.setJob(jobId,{status:'completed',result:{...result,artifacts:store.listArtifacts({jobId})}});store.event(jobId,'job','completed',{artifact_count:result.artifacts.length,adapter:result.adapter});
      }catch(error){const cancelled=error.name==='AbortError'||controller.signal.aborted,workflow=store.getJob(jobId)?.workflow;if(workflow==='research-topic')store.event(jobId,'scholarly-metadata-search',cancelled?'cancelled':'failed',{message:error.message});if(workflow==='arxiv-paper-ingest')store.event(jobId,'arxiv-paper-ingest',cancelled?'cancelled':'failed',{message:error.message});store.setJob(jobId,{status:cancelled?'cancelled':'failed',error:cancelled?null:error.message});store.event(jobId,'job',cancelled?'cancelled':'failed',{message:error.message});}
      finally{controllers.delete(jobId);running.delete(jobId);}
    })();running.set(jobId,task);return task;
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const remote=req.socket.remoteAddress?.replace(/^::ffff:/,'');if(!loopback.has(remote)&&!remote?.startsWith('127.'))return send(res,403,{error:'loopback_only'});
      const url=new URL(req.url,'http://127.0.0.1'),segments=url.pathname.split('/').filter(Boolean).map(decodeURIComponent),method=req.method;
      if(method==='GET'&&segments[0]==='health')return send(res,200,{ok:true,service:'aiautoslides-local-api',network:'loopback-only'});
      if(segments[0]==='profiles'&&segments.length===1&&method==='GET')return send(res,200,{profiles:store.listProfiles()});
      if(segments[0]==='profiles'&&segments.length===1&&method==='POST'){const input=await bodyJson(req),profile=store.createProfile({profile_id:input.profile_id,preferences:input.preferences,privacy:input.privacy});return send(res,201,{profile});}
      if(segments[0]==='profiles'&&segments[1]&&segments.length===2&&method==='GET'){const profile=store.getProfile(segments[1]);if(!profile)throw notFound('Profile',segments[1]);return send(res,200,{profile});}
      if(segments[0]==='profiles'&&segments[1]&&segments.length===2&&method==='PATCH'){const input=await bodyJson(req),profile=store.updateProfile(segments[1],input);return send(res,200,{profile});}
      if(segments[0]==='projects'&&segments.length===1&&method==='GET')return send(res,200,{projects:store.listProjects()});
      if(segments[0]==='projects'&&segments.length===1&&method==='POST'){
        const input=await bodyJson(req);const project=store.createProject({title:input.title,presentationIR:input.presentation_ir,profileId:input.profile_id||null});return send(res,201,{project});
      }
      if(segments[0]==='projects'&&segments[1]){
        const projectId=segments[1],project=store.getProject(projectId);if(!project)throw notFound('Project',projectId);
        if(segments.length===2&&method==='GET')return send(res,200,{project});
        if(segments[2]==='research'&&segments[3]==='topic'&&segments.length===4&&method==='POST'){
          const input=await bodyJson(req);if(input.allow_network!==true)throw Object.assign(new Error('External scholarly search is disabled unless allow_network is true.'),{status:403});
          const result=await research.search({provider:input.provider,query:input.query,limit:input.limit,timeoutMs:input.timeout_ms}),ingestion=store.addResearchCandidates(projectId,result);
          return send(res,201,{...ingestion,result,notice:'Metadata candidates were attached to this project as unverified sources. No full text was downloaded, no evidence excerpt was created, and no claim was verified.'});
        }
        if(segments[2]==='research'&&segments[3]==='jobs'&&segments.length===4&&method==='POST'){
          const input=await bodyJson(req);if(input.allow_network!==true)throw Object.assign(new Error('External scholarly search is disabled unless allow_network is true.'),{status:403});
          if(!['openalex','crossref','arxiv'].includes(input.provider)||typeof input.query!=='string'||input.query.trim().length<2||input.query.length>500||input.limit!==undefined&&(!Number.isInteger(input.limit)||input.limit<1||input.limit>10)||input.timeout_ms!==undefined&&(!Number.isInteger(input.timeout_ms)||input.timeout_ms<500||input.timeout_ms>30000))throw Object.assign(new Error('provider, query, limit or timeout_ms is invalid.'),{status:400});
          const job=store.createJob(projectId,{research:{provider:input.provider,query:input.query.trim(),limit:input.limit,timeout_ms:input.timeout_ms}},'research-topic');setImmediate(()=>void runJob(job.job_id));return send(res,202,{job,notice:'Durable scholarly metadata search queued. Results remain unverified candidates.'});
        }
        if(segments[2]==='research'&&segments[3]==='papers'&&segments.length===4&&method==='POST'){
          const input=await bodyJson(req);if(input.allow_download!==true)throw Object.assign(new Error('Selected-paper download requires allow_download: true.'),{status:403});
          if(typeof input.source_id!=='string'||!project.presentationIR.source_ir.sources.some(source=>source.source_id===input.source_id))throw Object.assign(new Error('source_id must select an existing project source candidate.'),{status:400});
          const candidate=project.presentationIR.source_ir.sources.find(source=>source.source_id===input.source_id);if(!arxivIdFromCandidate(candidate))throw Object.assign(new Error('Only a selected arXiv metadata candidate with a valid arXiv landing page can be downloaded.'),{status:400});
          const job=store.createJob(projectId,{source_id:input.source_id},'arxiv-paper-ingest');setImmediate(()=>void runJob(job.job_id));return send(res,202,{job,notice:'One explicitly selected arXiv PDF will be downloaded and parsed locally; excerpts remain pending human review and reuse rights remain unreviewed.'});
        }
        if(segments.length===3&&segments[2]==='plan'&&method==='GET')return send(res,200,{project_id:projectId,plan:planPresentationIntelligence(project.presentationIR)});
        if(segments.length===3&&segments[2]==='critique'&&method==='GET'){const mapped=mapPresentationIRToLegacy(project.presentationIR);return send(res,200,{project_id:projectId,critique:critiqueDeck(mapped.deck,mapped.evidence),content_plan:planPresentationIntelligence(project.presentationIR)});}
        if(segments[2]==='slides'&&segments.length===3&&method==='GET')return send(res,200,{slides:store.getSlides(projectId)});
        if(segments[2]==='slides'&&segments.length===4&&method==='GET'){const slide=store.getSlides(projectId).find(item=>item.slide_id===segments[3]);if(!slide)throw notFound('Slide',segments[3]);return send(res,200,slide);}
        if(segments[2]==='slides'&&segments.length===4&&method==='PATCH'){
          const patch=await bodyJson(req),edited=await adapter.edit({presentationIR:project.presentationIR,slideId:segments[3],patch}),saved=store.savePresentationIR(projectId,edited.presentationIR);return send(res,200,{...saved,slide:edited.presentationIR.slides.find(slide=>slide.slide_id===segments[3]),render_required:true,edit_scope:edited.scope,limitations:edited.limitations});
        }
        if(segments[2]==='sources'&&segments.length===3&&method==='POST'){
          const input=await bodyJson(req);const source=store.importSource(projectId,{sourceId:input.source_id,filePath:input.file_path,type:input.type,locator:input.locator,verificationStatus:input.verification_status||'unverified'});return send(res,201,{source});
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
    }catch(error){return send(res,error.status||(error instanceof TypeError?400:/Unknown (project|profile|slide|source|job)|Unknown slide_id/.test(error.message)?404:/outside|incoming|symlink|travers/i.test(error.message)?403:/required|Unsupported|must be|must remain|valid Presentation|validation failed|Unknown slide_id/.test(error.message)?400:500),{error:error.message});}
  });
  async function listen({port=8787,host='127.0.0.1'}={}){if(!loopback.has(host))throw new Error('The API only binds to loopback addresses.');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});for(const job of store.listQueuedJobs())setImmediate(()=>void runJob(job.job_id));return server.address();}
  async function waitForIdle(){while(running.size)await Promise.allSettled([...running.values()]);}
  async function close(){for(const controller of controllers.values())controller.abort();await waitForIdle();if(server.listening)await new Promise(resolve=>server.close(resolve));store.close();}
  return{server,store,listen,close,waitForIdle};
}
