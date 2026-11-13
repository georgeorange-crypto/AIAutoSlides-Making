import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {assertValidPresentationIR} from '../core/validate-presentation.mjs';
import {patchPresentationSlide} from '../core/patch-slide.mjs';
import {createUserProfile} from '../core/models.mjs';

const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.stringify(value);
function within(root,candidate){const rel=path.relative(root,candidate);return rel===''||(!rel.startsWith(`..${path.sep}`)&&rel!=='..'&&!path.isAbsolute(rel));}
function parse(row){return row?JSON.parse(row):null;}

export async function openProjectStore(workspaceDir){
  const root=path.resolve(workspaceDir);
  await Promise.all(['','db','source-blobs','runs','incoming','assets/commons'].map(part=>mkdir(path.join(root,part),{recursive:true})));
  let DatabaseSync;
  try{({DatabaseSync}=await import('node:sqlite'));}
  catch{throw new Error('The local REST API requires Node.js 22.5+ with node:sqlite; the legacy CLI still supports its separately declared runtime.');}
  const db=new DatabaseSync(path.join(root,'db','aiautoslides.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS projects(project_id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,ir_path TEXT NOT NULL,ir_sha256 TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS profiles(profile_id TEXT PRIMARY KEY,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,profile_json TEXT NOT NULL);
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

  function validatedProfile({profile_id,preferences={},privacy={local_only:true,allow_network:false,allow_paid_api:false}}={}){
    if(!preferences||typeof preferences!=='object'||Array.isArray(preferences))throw new TypeError('Profile preferences must be an object.');
    const allowed=new Set(['language','audience_profile','duration_seconds','theme','tone','slide_density']);
    for(const key of Object.keys(preferences))if(!allowed.has(key))throw new TypeError(`Unsupported profile preference '${key}'.`);
    if(preferences.audience_profile!==undefined&&!['general','research_group','academic_conference','investment_committee'].includes(preferences.audience_profile))throw new TypeError('Unsupported audience_profile preference.');
    if(preferences.duration_seconds!==undefined&&(!Number.isInteger(preferences.duration_seconds)||preferences.duration_seconds<60||preferences.duration_seconds>7200))throw new TypeError('duration_seconds must be an integer between 60 and 7200.');
    for(const key of ['language','theme','tone','slide_density'])if(preferences[key]!==undefined&&(typeof preferences[key]!=='string'||preferences[key].length>80))throw new TypeError(`${key} preference must be a string of at most 80 characters.`);
    if(!privacy||privacy.local_only!==true||privacy.allow_network!==false||privacy.allow_paid_api!==false)throw new TypeError('Stored profiles must remain local-only with network and paid API access disabled.');
    return createUserProfile({profile_id:profile_id||id(),preferences,privacy});
  }
  function createProfile(input={}){
    const profile=validatedProfile(input),at=now();
    db.prepare('INSERT INTO profiles(profile_id,created_at,updated_at,profile_json) VALUES(?,?,?,?)').run(profile.profile_id,at,at,json(profile));return{...profile,created_at:at,updated_at:at};
  }
  function updateProfile(profileId,input={}){const existing=getProfile(profileId);if(!existing)throw new Error(`Unknown profile '${profileId}'`);const profile=validatedProfile({profile_id:profileId,preferences:input.preferences,privacy:input.privacy??existing.privacy}),at=now();db.prepare('UPDATE profiles SET updated_at=?,profile_json=? WHERE profile_id=?').run(at,json(profile),profileId);return{...profile,created_at:existing.created_at,updated_at:at};}
  function getProfile(profileId){const row=db.prepare('SELECT profile_json,created_at,updated_at FROM profiles WHERE profile_id=?').get(profileId);return row?{...parse(row.profile_json),created_at:row.created_at,updated_at:row.updated_at}:null;}
  function listProfiles(){return db.prepare('SELECT profile_id,created_at,updated_at,profile_json FROM profiles ORDER BY created_at DESC').all().map(row=>({...parse(row.profile_json),created_at:row.created_at,updated_at:row.updated_at}));}

  function createProject({title,presentationIR,profileId=null}){
    if(typeof title!=='string'||!title.trim())throw new TypeError('title is required');
    if(profileId){const profile=getProfile(profileId);if(!profile)throw new Error(`Unknown profile '${profileId}'`);const meta={...(presentationIR.meta||{}),profile_id:profile.profile_id,profile_preferences:profile.preferences};for(const key of ['audience_profile','duration_seconds','theme'])if(meta[key]===undefined&&profile.preferences[key]!==undefined)meta[key]=profile.preferences[key];presentationIR={...presentationIR,meta};}
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
  function readSourceBlob(projectId,sourceId){
    const row=db.prepare('SELECT blob_path,sha256,original_name FROM sources WHERE project_id=? AND source_id=?').get(projectId,sourceId);if(!row)throw new Error(`Source '${sourceId}' has no imported local file.`);
    const realBlob=fs.realpathSync(row.blob_path);if(!within(path.join(root,'source-blobs'),realBlob))throw new Error('Imported source blob is outside the workspace source-blobs directory.');
    const bytes=fs.readFileSync(realBlob);if(sha256(bytes)!==row.sha256)throw new Error('Imported source blob failed SHA-256 verification.');
    return{bytes,sha256:row.sha256,filename:row.original_name,path:realBlob};
  }
  function attachDocumentEvidence(projectId,sourceId,{sourceHash,textHash,format,extractionMethod,evidenceEntries}){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    if(!Array.isArray(evidenceEntries)||!evidenceEntries.length)throw new TypeError('Document extraction requires page or paragraph evidence entries.');
    const source=project.presentationIR.source_ir.sources.find(item=>item.source_id===sourceId);if(!source||source.sha256!==sourceHash)throw new Error('Extracted document lineage does not match the imported source hash.');
    const prior=project.presentationIR.source_ir.evidence||[],byId=new Map(prior.map(item=>[item.evidence_id,item])),added=[];
    for(const entry of evidenceEntries){
      if(!entry||typeof entry.evidence_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(entry.evidence_id)||entry.source_id!==sourceId||typeof entry.excerpt!=='string'||!entry.excerpt.trim()||typeof entry.locator!=='string')throw new TypeError('Document evidence entry has invalid lineage, ID, excerpt or locator.');
      const existing=byId.get(entry.evidence_id);if(existing){if(existing.source_id!==entry.source_id||existing.excerpt!==entry.excerpt||existing.locator!==entry.locator)throw new Error(`Evidence '${entry.evidence_id}' already exists with different content.`);continue;}
      byId.set(entry.evidence_id,entry);added.push(entry);
    }
    const updatedSource={...source,document_extraction:{source_sha256:sourceHash,extracted_text_sha256:textHash,format,extraction_method:extractionMethod,block_count:evidenceEntries.length,verification_status:'pending_human_review'}},sources=project.presentationIR.source_ir.sources.map(item=>item.source_id===sourceId?updatedSource:item),updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,sources,evidence:[...prior,...added]}},blob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,blob.path,blob.sha256,projectId);replaceSources(projectId,updated);replaceSlides(projectId,updated.slides);});
    return{project_id:projectId,source_id:sourceId,source_sha256:sourceHash,extracted_text_sha256:textHash,evidence_ids:added.map(item=>item.evidence_id),evidence_count:added.length,added:added.length>0,ir_sha256:blob.sha256};
  }
  function attachCrawledPage(projectId,sourceId,crawl){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    if(typeof sourceId!=='string'||!/^SRC_[A-Z0-9_]{1,90}$/.test(sourceId)||!crawl?.manifest||crawl.manifest.provider!=='crawl4ai'||typeof crawl.markdown!=='string'||!Array.isArray(crawl.evidenceEntries))throw new TypeError('Crawled-page result or source ID is invalid.');
    const bytes=Buffer.from(crawl.markdown,'utf8'),sourceHash=sha256(bytes);if(sourceHash!==crawl.sourceHash||sourceHash!==crawl.manifest.markdown_sha256)throw new Error('Crawled Markdown hash does not match its manifest.');
    const blob=path.join(root,'source-blobs',sourceHash);if(fs.existsSync(blob)){if(sha256(fs.readFileSync(blob))!==sourceHash)throw new Error('Content-addressed web source failed hash verification.');}else fs.writeFileSync(blob,bytes,{flag:'wx'});
    const currentSources=project.presentationIR.source_ir.sources,existing=currentSources.find(source=>source.source_id===sourceId);if(existing){if(existing.sha256===sourceHash&&existing.crawl_page?.markdown_sha256===sourceHash)return{project_id:projectId,source_id:sourceId,source_sha256:sourceHash,evidence_ids:crawl.evidenceEntries.map(item=>item.evidence_id),evidence_count:0,added:false,ir_sha256:project.ir_sha256};throw new Error(`Source '${sourceId}' already exists with different bytes or type.`);}
    const prior=project.presentationIR.source_ir.evidence||[],byId=new Map(prior.map(item=>[item.evidence_id,item])),added=[];
    for(const entry of crawl.evidenceEntries){if(!entry||typeof entry.evidence_id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(entry.evidence_id)||typeof entry.excerpt!=='string'||!entry.excerpt.trim()||typeof entry.locator!=='string')throw new TypeError('Crawled web evidence entry is invalid.');const evidence={evidence_id:entry.evidence_id,source_id:sourceId,excerpt:entry.excerpt,locator:entry.locator,verification_status:'pending',source_sha256:sourceHash,review_status:'pending_human_review'},old=byId.get(entry.evidence_id);if(old){if(old.source_id!==sourceId||old.excerpt!==evidence.excerpt||old.locator!==evidence.locator)throw new Error(`Evidence '${entry.evidence_id}' already exists with different content.`);continue;}byId.set(entry.evidence_id,evidence);added.push(evidence);}
    const source={source_id:sourceId,type:'web_page',uri:crawl.manifest.final_url,sha256:sourceHash,locator:crawl.manifest.title||crawl.manifest.final_url,verification_status:'unverified',claims:[],assets:[],crawl_page:{provider:'crawl4ai',requested_url:crawl.manifest.requested_url,final_url:crawl.manifest.final_url,title:crawl.manifest.title,retrieved_at:crawl.manifest.retrieved_at,robots_checked:crawl.manifest.robots_checked,markdown_sha256:sourceHash,reuse_rights:'needs_review'}};
    const updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,sources:[...currentSources,source],evidence:[...prior,...added]}},irBlob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,irBlob.path,irBlob.sha256,projectId);replaceSources(projectId,updated);replaceSlides(projectId,updated.slides);db.prepare('UPDATE sources SET original_name=?,blob_path=? WHERE project_id=? AND source_id=?').run('page.md',blob,projectId,sourceId);});
    return{project_id:projectId,source_id:sourceId,source_sha256:sourceHash,evidence_ids:added.map(item=>item.evidence_id),evidence_count:added.length,added:true,ir_sha256:irBlob.sha256};
  }
  function attachCommonsAsset(projectId,candidate,download){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    if(candidate?.provider!=='wikimedia-commons'||typeof candidate.source_id!=='string'||!/^WMC_[A-F0-9]{16}$/.test(candidate.source_id)||!download?.asset||!Buffer.isBuffer(download.bytes))throw new TypeError('Commons candidate or downloaded asset is invalid.');
    const item=download.asset;if(!/^A_[A-Z0-9][A-Z0-9_-]{1,50}$/.test(item.asset_id)||!['image/png','image/jpeg'].includes(item.mime_type)||item.verified!==false||item.rights_review_status!=='needs_human_review')throw new TypeError('Commons asset must be a supported image with rights pending human review.');
    const sourceHash=sha256(download.bytes);if(item.sha256!==sourceHash)throw new Error('Commons asset hash does not match downloaded image bytes.');
    const existingSource=project.presentationIR.source_ir.sources.find(source=>source.source_id===candidate.source_id),existingAsset=(project.presentationIR.assets||[]).find(asset=>asset.asset_id===item.asset_id);
    if(existingSource||existingAsset){if(existingSource?.commons_asset?.sha256===sourceHash&&existingAsset?.sha256===sourceHash)return{project_id:projectId,source_id:candidate.source_id,asset_id:item.asset_id,asset_sha256:sourceHash,added:false,ir_sha256:project.ir_sha256};throw new Error('Commons source or asset ID already exists with different content.');}
    const extension=item.mime_type==='image/png'?'png':'jpg',relative=`assets/commons/${item.asset_id}.${extension}`,file=path.join(root,relative),blob=path.join(root,'source-blobs',sourceHash);
    fs.writeFileSync(file,download.bytes,{flag:'wx'});if(fs.existsSync(blob)){if(sha256(fs.readFileSync(blob))!==sourceHash)throw new Error('Content-addressed Commons image blob failed hash verification.');}else fs.writeFileSync(blob,download.bytes,{flag:'wx'});
    const asset={asset_id:item.asset_id,uri:relative,sha256:sourceHash,media_type:item.mime_type,source_id:candidate.source_id,license:item.license||'unknown; human review required',rights_status:'pending',author:item.author||null,credit:item.credit||null,license_url:item.license_url||null,attribution_required:item.attribution_required===true,rights_review_status:'needs_human_review',metadata_sha256:item.source_metadata_sha256||null};
    const source={source_id:candidate.source_id,type:'image_asset',uri:candidate.description_page,sha256:sourceHash,locator:candidate.title||candidate.description_page,verification_status:'unverified',claims:[],assets:[item.asset_id],commons_asset:{provider:'wikimedia-commons',title:candidate.title||null,description_page:candidate.description_page,download_url:item.download_url,retrieved_at:item.retrieved_at,sha256:sourceHash,metadata_sha256:item.source_metadata_sha256,license:asset.license,license_url:asset.license_url,author:asset.author,credit:asset.credit,rights_review_status:'needs_human_review'}};
    const updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,sources:[...project.presentationIR.source_ir.sources,source]},assets:[...(project.presentationIR.assets||[]),asset]};assertValidPresentationIR(updated);const irBlob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,irBlob.path,irBlob.sha256,projectId);replaceSources(projectId,updated);replaceSlides(projectId,updated.slides);db.prepare('UPDATE sources SET original_name=?,blob_path=? WHERE project_id=? AND source_id=?').run(`${item.asset_id}.${extension}`,blob,projectId,candidate.source_id);});
    return{project_id:projectId,source_id:candidate.source_id,asset_id:item.asset_id,asset_sha256:sourceHash,rights_review_status:'needs_human_review',added:true,ir_sha256:irBlob.sha256};
  }
  function addResearchCandidates(projectId,result){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    if(!result||!['openalex','crossref','arxiv'].includes(result.provider)||!Array.isArray(result.results))throw new TypeError('Research result must contain a supported provider and results[].');
    const sources=[...project.presentationIR.source_ir.sources],known=new Map(sources.map(source=>[source.source_id,source])),added=[];
    for(const candidate of result.results){
      if(typeof candidate?.source_id!=='string'||!/^SRC_[A-Z0-9_]+$/.test(candidate.source_id)||!/^[a-f\d]{64}$/i.test(candidate.record_sha256||''))throw new Error('Research candidate has an invalid source ID or record SHA-256.');
      const normalized={source_id:candidate.source_id,provider:result.provider,record_sha256:candidate.record_sha256,provider_record_id:candidate.provider_record_id||null,title:candidate.title||null,authors:candidate.authors||[],publication_year:candidate.publication_year??null,doi:candidate.doi||null,landing_url:candidate.landing_url||null,evidence_status:candidate.evidence_status||'metadata_candidate_only'};
      const normalizedBytes=Buffer.from(JSON.stringify(normalized)),normalizedHash=sha256(normalizedBytes),blob=path.join(root,'source-blobs',normalizedHash);
      if(fs.existsSync(blob)){if(sha256(fs.readFileSync(blob))!==normalizedHash)throw new Error('Content-addressed research candidate blob failed hash verification.');}
      else fs.writeFileSync(blob,normalizedBytes,{flag:'wx'});
      const existing=known.get(candidate.source_id);if(existing){const existingMetadataHash=existing.research_candidate?.normalized_sha256||existing.sha256;if(existingMetadataHash!==normalizedHash)throw new Error(`Research source '${candidate.source_id}' already exists with a different metadata hash.`);continue;}
      const source={source_id:candidate.source_id,type:'scholarly_metadata_candidate',uri:candidate.landing_url||candidate.record_url||null,sha256:normalizedHash,locator:`${result.provider}:${candidate.provider_record_id||candidate.source_id}`,verification_status:'unverified',claims:[],assets:[],research_candidate:{...normalized,normalized_sha256:normalizedHash,query:result.query,retrieved_at:result.retrieved_at,record_url:candidate.record_url||null}};
      sources.push(source);known.set(source.source_id,source);added.push(source.source_id);
    }
    const updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,sources}},blob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,blob.path,blob.sha256,projectId);replaceSources(projectId,updated);replaceSlides(projectId,updated.slides);});
    return{project_id:projectId,ir_sha256:blob.sha256,added_source_ids:added,added_count:added.length,total_sources:sources.length};
  }
  function attachArxivPaper(projectId,sourceId,ingestion){
    const project=getProject(projectId);if(!project)throw new Error(`Unknown project '${projectId}'`);
    const sourceIndex=project.presentationIR.source_ir.sources.findIndex(item=>item.source_id===sourceId),candidate=project.presentationIR.source_ir.sources[sourceIndex];
    if(!candidate||candidate.research_candidate?.provider!=='arxiv')throw new Error(`Source '${sourceId}' is not an arXiv metadata candidate.`);
    if(!ingestion?.manifest||ingestion.manifest.provider!=='arxiv'||ingestion.manifest.provider_source_id!==sourceId||!Array.isArray(ingestion.evidence?.entries))throw new TypeError('arXiv ingestion result has invalid source lineage.');
    const directory=path.resolve(ingestion.directory),realDirectory=fs.realpathSync(directory);if(!within(root,realDirectory))throw new Error('arXiv ingestion output must stay inside the API workspace.');
    const pdfPath=path.join(realDirectory,'source.pdf'),pdfBytes=fs.readFileSync(pdfPath),pdfHash=sha256(pdfBytes);if(pdfHash!==ingestion.manifest.source_sha256)throw new Error('arXiv source PDF hash does not match its manifest.');
    const blob=path.join(root,'source-blobs',pdfHash);if(fs.existsSync(blob)){if(sha256(fs.readFileSync(blob))!==pdfHash)throw new Error('Content-addressed arXiv PDF blob failed hash verification.');}else fs.writeFileSync(blob,pdfBytes,{flag:'wx'});
    if(candidate.type==='scholarly_paper'&&candidate.arxiv_paper?.source_sha256===pdfHash)return{project_id:projectId,source_id:sourceId,source_sha256:pdfHash,evidence_ids:ingestion.evidence.entries.map(entry=>entry.id),evidence_count:0,added:false,ir_sha256:project.ir_sha256};
    const priorEvidence=project.presentationIR.source_ir.evidence||[],evidenceById=new Map(priorEvidence.map(item=>[item.evidence_id,item])),addedEvidence=[];
    for(const entry of ingestion.evidence.entries){
      if(!entry||typeof entry.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(entry.id)||typeof entry.excerpt!=='string'||!entry.excerpt.trim()||typeof entry.locator!=='string')throw new TypeError('arXiv excerpt candidate has an invalid ID, excerpt or locator.');
      const evidence={evidence_id:entry.id,source_id:sourceId,excerpt:entry.excerpt,locator:entry.locator,verification_status:'pending',source_sha256:pdfHash,review_status:'pending_human_review'};
      const existing=evidenceById.get(entry.id);if(existing){if(existing.source_id!==sourceId||existing.excerpt!==entry.excerpt||existing.locator!==entry.locator)throw new Error(`Evidence '${entry.id}' already exists with different content.`);continue;}
      evidenceById.set(entry.id,evidence);addedEvidence.push(evidence);
    }
    const updatedSource={...candidate,type:'scholarly_paper',uri:`local-sha256:${pdfHash}`,sha256:pdfHash,locator:ingestion.manifest.download_url,verification_status:'unverified',arxiv_paper:{arxiv_id:ingestion.manifest.arxiv_id,title:ingestion.manifest.title,landing_url:ingestion.manifest.landing_url,download_url:ingestion.manifest.download_url,source_sha256:pdfHash,bytes:pdfBytes.length,page_count:ingestion.manifest.page_count,extraction_engine:ingestion.manifest.extraction_engine,retrieved_at:ingestion.manifest.retrieved_at,reuse_rights:'needs_review'}};
    const sources=project.presentationIR.source_ir.sources.map((item,index)=>index===sourceIndex?updatedSource:item),updated={...project.presentationIR,source_ir:{...project.presentationIR.source_ir,sources,evidence:[...priorEvidence,...addedEvidence]}},irBlob=persistIR(updated),at=now();
    transaction(()=>{db.prepare('UPDATE projects SET updated_at=?,ir_path=?,ir_sha256=? WHERE project_id=?').run(at,irBlob.path,irBlob.sha256,projectId);replaceSources(projectId,updated);replaceSlides(projectId,updated.slides);db.prepare('UPDATE sources SET original_name=?,blob_path=? WHERE project_id=? AND source_id=?').run('source.pdf',blob,projectId,sourceId);});
    return{project_id:projectId,source_id:sourceId,source_sha256:pdfHash,evidence_ids:addedEvidence.map(item=>item.evidence_id),evidence_count:addedEvidence.length,added:true,ir_sha256:irBlob.sha256};
  }
  function createJob(projectId,options={},workflow='presentation'){
    if(!db.prepare('SELECT 1 FROM projects WHERE project_id=?').get(projectId))throw new Error(`Unknown project '${projectId}'`);
    const jobId=id(),at=now(),events=[];
    if(!['presentation','research-topic','arxiv-paper-ingest','document-ingest','web-crawl','commons-asset'].includes(workflow))throw new TypeError(`Unsupported workflow '${workflow}'.`);
    db.prepare('INSERT INTO jobs(job_id,project_id,workflow,status,created_at,updated_at,options_json,events_json) VALUES(?,?,?,?,?,?,?,?)').run(jobId,projectId,workflow,'queued',at,at,json(options),json(events));
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
  return{root,db,createProfile,updateProfile,getProfile,listProfiles,createProject,getProject,listProjects,savePresentationIR,updateSlide,importSource,readSourceBlob,attachDocumentEvidence,attachCrawledPage,attachCommonsAsset,addResearchCandidates,attachArxivPaper,createJob,getJob,listJobs,event,setJob,requestCancel,listQueuedJobs,recoverInterruptedJobs,addArtifacts,listArtifacts,getArtifact,getSlides,close};
}
