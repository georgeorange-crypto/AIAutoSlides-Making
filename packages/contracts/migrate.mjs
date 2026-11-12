import crypto from 'node:crypto';

const sha256=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function migrateLegacyEvidence(evidence,{sourcePath='sources/evidence.json'}={}) {
 const entries=Array.isArray(evidence)?evidence:evidence?.entries;
 if(!Array.isArray(entries))throw new TypeError('Legacy evidence must contain entries[]');
 return {schema_version:'1.0.0',sources:entries.map(e=>({source_id:e.id,type:'unknown',uri:e.source||null,locator:e.locator||null,verification_status:e.verified===true?'verified':'unverified',claims:[],assets:[],legacy:{label:e.label||null,note:e.note||null,source_path:sourcePath}}))};
}
export function migrateLegacyStoryboard(storyboard,{evidence={},sourcePath='storyboard.json'}={}) {
 if(!Array.isArray(storyboard?.slides))throw new TypeError('Legacy storyboard must contain slides[]');
 const slides=storyboard.slides.map((s,i)=>({slide_id:s.slide_id||`S${String(i+1).padStart(2,'0')}`,type:s.type,title:s.title||'',assertion_title:s.assertion_title||s.title||'',body:s.body||[],speaker_notes:s.speaker_notes||'',evidence_ids:s.evidence_ids||[],elements:Object.entries(s).filter(([k])=>!['slide_id','type','title','assertion_title','body','speaker_notes','evidence_ids','kicker','layout'].includes(k)).map(([k,v],n)=>({element_id:`S${String(i+1).padStart(2,'0')}-E${String(n+1).padStart(2,'0')}`,kind:k,value:v})),legacy_layout:s.layout||null}));
 const sourceIR=migrateLegacyEvidence(evidence);
 const known=new Set(sourceIR.sources.map(s=>s.source_id));
 const unknown=[...new Set(slides.flatMap(s=>s.evidence_ids).filter(id=>!known.has(id)))];
 if(unknown.length)throw new Error(`Unknown evidence IDs in legacy storyboard: ${unknown.join(', ')}`);
 return {schema_version:'1.0.0',meta:storyboard.meta||{},slides,source_ir:sourceIR,legacy:{source_path:sourcePath}};
}
export function createRunManifest({runId,workflow,inputs=[],outputs=[],toolCalls=[],logs=[],status='completed'}) {
 if(!runId||!workflow)throw new TypeError('runId and workflow are required');
 const hashArtifact=a=>({...a,sha256:a.sha256|| (a.content!==undefined?sha256(a.content):null)});
 return {schema_version:'1.0.0',run_id:runId,workflow,status,started_at:new Date().toISOString(),inputs:inputs.map(hashArtifact),outputs:outputs.map(hashArtifact),tool_calls:toolCalls,logs};
}
