import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {assertValidPresentationIR} from '../core/validate-presentation.mjs';
import {patchPresentationSlide} from '../core/patch-slide.mjs';

const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value);
function within(root,candidate){const rel=path.relative(root,candidate);return rel===''||(!rel.startsWith(`..${path.sep}`)&&rel!=='..'&&!path.isAbsolute(rel));}
function parse(row){return row?JSON.parse(row):null;}

export async function openProjectStore(workspaceDir){
  const root=path.resolve(workspaceDir);
  await Promise.all(['','db','source-blobs','runs','incoming'].map(part=>mkdir(path.join(root,part),{recursive:true})));
  let DatabaseSync;
  try{({DatabaseSync}=await import('node:sqlite'));}
  catch{throw new Error('The local REST API requires Node.js 22.5+ with node:sqlite; the legacy CLI still supports its separately declared runtime.');}
  const db=new DatabaseSync(path.join(root,'db','aiautoslides.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS projects(project_id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,ir_path TEXT NOT NULL,ir_sha256 TEXT NOT NULL,owner_user_id TEXT NOT NULL DEFAULT 'local');
    CREATE TABLE IF NOT EXISTS sources(project_id TEXT NOT NULL,source_id TEXT NOT NULL,type TEXT NOT NULL,uri TEXT,sha256 TEXT,locator TEXT,verification_status TEXT NOT NULL,original_name TEXT,blob_path TEXT,PRIMARY KEY(project_id,source_id),FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS slides(project_id TEXT NOT NULL,slide_id TEXT NOT NULL,ordinal INTEGER NOT NULL,slide_json TEXT NOT NULL,PRIMARY KEY(project_id,slide_id),FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS jobs(job_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,workflow TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,options_json TEXT NOT NULL,events_json TEXT NOT NULL,result_json TEXT,error TEXT,cancel_requested INTEGER NOT NULL DEFAULT 0,input_ir_path TEXT,input_ir_sha256 TEXT,FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS jobs_project_created ON jobs(project_id,created_at);
    CREATE TABLE IF NOT EXISTS job_events(event_id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT NOT NULL,stage TEXT NOT NULL,status TEXT NOT NULL,at TEXT NOT NULL,detail_json TEXT NOT NULL,FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS artifacts(artifact_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,job_id TEXT NOT NULL,path TEXT NOT NULL,format TEXT NOT NULL,sha256 TEXT NOT NULL,created_at TEXT NOT NULL,metadata_json TEXT NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE);`);

  // Additive migration: existing single-user projects remain owned by the local principal.
  const projectColumns=new Set(db.prepare('PRAGMA table_info(projects)').all().map(column=>column.name));
  if(!projectColumns.has('owner_user_id'))db.exec("ALTER TABLE projects ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'local'");
  const jobColumns=new Set(db.prepare('PRAGMA table_info(jobs)').all().map(column=>column.name));
  if(!jobColumns.has('input_ir_path'))db.exec('ALTER TABLE jobs ADD COLUMN input_ir_path TEXT');
  if(!jobColumns.has('input_ir_sha256'))db.exec('ALTER TABLE jobs ADD COLUMN input_ir_sha256 TEXT');
  db.exec(`UPDATE jobs SET input_ir_path=(SELECT ir_path FROM projects WHERE projects.project_id=jobs.project_id),
    input_ir_sha256=(SELECT ir_sha256 FROM projects WHERE projects.project_id=jobs.project_id)
    WHERE input_ir_path IS NULL OR input_ir_sha256 IS NULL`);

  function userBlobDir(userId){
    if(userId==='local')return path.join(root,'source-blobs');
    const key=sha256(Buffer.from(userId)),dir=path.join(root,'source-blobs','users',key);
    fs.mkdirSync(dir,{recursive:true});return dir;
  }
  function userAssetDir(userId){const key=sha256(Buffer.from(userId)),dir=path.join(root,'asset-blobs','users',key);fs.mkdirSync(dir,{recursive:true});return dir;}
  function persistIR(ir,ownerUserId='local'){
    assertValidPresentationIR(ir);
    const bytes=Buffer.from(`${JSON.stringify(ir,null,2)}\n`),hash=sha256(bytes),blob=path.join(userBlobDir(ownerUserId),hash);
    if(fs.existsSync(blob)){if(sha256(fs.readFileSync(blob))!==hash)throw new Error('Content-addressed IR blob failed hash verification.');}
    else fs.writeFileSync(blob,bytes,{flag:'wx'});
    return{path:blob,sha256:hash};
  }
  function replaceSlides(projectId,slides){
    db.prepare('DELETE FROM slides WHERE project_id=?').run(projectId);
    const insert=db.prepare('INSERT INTO slides(project_id,slide_id,ordinal,slide_json) VALUES(?,?,?,?)');
    slides.forEach((slide,index)=>insert.run(projectId,slide.slide_id,index,JSON.stringify(slide)));
  }
  function replaceSources(projectId,ir){
    const insert=db.prepare(`INSERT INTO sources(project_id,source_id,type,uri,sha256,locator,verification_status,original_name,blob_path) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(project_id,source_id) DO UPDATE SET type=excluded.type,uri=excluded.uri,sha256=excluded.sha256,locator=excluded.locator,verification_status=excluded.verification_status`);
    for(const source of ir.source_ir.sources)insert.run(projectId,source.source_id,source.type,source.uri||null,source.sha256||null,source.locator||null,source.verification_status,null,null);
  }
  function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}

  function createProject({title,presentationIR,ownerUserId='local'}){
    if(typeof title!=='string'||!title.trim())throw new TypeError('title is required');
    if(typeof ownerUserId!=='string'||!ownerUserId.trim())throw new TypeError('ownerUserId is required');
    assertValidPresentationIR(presentationIR);
    const projectId=id(),created=now(),blob=persistIR(presentationIR,ownerUserId.trim());
    transaction(()=>{db.prepare('INSERT INTO projects(project_id,title,created_at,updated_at,ir_path,ir_sha256,owner_user_id) VALUES(?,?,?,?,?,?,?)').run(projectId,title.trim(),created,created,blob.path,blob.sha256,ownerUserId.trim());replaceSources(projectId,presentationIR);replaceSlides(projectId,presentationIR.slides);});
    return getProject(projectId);
  }
  function getProject(projectId){
    const row=db.prepare('SELECT * FROM projects WHERE project_id=?').get(projectId);if(!row)return null;
    const presentationIR=JSON.parse(fs.readFileSync(row.ir_path,'utf8'));
    const sources=db.prepare('SELECT source_id,type,uri,sha256,locator,verification_status,original_name FROM sources WHERE project_id=? ORDER BY source_id').all(projectId);
    return{project_id:row.project_id,title:row.title,created_at:row.created_at,updated_at:row.updated_at,ir_sha256:row.ir_sha256,presentationIR,sources};
  }
  function getProjectForUser(projectId,userId){const row=db.prepare('SELECT 1 FROM projects WHERE project_id=? AND owner_user_id=?').get(projectId,userId);return row?getProject(projectId):null;}
  function listProjects(userId='local'){return db.prepare('SELECT project_id,title,created_at,updated_at,ir_sha256 FROM projects WHERE owner_user_id=? ORDER BY created_at DESC').all(userId);}
  function savePresentationIR(projectId,updated){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    const owner=db.prepare('SELECT owner_user_id FROM projects WHERE project_id=?').get(projectId)?.owner_user_id||'local';
    assertValidPresentationIR(updated);const blob=persistIR(updated,owner),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,blob.path,blob.sha256,projectId);replaceSlides(projectId,updated.slides);});
    return{project_id:projectId,ir_sha256:blob.sha256};
  }
  function updateSlide(projectId,slideId,patch){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    const updated=patchPresentationSlide(project.presentationIR,slideId,patch),saved=savePresentationIR(projectId,updated);
    return{...saved,slide:updated.slides.find(slide=>slide.slide_id===slideId),render_required:true};
  }
  function persistSourceBytes(projectId,{sourceId,bytes,originalName='source.bin',type='file',locator=null,verificationStatus='unverified'}){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    if(typeof sourceId!=='string'||!sourceId.trim())throw new TypeError('source_id is required');
    if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
    const owner=db.prepare('SELECT owner_user_id FROM projects WHERE project_id=?').get(projectId)?.owner_user_id||'local';
    const hash=sha256(bytes),blob=path.join(userBlobDir(owner),hash);originalName=path.basename(String(originalName).replaceAll('\\','/'))||'source.bin';
    if(!fs.existsSync(blob))fs.writeFileSync(blob,bytes,{flag:'wx'});
    else if(sha256(fs.readFileSync(blob))!==hash)throw new Error('Content-addressed source blob failed hash verification.');
    const existing=project.presentationIR.source_ir.sources.find(item=>item.source_id===sourceId);
    if(existing?.sha256&&existing.sha256!==hash)throw new Error(`Source '${sourceId}' already points to different immutable bytes.`);
    const source={...(existing||{}),source_id:sourceId,type:type||existing?.type||'file',uri:`local-sha256:${hash}`,sha256:hash,locator:locator??existing?.locator??null,verification_status:existing?.verification_status||verificationStatus,claims:existing?.claims||[],assets:existing?.assets||[]};
    const sources=existing?project.presentationIR.source_ir.sources.map(item=>item.source_id===sourceId?source:item):[...project.presentationIR.source_ir.sources,source];
    const updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,sources}};
    assertValidPresentationIR(updated);
    const irBlob=persistIR(updated,owner),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,irBlob.path,irBlob.sha256,projectId);replaceSources(projectId,updated);replaceSlides(projectId,updated.slides);db.prepare('UPDATE sources SET original_name=?,blob_path=? WHERE project_id=? AND source_id=?').run(originalName,blob,projectId,sourceId);});
    return{...source,original_name:originalName,blob_sha256:hash,bytes:bytes.length};
  }
  function importSource(projectId,{sourceId,filePath,type='file',locator=null,verificationStatus='unverified'}){
    const absolute=path.resolve(filePath),incoming=path.join(root,'incoming'),realIncoming=fs.realpathSync(incoming),realFile=fs.realpathSync(absolute);
    if(!within(realIncoming,realFile)||!fs.statSync(realFile).isFile())throw new Error('Source file must be an existing regular file inside the API workspace incoming/ directory.');
    return persistSourceBytes(projectId,{sourceId,bytes:fs.readFileSync(realFile),originalName:path.basename(realFile),type,locator,verificationStatus});
  }
  function importSourceBytes(projectId,{sourceId,bytes,originalName,type='file',locator=null,verificationStatus='unverified'}){
    return persistSourceBytes(projectId,{sourceId,bytes,originalName,type,locator,verificationStatus});
  }
  function importAssetBytes(projectId,{assetId,sourceId,bytes,originalName,mediaType,license,rightsStatus='pending'}){
    const extensions={'image/png':'.png','image/jpeg':'.jpg','image/svg+xml':'.svg'};
    if(!extensions[mediaType])throw new TypeError('mediaType must be image/png, image/jpeg, or image/svg+xml');
    if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);
    if(!bytes.length||bytes.length>24*1024*1024)throw new TypeError('Asset bytes must be between 1 byte and 24 MiB');
    const valid=mediaType==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mediaType==='image/jpeg'?bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:/<svg\b/i.test(bytes.toString('utf8'))&&!/<\s*(script|foreignObject)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|data:|file:|\/\/)|url\(\s*["']?(?!#)/i.test(bytes.toString('utf8'));
    if(!valid)throw new TypeError('Asset bytes do not match a safe supported image type');
    if(typeof license!=='string'||!license.trim())throw new TypeError('license is required; use "unknown" when not established');
    if(!['approved','pending','restricted','unknown'].includes(rightsStatus))throw new TypeError('Invalid rightsStatus');
    const original=String(originalName||`${assetId}${extensions[mediaType]}`).replaceAll('\\','/').split('/').at(-1).replace(/[\r\n\0]/g,' ').slice(0,240)||'asset';
    const source=persistSourceBytes(projectId,{sourceId,bytes,originalName:original,type:'image'});
    const project=getProject(projectId),owner=db.prepare('SELECT owner_user_id FROM projects WHERE project_id=?').get(projectId)?.owner_user_id||'local',hash=sha256(bytes),assetDir=userAssetDir(owner),assetPath=path.join(assetDir,`${hash}${extensions[mediaType]}`);
    if(!fs.existsSync(assetPath))fs.writeFileSync(assetPath,bytes,{flag:'wx'});else if(sha256(fs.readFileSync(assetPath))!==hash)throw new Error('Content-addressed asset failed hash verification.');
    const uri=path.relative(root,assetPath),existing=(project.presentationIR.assets||[]).find(asset=>asset.asset_id===assetId);
    if(existing&&existing.sha256!==hash)throw new Error(`Asset '${assetId}' already points to different immutable bytes.`);
    const asset={...(existing||{}),asset_id:assetId,uri,sha256:hash,media_type:mediaType,source_id:sourceId,license:license.trim(),rights_status:rightsStatus};
    const assets=existing?project.presentationIR.assets.map(item=>item.asset_id===assetId?asset:item):[...(project.presentationIR.assets||[]),asset];
    const updated={...project.presentationIR,assets};assertValidPresentationIR(updated);savePresentationIR(projectId,updated);
    return{asset,source,original_name:original,bytes:bytes.length};
  }
  function createJob(projectId,options={},ownerUserId='local'){
    const project=db.prepare('SELECT ir_path,ir_sha256 FROM projects WHERE project_id=? AND owner_user_id=?').get(projectId,ownerUserId);
    if(!project)throw new Error(`Unknown project '${projectId}'`);
    const jobId=id(),at=now(),events=[];
    db.prepare('INSERT INTO jobs(job_id,project_id,workflow,status,created_at,updated_at,options_json,events_json,input_ir_path,input_ir_sha256) VALUES(?,?,?,?,?,?,?,?,?,?)').run(jobId,projectId,'presentation', 'queued',at,at,json(options),json(events),project.ir_path,project.ir_sha256);
    return getJob(jobId);
  }
  function getProjectSnapshotForJob(jobId){const row=db.prepare('SELECT j.project_id,j.input_ir_path,j.input_ir_sha256,p.title,p.created_at,p.updated_at FROM jobs j JOIN projects p USING(project_id) WHERE j.job_id=?').get(jobId);if(!row||!row.input_ir_path||!fs.existsSync(row.input_ir_path))return null;const bytes=fs.readFileSync(row.input_ir_path);if(sha256(bytes)!==row.input_ir_sha256)throw new Error(`Job ${jobId} input snapshot hash check failed.`);const presentationIR=JSON.parse(bytes.toString('utf8'));return{project_id:row.project_id,title:row.title,created_at:row.created_at,updated_at:row.updated_at,ir_sha256:row.input_ir_sha256,presentationIR,sources:presentationIR.source_ir.sources};}
  function getJob(jobId){const row=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);return row?{job_id:row.job_id,project_id:row.project_id,workflow:row.workflow,status:row.status,created_at:row.created_at,updated_at:row.updated_at,input_ir_sha256:row.input_ir_sha256,options:parse(row.options_json),events:parse(row.events_json),result:parse(row.result_json),error:row.error,cancel_requested:Boolean(row.cancel_requested)}:null;}
  function getJobForUser(jobId,userId){const row=db.prepare('SELECT 1 FROM jobs j JOIN projects p USING(project_id) WHERE j.job_id=? AND p.owner_user_id=?').get(jobId,userId);return row?getJob(jobId):null;}
  function listJobs(projectId=null,ownerUserId='local'){const rows=projectId?db.prepare('SELECT j.job_id FROM jobs j JOIN projects p USING(project_id) WHERE j.project_id=? AND p.owner_user_id=? ORDER BY j.created_at DESC').all(projectId,ownerUserId):db.prepare('SELECT j.job_id FROM jobs j JOIN projects p USING(project_id) WHERE p.owner_user_id=? ORDER BY j.created_at DESC').all(ownerUserId);return rows.map(row=>getJob(row.job_id));}
  function event(jobId,stage,status,detail={}){
    const at=now(),entry={stage,status,at,detail};
    db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT events_json FROM jobs WHERE job_id=?').get(jobId);if(!row)throw new Error(`Unknown job '${jobId}'`);const events=parse(row.events_json);events.push(entry);db.prepare('UPDATE jobs SET updated_at=?,events_json=? WHERE job_id=?').run(at,json(events),jobId);db.prepare('INSERT INTO job_events(job_id,stage,status,at,detail_json) VALUES(?,?,?,?,?)').run(jobId,stage,status,at,json(detail));db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  }
  function setJob(jobId,{status,result,error}){db.prepare('UPDATE jobs SET status=?,updated_at=?,result_json=?,error=? WHERE job_id=?').run(status,now(),result===undefined?null:json(result),error||null,jobId);}
  function requestCancel(jobId){const job=getJob(jobId);if(!job)return null;if(!['queued','running'].includes(job.status))return job;db.prepare('UPDATE jobs SET cancel_requested=1,updated_at=? WHERE job_id=?').run(now(),jobId);return getJob(jobId);}
  function listQueuedJobs(){return db.prepare("SELECT j.job_id,p.owner_user_id FROM jobs j JOIN projects p USING(project_id) WHERE j.status='queued' ORDER BY j.created_at").all().map(row=>({...getJob(row.job_id),owner_user_id:row.owner_user_id}));}
  function recoverInterruptedJobs(){const rows=db.prepare("SELECT job_id FROM jobs WHERE status='running'").all();for(const row of rows){setJob(row.job_id,{status:'failed',error:'API process restarted while the job was running; the interrupted job was not resumed automatically.'});event(row.job_id,'recovery','failed',{reason:'process restart'});}return rows.length;}
  function addArtifacts(job,artifacts){
    const insert=db.prepare('INSERT INTO artifacts(artifact_id,project_id,job_id,path,format,sha256,created_at,metadata_json) VALUES(?,?,?,?,?,?,?,?)');
    for(const item of artifacts){const artifactPath=path.resolve(item.path);if(!within(root,artifactPath)||!fs.existsSync(artifactPath)||!fs.statSync(artifactPath).isFile())throw new Error('Workflow artifact is missing or outside the workspace.');const bytes=fs.readFileSync(artifactPath),hash=sha256(bytes);if(item.sha256&&item.sha256!==hash)throw new Error(`Artifact hash mismatch: ${path.basename(artifactPath)}`);insert.run(id(),job.project_id,job.job_id,artifactPath,item.format||path.extname(artifactPath).slice(1),hash,now(),json(item));}
  }
  function listArtifacts({projectId=null,jobId=null}={}){let rows;if(jobId)rows=db.prepare('SELECT * FROM artifacts WHERE job_id=? ORDER BY created_at').all(jobId);else if(projectId)rows=db.prepare('SELECT * FROM artifacts WHERE project_id=? ORDER BY created_at').all(projectId);else rows=db.prepare('SELECT * FROM artifacts ORDER BY created_at DESC').all();return rows.map(row=>({artifact_id:row.artifact_id,project_id:row.project_id,job_id:row.job_id,path:row.path,format:row.format,sha256:row.sha256,created_at:row.created_at,metadata:parse(row.metadata_json)}));}
  function getArtifact(artifactId){const row=db.prepare('SELECT * FROM artifacts WHERE artifact_id=?').get(artifactId);return row?{artifact_id:row.artifact_id,project_id:row.project_id,job_id:row.job_id,path:row.path,format:row.format,sha256:row.sha256,created_at:row.created_at,metadata:parse(row.metadata_json)}:null;}
  function getArtifactForUser(artifactId,userId){const row=db.prepare('SELECT 1 FROM artifacts a JOIN projects p USING(project_id) WHERE a.artifact_id=? AND p.owner_user_id=?').get(artifactId,userId);return row?getArtifact(artifactId):null;}
  function getSlides(projectId){return db.prepare('SELECT slide_id,ordinal,slide_json FROM slides WHERE project_id=? ORDER BY ordinal').all(projectId).map(row=>({slide_id:row.slide_id,ordinal:row.ordinal,slide:parse(row.slide_json)}));}
  function close(){db.close();}
  return{root,db,createProject,getProject,getProjectForUser,getProjectSnapshotForJob,listProjects,savePresentationIR,updateSlide,importSource,importSourceBytes,importAssetBytes,createJob,getJob,getJobForUser,listJobs,event,setJob,requestCancel,listQueuedJobs,recoverInterruptedJobs,addArtifacts,listArtifacts,getArtifact,getArtifactForUser,getSlides,close};
}
