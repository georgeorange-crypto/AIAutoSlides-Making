import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {openProjectStore} from './store.mjs';
import {runPresentationWorkflow} from '../workflow/index.mjs';
import {pptxgenjsIRAdapter} from '../adapters/pptxgenjs-ir.mjs';

const loopback=new Set(['127.0.0.1','::1','localhost']);
const mime={'pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','pdf':'application/pdf','png':'image/png','json':'application/json','svg':'image/svg+xml'};
const jsonBytes=value=>Buffer.from(JSON.stringify(value));
const contentHash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const within=(base,candidate)=>{const rel=path.relative(base,candidate);return rel===''||(!rel.startsWith(`..${path.sep}`)&&rel!=='..'&&!path.isAbsolute(rel));};

function send(res,status,value){const body=JSON.stringify(value);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'});res.end(body);}
async function bodyJson(req,limit=24*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error(`Request exceeds ${limit} byte limit.`),{status:413});chunks.push(chunk);}if(!chunks.length)return{};try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Request body must be valid JSON.'),{status:400});}}
async function bodyBytes(req,limit=24*1024*1024){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>limit)throw Object.assign(new Error(`Upload exceeds ${limit} byte limit.`),{status:413});chunks.push(chunk);}if(!size)throw Object.assign(new Error('Upload body is empty.'),{status:400});return Buffer.concat(chunks);}
const notFound=(kind,id)=>Object.assign(new Error(`${kind} '${id}' was not found.`),{status:404});
function assertOwnerAssets(ir,userId,workspace){
  const ids=new Set((ir.slides||[]).flatMap(slide=>(slide.elements||[]).filter(element=>element.kind==='image').map(element=>element.asset_id))),assets=Array.isArray(ir.assets)?ir.assets:[],ownerHash=crypto.createHash('sha256').update(userId).digest('hex'),assetRoot=path.resolve(workspace,'asset-blobs','users',ownerHash),realWorkspace=fs.realpathSync(workspace);
  for(const asset of assets){
    if(!asset.uri){if(ids.has(asset.asset_id))throw Object.assign(new Error(`Image asset '${asset.asset_id}' must be uploaded before it can be used.`),{status:400});continue;}
    if(/^(?:file|https?):|^data:/i.test(asset.uri))throw Object.assign(new Error(`Asset '${asset.asset_id}' must use a user-scoped local upload.`),{status:403});
    const candidate=path.resolve(workspace,asset.uri);if(!within(assetRoot,candidate))throw Object.assign(new Error(`Asset '${asset.asset_id}' is outside the authenticated user's asset namespace.`),{status:403});
    if(!fs.existsSync(candidate)||!fs.statSync(candidate).isFile())throw Object.assign(new Error(`Asset '${asset.asset_id}' file is missing; upload it before rendering.`),{status:400});
    const resolved=fs.realpathSync(candidate);if(!within(assetRoot,resolved)||!within(realWorkspace,resolved))throw Object.assign(new Error(`Asset '${asset.asset_id}' resolves outside the authenticated user's asset namespace.`),{status:403});
  }
}

export async function createLocalApi({workspaceDir,adapter=pptxgenjsIRAdapter,preview=true,maxConcurrentJobs=2,maxConcurrentJobsPerUser=2,authenticate=null}={}){
  if(!workspaceDir)throw new TypeError('workspaceDir is required');
  if(!Number.isInteger(maxConcurrentJobs)||maxConcurrentJobs<1)throw new TypeError('maxConcurrentJobs must be a positive integer');
  if(!Number.isInteger(maxConcurrentJobsPerUser)||maxConcurrentJobsPerUser<1)throw new TypeError('maxConcurrentJobsPerUser must be a positive integer');
  if(authenticate!==null&&typeof authenticate!=='function')throw new TypeError('authenticate must be a function when supplied');
  const store=await openProjectStore(workspaceDir),controllers=new Map(),running=new Map(),runningOwners=new Map();
  store.recoverInterruptedJobs();let pumpScheduled=false,shuttingDown=false,lastScheduledOwner=null;
  async function runJob(jobId,ownerUserId){
    if(running.has(jobId))return running.get(jobId);
    runningOwners.set(jobId,ownerUserId);
    const task=(async()=>{
      const controller=new AbortController();controllers.set(jobId,controller);
      try{
        let job=store.getJob(jobId);if(!job)return;
        if(job.cancel_requested){store.setJob(jobId,{status:'cancelled'});store.event(jobId,'job','cancelled',{reason:'cancel requested before worker start'});return;}
        const project=store.getProjectSnapshotForJob(jobId);if(!project)throw notFound('Job input snapshot',jobId);
        store.setJob(jobId,{status:'running'});store.event(jobId,'job','running',{workflow:job.workflow});
        const outputDir=path.join(store.root,'runs',jobId);
        const result=await runPresentationWorkflow({jobId,project,presentationIR:project.presentationIR,workspace:store.root,outputDir,preview:job.options.preview??preview,signal:controller.signal,adapter,onEvent:(stage,status,detail)=>store.event(jobId,stage,status,detail)});
        if(controller.signal.aborted){store.setJob(jobId,{status:'cancelled'});store.event(jobId,'job','cancelled',{reason:'cancel accepted at stage boundary'});return;}
        store.addArtifacts(job,result.artifacts);store.setJob(jobId,{status:'completed',result:{...result,artifacts:store.listArtifacts({jobId})}});store.event(jobId,'job','completed',{artifact_count:result.artifacts.length,adapter:result.adapter});
      }catch(error){const cancelled=error.name==='AbortError'||controller.signal.aborted;store.setJob(jobId,{status:cancelled?'cancelled':'failed',error:cancelled?null:error.message});store.event(jobId,'job',cancelled?'cancelled':'failed',{message:error.message});}
      finally{controllers.delete(jobId);running.delete(jobId);runningOwners.delete(jobId);scheduleJobs();}
    })();running.set(jobId,task);return task;
  }
  function scheduleJobs(){
    if(shuttingDown||pumpScheduled)return;
    pumpScheduled=true;
    setImmediate(()=>{
      pumpScheduled=false;
      while(!shuttingDown&&running.size<maxConcurrentJobs){
        const eligible=store.listQueuedJobs().filter(job=>!running.has(job.job_id)&&[...runningOwners.values()].filter(owner=>owner===job.owner_user_id).length<maxConcurrentJobsPerUser);
        const next=eligible.find(job=>job.owner_user_id!==lastScheduledOwner)||eligible[0];
        if(!next)break;
        lastScheduledOwner=next.owner_user_id;void runJob(next.job_id,next.owner_user_id);
      }
    });
  }
  const server=http.createServer(async(req,res)=>{
    try{
      const remote=req.socket.remoteAddress?.replace(/^::ffff:/,'');if(!loopback.has(remote)&&!remote?.startsWith('127.'))return send(res,403,{error:'loopback_only'});
      const url=new URL(req.url,'http://127.0.0.1'),segments=url.pathname.split('/').filter(Boolean).map(decodeURIComponent),method=req.method;
      if(method==='GET'&&segments[0]==='health')return send(res,200,{ok:true,service:'aiautoslides-local-api',network:'loopback-only'});
      let principal={user_id:'local'};
      if(authenticate){try{principal=await authenticate(req);}catch{return send(res,401,{error:'unauthorized'});}if(!principal||typeof principal.user_id!=='string'||!principal.user_id.trim()||principal.user_id==='local')return send(res,401,{error:'unauthorized'});}
      const userId=principal.user_id;
      if(segments[0]==='projects'&&segments.length===1&&method==='GET')return send(res,200,{projects:store.listProjects(userId)});
      if(segments[0]==='projects'&&segments.length===1&&method==='POST'){
        const input=await bodyJson(req);if(authenticate)assertOwnerAssets(input.presentation_ir,userId,store.root);const project=store.createProject({title:input.title,presentationIR:input.presentation_ir,ownerUserId:userId});return send(res,201,{project});
      }
      if(segments[0]==='projects'&&segments[1]){
        const projectId=segments[1],project=store.getProjectForUser(projectId,userId);if(!project)throw notFound('Project',projectId);
        if(segments.length===2&&method==='GET')return send(res,200,{project});
        if(segments[2]==='slides'&&segments.length===3&&method==='GET')return send(res,200,{slides:store.getSlides(projectId)});
        if(segments[2]==='slides'&&segments.length===4&&method==='GET'){const slide=store.getSlides(projectId).find(item=>item.slide_id===segments[3]);if(!slide)throw notFound('Slide',segments[3]);return send(res,200,slide);}
        if(segments[2]==='slides'&&segments.length===4&&method==='PATCH'){
          const patch=await bodyJson(req),edited=await adapter.edit({presentationIR:project.presentationIR,slideId:segments[3],patch});if(authenticate)assertOwnerAssets(edited.presentationIR,userId,store.root);const saved=store.savePresentationIR(projectId,edited.presentationIR);return send(res,200,{...saved,slide:edited.presentationIR.slides.find(slide=>slide.slide_id===segments[3]),render_required:true,edit_scope:edited.scope,limitations:edited.limitations});
        }
        if(segments[2]==='assets'&&segments.length===4&&method==='POST'){
          const bytes=await bodyBytes(req),filename=String(req.headers['x-filename']||`${segments[3]}`).replace(/[\r\n\0]/g,' ').slice(0,240),asset=store.importAssetBytes(projectId,{assetId:segments[3],sourceId:String(req.headers['x-source-id']||''),bytes,originalName:filename,mediaType:String(req.headers['x-media-type']||''),license:String(req.headers['x-license']||''),rightsStatus:String(req.headers['x-rights-status']||'pending')});return send(res,201,{asset});
        }
        if(segments[2]==='sources'&&segments.length===3&&method==='POST'){
          if(authenticate)return send(res,400,{error:'path_based_source_import_disabled_for_authenticated_mode',use:`POST /projects/${projectId}/source-files/{source_id}`});
          const input=await bodyJson(req);const source=store.importSource(projectId,{sourceId:input.source_id,filePath:input.file_path,type:input.type,locator:input.locator,verificationStatus:input.verification_status||'unverified'});return send(res,201,{source});
        }
        if(segments[2]==='source-files'&&segments.length===4&&method==='POST'){
          const bytes=await bodyBytes(req),filename=String(req.headers['x-filename']||`${segments[3]}.bin`).replace(/[\r\n\0]/g,' ').slice(0,240),source=store.importSourceBytes(projectId,{sourceId:segments[3],bytes,originalName:filename,type:String(req.headers['x-source-type']||'file').slice(0,100),locator:req.headers['x-source-locator']?String(req.headers['x-source-locator']).slice(0,1000):null});return send(res,201,{source});
        }
        if(segments[2]==='jobs'&&segments.length===3&&method==='GET')return send(res,200,{jobs:store.listJobs(projectId,userId)});
        if(segments[2]==='jobs'&&segments.length===3&&method==='POST'){
          const options=await bodyJson(req);if(options.preview!==undefined&&typeof options.preview!=='boolean')throw Object.assign(new Error('preview must be boolean.'),{status:400});const job=store.createJob(projectId,options,userId);scheduleJobs();return send(res,202,{job});
        }
        if(segments[2]==='artifacts'&&segments.length===3&&method==='GET')return send(res,200,{artifacts:store.listArtifacts({projectId})});
      }
      if(segments[0]==='jobs'&&segments[1]){
        const jobId=segments[1],job=store.getJobForUser(jobId,userId);if(!job)throw notFound('Job',jobId);
        if(segments.length===2&&method==='GET')return send(res,200,{job});
        if(segments[2]==='cancel'&&segments.length===3&&method==='POST'){
          const updated=store.requestCancel(jobId);controllers.get(jobId)?.abort();if(updated.status==='queued')scheduleJobs();return send(res,202,{job:updated,cancellation:'accepted_at_stage_boundary'});
        }
        if(segments[2]==='artifacts'&&segments.length===3&&method==='GET')return send(res,200,{artifacts:store.listArtifacts({jobId})});
      }
      if(segments[0]==='artifacts'&&segments[1]&&segments.length===2&&method==='GET'){
        const artifact=store.getArtifactForUser(segments[1],userId);if(!artifact)throw notFound('Artifact',segments[1]);const bytes=fs.readFileSync(artifact.path);if(contentHash(artifact.path)!==artifact.sha256)throw new Error('Artifact hash check failed.');res.writeHead(200,{'content-type':mime[artifact.format]||'application/octet-stream','content-length':bytes.length,'content-disposition':`attachment; filename="${path.basename(artifact.path).replace(/["\r\n]/g,'_')}"`,'x-content-sha256':artifact.sha256,'cache-control':'no-store'});return res.end(bytes);
      }
      return send(res,404,{error:'route_not_found'});
    }catch(error){return send(res,error.status||(/Unknown (project|slide|source|job)|Unknown slide_id/.test(error.message)?404:/outside|incoming|symlink|travers/i.test(error.message)?403:/required|Unsupported|must be|valid Presentation|validation failed|Unknown slide_id/.test(error.message)?400:500),{error:error.message});}
  });
  async function listen({port=8787,host='127.0.0.1'}={}){if(!loopback.has(host))throw new Error('The API only binds to loopback addresses.');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});scheduleJobs();return server.address();}
  async function waitForIdle(){while(running.size)await Promise.allSettled([...running.values()]);}
  async function close(){shuttingDown=true;for(const controller of controllers.values())controller.abort();await waitForIdle();if(server.listening)await new Promise(resolve=>server.close(resolve));store.close();}
  return{server,store,listen,close,waitForIdle};
}
