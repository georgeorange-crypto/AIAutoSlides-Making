import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {extractDocxParagraphs,extractPdfPages} from '../../src/document-extractors.mjs';
import {mkdir} from 'node:fs/promises';
import {assertValidPresentationIR} from '../core/validate-presentation.mjs';
import {patchPresentationSlide} from '../core/patch-slide.mjs';

const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const evidenceContentHash=evidence=>sha256(Buffer.from(JSON.stringify({evidence_id:evidence.evidence_id,source_id:evidence.source_id,excerpt:evidence.excerpt,locator:evidence.locator??null})));
const exactMatchTextExtensions=new Set(['.txt','.md','.markdown','.csv','.json','.yaml','.yml','.xml','.html','.htm','.log']);
function invalidateStaleEvidenceReviews(previousIR,updatedIR){
  const previous=new Map((previousIR.source_ir.evidence||[]).map(evidence=>[evidence.evidence_id,evidence]));
  const evidence=(updatedIR.source_ir.evidence||[]).map(current=>{
    const prior=previous.get(current.evidence_id);if(!prior)return current;
    const priorReviewedHash=prior.reviewed_content_sha256||(['verified','contradicted'].includes(prior.verification_status)?evidenceContentHash(prior):null);
    if(!priorReviewedHash||evidenceContentHash(current)===priorReviewedHash)return current;
    return{...current,verification_status:'pending',review_stale:true,stale_review_decision:prior.stale_review_decision||prior.verification_status};
  });
  return{...updatedIR,source_ir:{...updatedIR.source_ir,evidence}};
}
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
    CREATE TABLE IF NOT EXISTS research_candidates(project_id TEXT NOT NULL,source_id TEXT NOT NULL,payload_json TEXT NOT NULL,created_at TEXT NOT NULL,imported_at TEXT,PRIMARY KEY(project_id,source_id),FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE);
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
    const safeUpdated=invalidateStaleEvidenceReviews(project.presentationIR,updated);
    assertValidPresentationIR(safeUpdated);const blob=persistIR(safeUpdated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,blob.path,blob.sha256,projectId);replaceSlides(projectId,safeUpdated.slides);});
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
  function saveResearchCandidates(projectId,result){
    if(!getProject(projectId))throw new Error(`Unknown project '${projectId}'`);
    if(!result||!['openalex','crossref','arxiv'].includes(result.provider)||!Array.isArray(result.results)||result.results.length>10)throw new TypeError('Invalid bounded scholarly metadata search result.');
    const serialized=JSON.stringify(result);if(Buffer.byteLength(serialized)>2*1024*1024)throw new Error('Research candidate batch exceeds 2 MiB.');
    const insert=db.prepare('INSERT INTO research_candidates(project_id,source_id,payload_json,created_at,imported_at) VALUES(?,?,?,?,NULL) ON CONFLICT(project_id,source_id) DO NOTHING');
    const prefix={openalex:'OPENALEX',crossref:'CROSSREF',arxiv:'ARXIV'}[result.provider];
    transaction(()=>{for(const candidate of result.results){if(candidate?.provider!==result.provider||candidate?.verification_status!=='unverified'||candidate?.evidence_status!=='metadata_candidate_only'||!new RegExp(`^SRC_${prefix}_[A-F0-9]{16}$`).test(candidate?.source_id||''))throw new TypeError('Search results must be unverified metadata candidates from the selected provider.');insert.run(projectId,candidate.source_id,JSON.stringify(candidate),now());}});
    return listResearchCandidates(projectId);
  }
  function listResearchCandidates(projectId){
    if(!getProject(projectId))throw new Error(`Unknown project '${projectId}'`);
    return db.prepare('SELECT payload_json,created_at,imported_at FROM research_candidates WHERE project_id=? ORDER BY created_at,source_id').all(projectId).map(row=>({...parse(row.payload_json),saved_at:row.created_at,imported_at:row.imported_at,imported:Boolean(row.imported_at)}));
  }
  function importResearchCandidate(projectId,sourceId){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    const row=db.prepare('SELECT payload_json,imported_at FROM research_candidates WHERE project_id=? AND source_id=?').get(projectId,sourceId);if(!row)throw new Error(`Unknown research candidate '${sourceId}'`);
    const candidate=parse(row.payload_json),existing=project.presentationIR.source_ir.sources.find(item=>item.source_id===sourceId);if(existing){if(existing.research_candidate?.provider_record_id!==candidate.provider_record_id)throw new Error(`Source ID '${sourceId}' is already used by another project source.`);return{project_id:projectId,source:existing,ir_sha256:project.ir_sha256,imported:true,idempotent:true};}
    const landing=typeof candidate.landing_url==='string'&&candidate.landing_url.startsWith('https://')?candidate.landing_url:candidate.record_url;
    const source={source_id:sourceId,type:'scholarly-metadata-candidate',uri:landing||null,locator:null,verification_status:'unverified',claims:[],assets:[],research_candidate:{provider:candidate.provider,provider_record_id:candidate.provider_record_id,title:candidate.title,authors:candidate.authors,publication_year:candidate.publication_year,doi:candidate.doi,landing_url:candidate.landing_url,record_url:candidate.record_url,record_sha256:candidate.record_sha256,query:candidate.query,retrieved_at:candidate.retrieved_at,evidence_status:'metadata_candidate_only'}};
    const updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,sources:[...project.presentationIR.source_ir.sources,source]}},blob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,blob.path,blob.sha256,projectId);replaceSources(projectId,updated);replaceSlides(projectId,updated.slides);db.prepare('UPDATE research_candidates SET imported_at=? WHERE project_id=? AND source_id=?').run(at,projectId,sourceId);});
    return{project_id:projectId,source,ir_sha256:blob.sha256,imported:true,idempotent:false};
  }
  const extractedSourceCache=new Map();
  async function sourceExcerptMatch(projectId,sourceId,excerpt){
    const row=db.prepare('SELECT sha256,original_name,blob_path FROM sources WHERE project_id=? AND source_id=?').get(projectId,sourceId);
    if(!row)return{status:'unavailable',reason:'source_not_registered',source_sha256:null};
    if(!row.blob_path)return{status:'unavailable',reason:'source_bytes_not_imported',source_sha256:row.sha256||null};
    const blobRoot=path.join(root,'source-blobs'),blobPath=path.resolve(row.blob_path);
    if(!within(blobRoot,blobPath))throw new Error('Imported source blob escaped the content-addressed source directory.');
    const extension=path.extname(row.original_name||'').toLowerCase();
    if(!exactMatchTextExtensions.has(extension)&&!['.pdf','.docx'].includes(extension))return{status:'unavailable',reason:'unsupported_local_format',source_sha256:row.sha256||null};
    if(!fs.existsSync(blobPath))return{status:'unavailable',reason:'source_blob_missing',source_sha256:row.sha256||null};
    const stat=fs.statSync(blobPath);if(stat.size>20*1024*1024)return{status:'unavailable',reason:'source_too_large_for_exact_text_match',source_sha256:row.sha256||null};
    const bytes=fs.readFileSync(blobPath);if(sha256(bytes)!==row.sha256)throw new Error('Content-addressed source blob failed hash verification.');
    let blocks=null,text='';
    if(extension==='.pdf'||extension==='.docx'){
      try{
        let extraction=extractedSourceCache.get(row.sha256);
        if(!extraction){extraction=extension==='.pdf'?extractPdfPages(bytes):Promise.resolve(extractDocxParagraphs(bytes));extractedSourceCache.set(row.sha256,extraction);if(extractedSourceCache.size>8)extractedSourceCache.delete(extractedSourceCache.keys().next().value);}
        blocks=await extraction;
      }
      catch(error){return{status:'unavailable',reason:extension==='.pdf'?'pdf_text_extraction_failed':'docx_text_extraction_failed',source_sha256:row.sha256,detail:error.message.slice(0,240)};}
    }else try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return{status:'unavailable',reason:'source_is_not_utf8_text',source_sha256:row.sha256};}
    const segments=blocks?blocks.map(block=>({locator:block.locator,text:block.content})): [{locator:null,text}];
    const matches=[];for(const segment of segments){let offset=segment.text.indexOf(excerpt);while(offset>=0){matches.push({locator:segment.locator,character_offset:offset});offset=segment.text.indexOf(excerpt,offset+1);}}
    if(!matches.length)return{status:'no_exact_match',reason:'excerpt_not_found_verbatim',source_sha256:row.sha256,match_count:0,character_offset:null,locator:null};
    return{status:'exact_match',reason:null,source_sha256:row.sha256,match_count:matches.length,...matches[0]};
  }
  async function addEvidenceRecord(projectId,{evidenceId,sourceId,excerpt,locator=null}={}){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    if(typeof evidenceId!=='string'||evidenceId.length>128||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(evidenceId))throw Object.assign(new TypeError('evidence_id must be a stable identifier of at most 128 characters.'),{status:400});
    if(!project.presentationIR.source_ir.sources.some(source=>source.source_id===sourceId))throw new Error(`Unknown source '${sourceId}'`);
    if(typeof excerpt!=='string'||excerpt.trim().length<1||excerpt.length>10000)throw Object.assign(new TypeError('excerpt must contain 1-10000 characters.'),{status:400});
    if(locator!==null&&(typeof locator!=='string'||locator.length>1000))throw Object.assign(new TypeError('locator must be null or a string up to 1000 characters.'),{status:400});
    const previous=project.presentationIR.source_ir.evidence||[];
    if(previous.some(item=>item.evidence_id===evidenceId)||project.presentationIR.source_ir.sources.some(source=>source.source_id===evidenceId))throw Object.assign(new Error(`Evidence ID '${evidenceId}' is already in use.`),{status:409});
    const evidence={evidence_id:evidenceId,source_id:sourceId,excerpt,locator,verification_status:'pending',reviewer:null,reviewed_at:null};
    const updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,evidence:[...previous,evidence]}},blob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,blob.path,blob.sha256,projectId);replaceSlides(projectId,updated.slides);});
    return{project_id:projectId,ir_sha256:blob.sha256,evidence:{...evidence,content_sha256:evidenceContentHash(evidence),source_match:await sourceExcerptMatch(projectId,sourceId,excerpt)}};
  }
  async function listEvidence(projectId){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    return Promise.all((project.presentationIR.source_ir.evidence||[]).map(async evidence=>({...evidence,content_sha256:evidenceContentHash(evidence),source_match:await sourceExcerptMatch(projectId,evidence.source_id,evidence.excerpt)})));
  }
  async function reviewEvidence(projectId,evidenceId,{reviewer,decision,contentSha256,note=null}={}){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    const evidenceList=project.presentationIR.source_ir.evidence||[],index=evidenceList.findIndex(item=>item.evidence_id===evidenceId);if(index<0)throw new Error(`Unknown evidence '${evidenceId}'`);
    if(!['verified','contradicted'].includes(decision))throw Object.assign(new TypeError('decision must be verified or contradicted.'),{status:400});
    if(typeof reviewer!=='string'||!reviewer.trim()||reviewer.trim().length>180)throw Object.assign(new TypeError('reviewer must contain 1-180 characters.'),{status:400});
    if(note!==null&&(typeof note!=='string'||note.length>1000))throw Object.assign(new TypeError('note must be null or a string up to 1000 characters.'),{status:400});
    const current=evidenceList[index],currentHash=evidenceContentHash(current);
    if(typeof contentSha256!=='string'||!/^[a-f0-9]{64}$/.test(contentSha256)||contentSha256!==currentHash)throw Object.assign(new Error('Evidence content hash does not match the current excerpt.'),{status:409});
    if(!['pending','unverified'].includes(current.verification_status))throw Object.assign(new Error(`Evidence '${evidenceId}' already has a final review state.`),{status:409});
    const {stale_review_decision,...reviewable}=current;
    const reviewed={...reviewable,verification_status:decision,reviewer:reviewer.trim(),reviewed_at:now(),reviewed_content_sha256:currentHash,review_stale:false,...(note===null?{}:{review_note:note})};
    const next=evidenceList.map((item,itemIndex)=>itemIndex===index?reviewed:item),updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,evidence:next}},blob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,blob.path,blob.sha256,projectId);replaceSlides(projectId,updated.slides);});
    return{project_id:projectId,ir_sha256:blob.sha256,evidence:{...reviewed,content_sha256:evidenceContentHash(reviewed),source_match:await sourceExcerptMatch(projectId,reviewed.source_id,reviewed.excerpt)}};
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
  return{root,db,createProject,getProject,listProjects,savePresentationIR,updateSlide,importSource,saveResearchCandidates,listResearchCandidates,importResearchCandidate,addEvidenceRecord,listEvidence,reviewEvidence,createJob,getJob,listJobs,event,setJob,requestCancel,listQueuedJobs,recoverInterruptedJobs,addArtifacts,listArtifacts,getArtifact,getSlides,close};
}
