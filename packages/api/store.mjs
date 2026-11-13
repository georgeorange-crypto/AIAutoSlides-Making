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
    CREATE TABLE IF NOT EXISTS projects(project_id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,ir_path TEXT NOT NULL,ir_sha256 TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sources(project_id TEXT NOT NULL,source_id TEXT NOT NULL,type TEXT NOT NULL,uri TEXT,sha256 TEXT,locator TEXT,verification_status TEXT NOT NULL,original_name TEXT,blob_path TEXT,PRIMARY KEY(project_id,source_id),FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS slides(project_id TEXT NOT NULL,slide_id TEXT NOT NULL,ordinal INTEGER NOT NULL,slide_json TEXT NOT NULL,PRIMARY KEY(project_id,slide_id),FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS jobs(job_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,workflow TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,options_json TEXT NOT NULL,events_json TEXT NOT NULL,result_json TEXT,error TEXT,cancel_requested INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS jobs_project_created ON jobs(project_id,created_at);
    CREATE TABLE IF NOT EXISTS job_events(event_id INTEGER PRIMARY KEY AUTOINCREMENT,job_id TEXT NOT NULL,stage TEXT NOT NULL,status TEXT NOT NULL,at TEXT NOT NULL,detail_json TEXT NOT NULL,FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS artifacts(artifact_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,job_id TEXT NOT NULL,path TEXT NOT NULL,format TEXT NOT NULL,sha256 TEXT NOT NULL,created_at TEXT NOT NULL,metadata_json TEXT NOT NULL,FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE,FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE);`);

  function persistIR(ir){
    assertValidPresentationIR(ir);
    const bytes=Buffer.from(`${JSON.stringify(ir,null,2)}\n`),hash=sha256(bytes),blob=path.join(root,'source-blobs',hash);
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

  function createProject({title,presentationIR}){
    if(typeof title!=='string'||!title.trim())throw new TypeError('title is required');
    assertValidPresentationIR(presentationIR);
    const projectId=id(),created=now(),blob=persistIR(presentationIR);
    transaction(()=>{db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run(projectId,title.trim(),created,created,blob.path,blob.sha256);replaceSources(projectId,presentationIR);replaceSlides(projectId,presentationIR.slides);});
    return getProject(projectId);
  }
  function getProject(projectId){
    const row=db.prepare('SELECT * FROM projects WHERE project_id=?').get(projectId);if(!row)return null;
    const presentationIR=JSON.parse(fs.readFileSync(row.ir_path,'utf8'));
    const sources=db.prepare('SELECT source_id,type,uri,sha256,locator,verification_status,original_name FROM sources WHERE project_id=? ORDER BY source_id').all(projectId);
    return{project_id:row.project_id,title:row.title,created_at:row.created_at,updated_at:row.updated_at,ir_sha256:row.ir_sha256,presentationIR,sources};
  }
  function listProjects(){return db.prepare('SELECT project_id,title,created_at,updated_at,ir_sha256 FROM projects ORDER BY created_at DESC').all();}
  function savePresentationIR(projectId,updated){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    assertValidPresentationIR(updated);const blob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,blob.path,blob.sha256,projectId);replaceSlides(projectId,updated.slides);});
    return{project_id:projectId,ir_sha256:blob.sha256};
  }
  function updateSlide(projectId,slideId,patch){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    const updated=patchPresentationSlide(project.presentationIR,slideId,patch),saved=savePresentationIR(projectId,updated);
    return{...saved,slide:updated.slides.find(slide=>slide.slide_id===slideId),render_required:true};
  }
  function importSource(projectId,{sourceId,filePath,type='file',locator=null,verificationStatus='unverified'}){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    if(typeof sourceId!=='string'||!sourceId.trim())throw new TypeError('source_id is required');
    const absolute=path.resolve(filePath),incoming=path.join(root,'incoming'),realIncoming=fs.realpathSync(incoming),realFile=fs.realpathSync(absolute);
    if(!within(realIncoming,realFile)||!fs.statSync(realFile).isFile())throw new Error('Source file must be an existing regular file inside the API workspace incoming/ directory.');
    const bytes=fs.readFileSync(realFile),hash=sha256(bytes),blob=path.join(root,'source-blobs',hash),originalName=path.basename(realFile);
    if(!fs.existsSync(blob))fs.writeFileSync(blob,bytes,{flag:'wx'});
    else if(sha256(fs.readFileSync(blob))!==hash)throw new Error('Content-addressed source blob failed hash verification.');
    const existing=project.presentationIR.source_ir.sources.find(item=>item.source_id===sourceId);
    if(existing?.sha256&&existing.sha256!==hash)throw new Error(`Source '${sourceId}' already points to different immutable bytes.`);
    const source={...(existing||{}),source_id:sourceId,type:type||existing?.type||'file',uri:`local-sha256:${hash}`,sha256:hash,locator:locator??existing?.locator??null,verification_status:existing?.verification_status||verificationStatus,claims:existing?.claims||[],assets:existing?.assets||[]};
    const sources=existing?project.presentationIR.source_ir.sources.map(item=>item.source_id===sourceId?source:item):[...project.presentationIR.source_ir.sources,source];
    const updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,sources}};
    assertValidPresentationIR(updated);
    const irBlob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,irBlob.path,irBlob.sha256,projectId);replaceSources(projectId,updated);replaceSlides(projectId,updated.slides);db.prepare('UPDATE sources SET original_name=?,blob_path=? WHERE project_id=? AND source_id=?').run(originalName,blob,projectId,sourceId);});
    return{...source,original_name:originalName,blob_sha256:hash,bytes:bytes.length};
  }
  function createJob(projectId,options={}){
    if(!db.prepare('SELECT 1 FROM projects WHERE project_id=?').get(projectId))throw new Error(`Unknown project '${projectId}'`);
    const jobId=id(),at=now(),events=[];
    db.prepare('INSERT INTO jobs(job_id,project_id,workflow,status,created_at,updated_at,options_json,events_json) VALUES(?,?,?,?,?,?,?,?)').run(jobId,projectId,'presentation', 'queued',at,at,json(options),json(events));
    return getJob(jobId);
  }
  function getJob(jobId){const row=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);return row?{job_id:row.job_id,project_id:row.project_id,workflow:row.workflow,status:row.status,created_at:row.created_at,updated_at:row.updated_at,options:parse(row.options_json),events:parse(row.events_json),result:parse(row.result_json),error:row.error,cancel_requested:Boolean(row.cancel_requested)}:null;}
  function listJobs(projectId=null){const rows=projectId?db.prepare('SELECT job_id FROM jobs WHERE project_id=? ORDER BY created_at DESC').all(projectId):db.prepare('SELECT job_id FROM jobs ORDER BY created_at DESC').all();return rows.map(row=>getJob(row.job_id));}
  function event(jobId,stage,status,detail={}){
    const at=now(),entry={stage,status,at,detail};
    db.exec('BEGIN IMMEDIATE');try{const row=db.prepare('SELECT events_json FROM jobs WHERE job_id=?').get(jobId);if(!row)throw new Error(`Unknown job '${jobId}'`);const events=parse(row.events_json);events.push(entry);db.prepare('UPDATE jobs SET updated_at=?,events_json=? WHERE job_id=?').run(at,json(events),jobId);db.prepare('INSERT INTO job_events(job_id,stage,status,at,detail_json) VALUES(?,?,?,?,?)').run(jobId,stage,status,at,json(detail));db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
  }
  function setJob(jobId,{status,result,error}){db.prepare('UPDATE jobs SET status=?,updated_at=?,result_json=?,error=? WHERE job_id=?').run(status,now(),result===undefined?null:json(result),error||null,jobId);}
  async function reviewJob(jobId,{category,decision,reviewer,note,reviewed_ids=[],artifact_sha256,page_reviews}){
    const job=getJob(jobId);if(!job)throw new Error(`Unknown job '${jobId}'`);if(job.status!=='awaiting_review')throw Object.assign(new Error(`Job '${jobId}' is not awaiting review`),{status:409});
    if(!['science','visual'].includes(category))throw new TypeError('category must be science or visual');if(!['approve','changes_requested'].includes(decision))throw new TypeError('decision must be approve or changes_requested');
    if(typeof reviewer!=='string'||!reviewer.trim()||typeof note!=='string'||!note.trim())throw new TypeError('reviewer and note are required');
    const context=job.result?.review_context,required=context?.required?.[category];if(!Array.isArray(required))throw new Error(`The ${category} review gate is unavailable for this job.`);
    if(artifact_sha256!==context.deck_sha256)throw Object.assign(new Error('Review must be bound to the current PPTX SHA-256.'),{status:409});
    const deckArtifact=listArtifacts({jobId}).find(item=>item.format==='pptx');if(!deckArtifact||sha256(fs.readFileSync(deckArtifact.path))!==context.deck_sha256)throw Object.assign(new Error('The current PPTX is missing or has changed since the review package was created.'),{status:409});
    if(decision==='approve'&&(!Array.isArray(reviewed_ids)||JSON.stringify([...new Set(reviewed_ids)].sort())!==JSON.stringify(required)))throw Object.assign(new Error(`Approval must attest every required ${category} item: ${required.join(', ')||'(none)'}`),{status:400});
    if(category==='visual'&&!required.length)throw Object.assign(new Error('Visual approval is unavailable because the deck was not rendered to preview pages.'),{status:409});
    if(category==='visual'&&job.options?.deck_task&&decision==='approve'){
      const {validatePageReviews}=await import('../workflow/deck-gate.mjs');
      const pageGate=validatePageReviews(page_reviews,required);
      if(pageGate.status!=='pass')throw Object.assign(new Error(`Page review rejected: ${pageGate.errors.join('; ')}`),{status:400});
    }
    const result={...job.result,reviews:{...(job.result.reviews||{}),[category]:{decision,reviewer:reviewer.trim(),note:note.trim(),reviewed_ids:decision==='approve'?[...required]:[],...(page_reviews?{page_reviews}:{}),artifact_sha256,reviewed_at:now()}}};
    const rejected=decision==='changes_requested',complete=['science','visual'].every(key=>result.reviews[key]?.decision==='approve'),status=rejected?'revision_required':complete?'completed':'awaiting_review';
    if(result.report){result.report.status=status;result.report.critique={...result.report.critique,scientific_accuracy:result.reviews.science?.decision==='approve'?'approved':'pending_human',visual_review:result.reviews.visual?.decision==='approve'?'approved':'pending_human'};}
    const reviewPath=path.join(root,'runs',jobId,`human-review-${category}.json`),reviewBytes=Buffer.from(`${JSON.stringify(result.reviews[category],null,2)}\n`);fs.mkdirSync(path.dirname(reviewPath),{recursive:true});fs.writeFileSync(reviewPath,reviewBytes);const reviewHash=sha256(reviewBytes),artifactId=id();
    db.prepare('INSERT INTO artifacts(artifact_id,project_id,job_id,path,format,sha256,created_at,metadata_json) VALUES(?,?,?,?,?,?,?,?)').run(artifactId,job.project_id,jobId,reviewPath,'json',reviewHash,now(),json({format:'json',sha256:reviewHash,review_category:category}));
    result.artifacts=[...(result.artifacts||[]),{artifact_id:artifactId,project_id:job.project_id,job_id:jobId,path:reviewPath,format:'json',sha256:reviewHash,metadata:{review_category:category}}];
    db.prepare('UPDATE jobs SET status=?,updated_at=?,result_json=?,error=? WHERE job_id=?').run(status,now(),json(result),null,jobId);
    event(jobId,`human-review-${category}`,decision==='approve'?'approved':'changes_requested',{reviewer:reviewer.trim(),note:note.trim(),reviewed_count:result.reviews[category].reviewed_ids.length,artifact_sha256});
    if(status==='completed')event(jobId,'job','completed',{reason:'scientific and visual review gates approved'});
    return getJob(jobId);
  }
  function requestCancel(jobId){const job=getJob(jobId);if(!job)return null;if(!['queued','running'].includes(job.status))return job;db.prepare('UPDATE jobs SET cancel_requested=1,updated_at=? WHERE job_id=?').run(now(),jobId);return getJob(jobId);}
  function listQueuedJobs(){return db.prepare("SELECT job_id FROM jobs WHERE status='queued' ORDER BY created_at").all().map(row=>getJob(row.job_id));}
  function recoverInterruptedJobs(){const rows=db.prepare("SELECT job_id FROM jobs WHERE status='running'").all();for(const row of rows){setJob(row.job_id,{status:'failed',error:'API process restarted while the job was running; the interrupted job was not resumed automatically.'});event(row.job_id,'recovery','failed',{reason:'process restart'});}return rows.length;}
  function addArtifacts(job,artifacts){
    const insert=db.prepare('INSERT INTO artifacts(artifact_id,project_id,job_id,path,format,sha256,created_at,metadata_json) VALUES(?,?,?,?,?,?,?,?)');
    for(const item of artifacts){const artifactPath=path.resolve(item.path);if(!within(root,artifactPath)||!fs.existsSync(artifactPath)||!fs.statSync(artifactPath).isFile())throw new Error('Workflow artifact is missing or outside the workspace.');const bytes=fs.readFileSync(artifactPath),hash=sha256(bytes);if(item.sha256&&item.sha256!==hash)throw new Error(`Artifact hash mismatch: ${path.basename(artifactPath)}`);insert.run(id(),job.project_id,job.job_id,artifactPath,item.format||path.extname(artifactPath).slice(1),hash,now(),json(item));}
  }
  function listArtifacts({projectId=null,jobId=null}={}){let rows;if(jobId)rows=db.prepare('SELECT * FROM artifacts WHERE job_id=? ORDER BY created_at').all(jobId);else if(projectId)rows=db.prepare('SELECT * FROM artifacts WHERE project_id=? ORDER BY created_at').all(projectId);else rows=db.prepare('SELECT * FROM artifacts ORDER BY created_at DESC').all();return rows.map(row=>({artifact_id:row.artifact_id,project_id:row.project_id,job_id:row.job_id,path:row.path,format:row.format,sha256:row.sha256,created_at:row.created_at,metadata:parse(row.metadata_json)}));}
  function getArtifact(artifactId){const row=db.prepare('SELECT * FROM artifacts WHERE artifact_id=?').get(artifactId);return row?{artifact_id:row.artifact_id,project_id:row.project_id,job_id:row.job_id,path:row.path,format:row.format,sha256:row.sha256,created_at:row.created_at,metadata:parse(row.metadata_json)}:null;}
  function getSlides(projectId){return db.prepare('SELECT slide_id,ordinal,slide_json FROM slides WHERE project_id=? ORDER BY ordinal').all(projectId).map(row=>({slide_id:row.slide_id,ordinal:row.ordinal,slide:parse(row.slide_json)}));}
  function close(){db.close();}
  return{root,db,createProject,getProject,listProjects,savePresentationIR,updateSlide,importSource,createJob,getJob,listJobs,event,setJob,reviewJob,requestCancel,listQueuedJobs,recoverInterruptedJobs,addArtifacts,listArtifacts,getArtifact,getSlides,close};
}
