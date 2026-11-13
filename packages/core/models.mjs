import {assertValidPresentationIR} from './validate-presentation.mjs';

const id=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required`);return value.trim();};
const state=value=>{if(!['verified','unverified','pending','contradicted'].includes(value))throw new TypeError(`Invalid verification state '${value}'`);return value;};
const isoNow=()=>new Date().toISOString();

export function createProject({project_id,title,profile=null,source_ids=[],deck_ids=[],created_at=isoNow(),settings={}}){
  return{schema_version:'1.0.0',project_id:id(project_id,'project_id'),title:id(title,'title'),profile,source_ids:[...source_ids],deck_ids:[...deck_ids],created_at,settings:{...settings}};
}
export function createUserProfile({profile_id,preferences={},privacy={local_only:true,allow_network:false,allow_paid_api:false}}){
  return{schema_version:'1.0.0',profile_id:id(profile_id,'profile_id'),preferences:structuredClone(preferences),privacy:{...privacy}};
}
export function createSource({source_id,type,uri=null,sha256=null,locator=null,verification_status='unverified',claims=[],assets=[]}){
  if(sha256!==null&&!/^[a-f\d]{64}$/i.test(sha256))throw new TypeError('sha256 must contain 64 hexadecimal characters');
  return{source_id:id(source_id,'source_id'),type:id(type,'type'),uri,sha256,locator,verification_status:state(verification_status),claims:[...claims],assets:[...assets]};
}
export function createEvidence({evidence_id,source_id,excerpt,locator=null,verification_status='pending',reviewer=null,reviewed_at=null}){
  return{evidence_id:id(evidence_id,'evidence_id'),source_id:id(source_id,'source_id'),excerpt:id(excerpt,'excerpt'),locator,verification_status:state(verification_status),reviewer,reviewed_at};
}
export function createAsset({asset_id,media_type,uri=null,sha256=null,source_id=null,license=null,rights_status='unknown'}){
  if(sha256!==null&&!/^[a-f\d]{64}$/i.test(sha256))throw new TypeError('asset sha256 must contain 64 hexadecimal characters');
  if(!['approved','pending','restricted','unknown'].includes(rights_status))throw new TypeError(`Invalid asset rights status '${rights_status}'`);
  return{asset_id:id(asset_id,'asset_id'),media_type:id(media_type,'media_type'),uri,sha256,source_id,license,rights_status};
}
export function createClaim({claim_id,statement,evidence_ids=[],review_status='pending',reviewer=null,reviewed_at=null}){
  if(!['pending','verified','contradicted'].includes(review_status))throw new TypeError(`Invalid claim review status '${review_status}'`);
  return{claim_id:id(claim_id,'claim_id'),statement:id(statement,'statement'),evidence_ids:[...new Set(evidence_ids.map(item=>id(item,'evidence_id')))],review_status,reviewer,reviewed_at};
}
export function createSlideIR({slide_id,type,title,evidence_ids=[],elements=[],...rest}){
  return{slide_id:id(slide_id,'slide_id'),type:id(type,'type'),title:id(title,'title'),evidence_ids:[...new Set(evidence_ids.map(item=>id(item,'evidence_id')))],elements:structuredClone(elements),...structuredClone(rest)};
}
export function createDeckIR({deck_id=null,meta,source_ir,slides,assets, ...rest}){
  const deck={...structuredClone(rest),schema_version:'1.0.0',...(deck_id?{deck_id:id(deck_id,'deck_id')}:{}),meta:structuredClone(meta),source_ir:structuredClone(source_ir),...(assets?{assets:structuredClone(assets)}:{}),slides:structuredClone(slides)};
  assertValidPresentationIR(deck);
  return deck;
}

const TRANSITIONS={queued:['running','cancelled'],running:['awaiting_review','completed','failed','cancelled'],awaiting_review:['completed','revision_required'],revision_required:[],completed:[],failed:[],cancelled:[]};
export function createJobState({job_id,project_id,workflow,status='queued',created_at=isoNow(),updated_at=created_at,events=[]}){
  if(!Object.hasOwn(TRANSITIONS,status))throw new TypeError(`Invalid job status '${status}'`);
  return{schema_version:'1.0.0',job_id:id(job_id,'job_id'),project_id:id(project_id,'project_id'),workflow:id(workflow,'workflow'),status,created_at,updated_at,events:[...events]};
}
export function transitionJob(job,nextStatus,{at=isoNow(),detail=''}={}){
  if(!Object.hasOwn(TRANSITIONS,nextStatus))throw new TypeError(`Invalid job status '${nextStatus}'`);
  if(!TRANSITIONS[job.status]?.includes(nextStatus))throw new Error(`Invalid job transition ${job.status} → ${nextStatus}`);
  return{...job,status:nextStatus,updated_at:at,events:[...job.events,{from:job.status,to:nextStatus,at,detail}]};
}
