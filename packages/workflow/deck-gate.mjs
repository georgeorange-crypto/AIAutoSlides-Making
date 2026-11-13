import crypto from 'node:crypto';

const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const planBody=plan=>{const body={...plan};delete body.approval;delete body.representative_review;return body;};
const fail=errors=>({status:errors.length?'fail':'pass',errors});

export function validateDeckPlan(plan){
  const errors=[];
  if(!plan||plan.schema_version!=='1.0.0')errors.push('schema_version must be 1.0.0');
  for(const key of ['task','materials','tools','slides','representative_slides','acceptance'])if(!plan?.[key])errors.push(`missing ${key}`);
  if(!plan?.task?.scope||!Number.isInteger(plan?.task?.expected_slide_count)||plan.task.expected_slide_count<1)errors.push('task.scope and positive task.expected_slide_count are required');
  if(!Array.isArray(plan?.materials)||!plan.materials.length)errors.push('materials must list at least one required project/source material');
  else for(const [i,item] of plan.materials.entries())if(!item.path||!item.sha256||item.read_status!=='read')errors.push(`materials[${i}] requires path, sha256 and read_status=read`);
  if(!Array.isArray(plan?.tools)||!plan.tools.length)errors.push('tools must include actual capability evidence');
  else for(const [i,item] of plan.tools.entries())if(!item.id||!['catalogued','adapter-ready','smoke-tested','e2e-tested','blocked'].includes(item.status)||!item.evidence)errors.push(`tools[${i}] requires id, valid status and evidence`);
  const slides=plan?.slides;
  if(!Array.isArray(slides)||slides.length!==plan?.task?.expected_slide_count)errors.push('slides must cover exactly task.expected_slide_count');
  else{
    const ids=new Set();for(const [i,s] of slides.entries()){
      if(!s.slide_id||ids.has(s.slide_id))errors.push(`slides[${i}] has missing or duplicate slide_id`);ids.add(s.slide_id);
      for(const key of ['assertion','evidence_ids','visual_type','visual_source','tool_id','rights_status'])if(s[key]===undefined)errors.push(`slides[${i}] missing ${key}`);
    }
    if(!Array.isArray(plan.representative_slides)||!plan.representative_slides.length||plan.representative_slides.some(id=>!ids.has(id)))errors.push('representative_slides must name one or more planned slide IDs');
  }
  if(!plan?.acceptance?.reviewer||!Array.isArray(plan?.acceptance?.gates)||!plan.acceptance.gates.length)errors.push('acceptance requires reviewer and explicit gates');
  return fail(errors);
}

export function approveDeckPlan(plan,{reviewer,note}={}){
  const report=validateDeckPlan(plan);if(report.status!=='pass')throw new Error(`Deck plan is invalid: ${report.errors.join('; ')}`);
  if(!reviewer?.trim()||!note?.trim())throw new Error('Plan approval requires reviewer and note.');
  const approved={...plan};delete approved.approval;
  return{...approved,approval:{status:'approved',reviewer:reviewer.trim(),note:note.trim(),plan_sha256:hash(approved),approved_at:new Date().toISOString()}};
}

export function assertApprovedDeckPlan(plan,presentationIR){
  const report=validateDeckPlan(plan);if(report.status!=='pass')throw new Error(`Deck plan is invalid: ${report.errors.join('; ')}`);
  const approved=planBody(plan);
  if(plan.approval?.status!=='approved'||!plan.approval.reviewer||plan.approval.plan_sha256!==hash(approved))throw new Error('Deck plan is not approved for its current contents.');
  if(plan.task.expected_slide_count!==presentationIR.slides.length){
    const prototype=plan.representative_slides;
    if(JSON.stringify([...prototype].sort())!==JSON.stringify(presentationIR.slides.map(s=>s.slide_id).sort()))throw new Error('Deck plan page count does not match Presentation IR; prototype runs must contain exactly representative_slides.');
  }else{
    const planned=plan.slides.map(s=>s.slide_id).sort(),actual=presentationIR.slides.map(s=>s.slide_id).sort();
    if(JSON.stringify(planned)!==JSON.stringify(actual))throw new Error('Deck plan slide IDs do not exactly match Presentation IR.');
    if(!plan.representative_review?.artifact_sha256)throw new Error('Full deck build is blocked until the representative-slide review is recorded.');
  }
  return true;
}

export function approveRepresentativeSlides(plan,{reviewer,note,artifact_sha256}={}){
  if(plan.approval?.status!=='approved'||plan.approval.plan_sha256!==hash(planBody(plan)))throw new Error('Representative review requires an approved, unchanged deck plan.');
  if(!reviewer?.trim()||!note?.trim()||!/^[a-f\d]{64}$/i.test(artifact_sha256||''))throw new Error('Representative review requires reviewer, note, and artifact SHA-256.');
  return{...plan,representative_review:{reviewer:reviewer.trim(),note:note.trim(),artifact_sha256,reviewed_at:new Date().toISOString()}};
}

export function validatePageReviews(pageReviews,requiredSlideIds){
  const errors=[];if(!Array.isArray(pageReviews))return fail(['page_reviews must be an array']);
  const byId=new Map();for(const item of pageReviews){if(!item?.slide_id||byId.has(item.slide_id))errors.push('page_reviews contain missing or duplicate slide_id');else byId.set(item.slide_id,item);}
  const required=[...requiredSlideIds].sort(),provided=[...byId.keys()].sort();if(JSON.stringify(required)!==JSON.stringify(provided))errors.push('page_reviews must cover every required slide exactly once');
  for(const id of required){const item=byId.get(id);if(item&&(item.status!=='pass'||!item.findings||!item.rechecked))errors.push(`${id} requires status=pass, findings (use "none" when empty), and rechecked=true`);}
  return fail(errors);
}
