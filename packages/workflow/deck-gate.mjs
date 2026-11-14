import crypto from 'node:crypto';
import {classifyImportance,importanceLevels} from './importance.mjs';

export const MIN_FORMAL_VISUAL_SLIDE_RATIO=0.5;
export const DEEP_EXPLANATION_STAGES=Object.freeze(['question','mechanism','evidence','comparison','result','implication','boundary','synthesis']);
const AGENDA_ROLE=/^(agenda|contents|table[_ -]?of[_ -]?contents|目录)$/i;
const SECTION_ROLE=/^(section[_ -]?transition|section)$/i;
const OPENING_ROLE=/^(cover|opening)$/i;
const ENDING_ROLE=/^(closing|conclusion|summary)$/i;
const NON_CONTENT_ROLE=/^(agenda|contents|table[_ -]?of[_ -]?contents|目录|section[_ -]?transition|section|cover|opening|closing|conclusion|summary)$/i;
const EVIDENCE_OPTIONAL_ROLE=/^(agenda|contents|table[_ -]?of[_ -]?contents|目录|section[_ -]?transition|section|cover|opening)$/i;

const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalizeAssertion=value=>String(value||'').normalize('NFC').trim().replace(/\s+/gu,' ');
const planBody=plan=>{const body={...plan};delete body.approval;delete body.representative_review;return body;};
const fail=errors=>({status:errors.length?'fail':'pass',errors});
export const PAGE_QUALITY_CHECKS=Object.freeze([
  'content_density','typography','visual_support','diagram_logic','narrative_role',
  'presentation_voice','language_clarity','layout_variety','caveat_relevance','emphasis_depth','rendered_fit'
]);
export const MIN_PAGE_REVIEW_NOTE_UNITS=12;
const reviewNoteUnits=value=>(String(value||'').match(/[A-Za-z][A-Za-z0-9'’.-]*|\p{Script=Han}/gu)||[]).length;
const normalizeReviewNote=value=>String(value||'').normalize('NFC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');

export function validateDeckPlan(plan){
  const errors=[];
  if(!plan||plan.schema_version!=='1.2.0')errors.push('schema_version must be 1.2.0');
  for(const key of ['task','quality_contract','materials','tools','slides','representative_slides','acceptance'])if(!plan?.[key])errors.push(`missing ${key}`);
  if(!plan?.task?.scope||!Number.isInteger(plan?.task?.expected_slide_count)||plan.task.expected_slide_count<1)errors.push('task.scope and positive task.expected_slide_count are required');
  if(!Number.isFinite(plan?.task?.target_duration_seconds)||plan.task.target_duration_seconds<60||plan.task.target_duration_seconds>7200)errors.push('task.target_duration_seconds must be between 60 and 7200');
  const quality=plan?.quality_contract;
  for(const key of ['audience','purpose','language','style_reference','content_priorities','priority_depth','narrative_sections','avoid_patterns','visual_slide_ratio_min','minimum_explanation_units','minimum_priority_slide_share','minimum_priority_time_share'])if(quality?.[key]===undefined)errors.push(`quality_contract missing ${key}`);
  if(quality){for(const key of ['audience','purpose','language','style_reference'])if(typeof quality[key]!=='string'||!quality[key].trim())errors.push(`quality_contract.${key} must be a nonempty string`);
    for(const key of ['content_priorities','narrative_sections','avoid_patterns'])if(!Array.isArray(quality[key])||quality[key].some(value=>typeof value!=='string'||!value.trim()))errors.push(`quality_contract.${key} must be an array of nonempty strings`);
    if(Array.isArray(quality.content_priorities)&&!quality.content_priorities.length)errors.push('quality_contract.content_priorities must not be empty');
    if(Array.isArray(quality.content_priorities)&&new Set(quality.content_priorities).size!==quality.content_priorities.length)errors.push('quality_contract.content_priorities must be unique');
    if(!Array.isArray(quality.priority_depth))errors.push('quality_contract.priority_depth must define the required explanation depth for every content priority');
    else{
      const ids=quality.priority_depth.map(item=>item?.priority_id);
      if(ids.some(id=>typeof id!=='string'||!id.trim())||new Set(ids).size!==ids.length)errors.push('quality_contract.priority_depth must have unique nonempty priority_id values');
      if(Array.isArray(quality.content_priorities)&&JSON.stringify([...ids].sort())!==JSON.stringify([...quality.content_priorities].sort()))errors.push('quality_contract.priority_depth must cover every content priority exactly once');
      for(const item of quality.priority_depth){const minimum=item?.depth_level==='deep'?7:item?.depth_level==='standard'?2:null;if(minimum===null)errors.push(`priority_depth "${item?.priority_id||''}" depth_level must be standard or deep`);else if(!Number.isInteger(item.minimum_core_slides)||item.minimum_core_slides<minimum)errors.push(`priority_depth "${item.priority_id}" must allocate at least ${minimum} distinct core/high slides for ${item.depth_level} explanation depth`);else if(item.minimum_core_slides> (plan?.task?.expected_slide_count||0))errors.push(`priority_depth "${item.priority_id}" minimum_core_slides cannot exceed the deck page count`);}
    }
    if(Array.isArray(quality.narrative_sections)&&!quality.narrative_sections.length)errors.push('quality_contract.narrative_sections must not be empty');
    if(Array.isArray(quality.narrative_sections)&&new Set(quality.narrative_sections).size!==quality.narrative_sections.length)errors.push('quality_contract.narrative_sections must be unique');
    if(!Number.isFinite(quality.visual_slide_ratio_min)||quality.visual_slide_ratio_min<MIN_FORMAL_VISUAL_SLIDE_RATIO||quality.visual_slide_ratio_min>1)errors.push(`quality_contract.visual_slide_ratio_min must be between ${MIN_FORMAL_VISUAL_SLIDE_RATIO.toFixed(2)} and 1`);
    if(!Number.isInteger(quality.minimum_explanation_units)||quality.minimum_explanation_units<18||quality.minimum_explanation_units>120)errors.push('quality_contract.minimum_explanation_units must be an integer between 18 and 120');
    if(!Number.isFinite(quality.minimum_priority_slide_share)||quality.minimum_priority_slide_share<0.25||quality.minimum_priority_slide_share>0.75)errors.push('quality_contract.minimum_priority_slide_share must be between 0.25 and 0.75');
    if(!Number.isFinite(quality.minimum_priority_time_share)||quality.minimum_priority_time_share<0.5||quality.minimum_priority_time_share>0.9)errors.push('quality_contract.minimum_priority_time_share must be between 0.50 and 0.90');}
  if(!Array.isArray(plan?.materials)||!plan.materials.length)errors.push('materials must list at least one required project/source material');
  else for(const [i,item] of plan.materials.entries())if(!item.path||!item.sha256||item.read_status!=='read')errors.push(`materials[${i}] requires path, sha256 and read_status=read`);
  if(!Array.isArray(plan?.tools)||!plan.tools.length)errors.push('tools must include actual capability evidence');
  else for(const [i,item] of plan.tools.entries())if(!item.id||!['catalogued','adapter-ready','smoke-tested','e2e-tested','blocked'].includes(item.status)||!item.evidence)errors.push(`tools[${i}] requires id, valid status and evidence`);
  const slides=plan?.slides;
  if(!Array.isArray(slides)||slides.length!==plan?.task?.expected_slide_count)errors.push('slides must cover exactly task.expected_slide_count');
  else{
    const ids=new Set();for(const [i,s] of slides.entries()){
      if(!s.slide_id||ids.has(s.slide_id))errors.push(`slides[${i}] has missing or duplicate slide_id`);ids.add(s.slide_id);
      for(const key of ['assertion','evidence_ids','visual_type','visual_source','tool_id','rights_status','narrative_role','importance','explanation_goal','visual_rationale','layout_intent'])if(s[key]===undefined)errors.push(`slides[${i}] missing ${key}`);
      for(const key of ['assertion','visual_type','visual_source','tool_id','rights_status','narrative_role','importance','explanation_goal','visual_rationale','layout_intent'])if(typeof s[key]!=='string'||!s[key].trim())errors.push(`slides[${i}].${key} must be a nonempty string`);
      if(s.importance&&classifyImportance(s.importance)===null)errors.push(`slides[${i}].importance must be one of: ${importanceLevels().join(', ')}`);
      if(!NON_CONTENT_ROLE.test(s.narrative_role||'')){
        if(!Array.isArray(s.priority_ids)||s.priority_ids.some(id=>typeof id!=='string'||!id.trim()))errors.push(`slides[${i}].priority_ids must be an array of declared content priority labels`);
        else if(new Set(s.priority_ids).size!==s.priority_ids.length)errors.push(`slides[${i}].priority_ids must not contain duplicate labels`);
        else for(const id of s.priority_ids)if(!quality?.content_priorities?.includes(id))errors.push(`slides[${i}].priority_ids contains undeclared content priority "${id}"`);
        if(classifyImportance(s.importance)==='priority'&&Array.isArray(s.priority_ids)&&!s.priority_ids.length)errors.push(`slides[${i}] is core/high but maps to no declared content priority`);
      }
      if(!Array.isArray(s.evidence_ids))errors.push(`slides[${i}].evidence_ids must be an array`);
      else{
        if(s.evidence_ids.some(id=>typeof id!=='string'||!id.trim()))errors.push(`slides[${i}].evidence_ids must contain only nonempty source/evidence IDs`);
        if(!EVIDENCE_OPTIONAL_ROLE.test(s.narrative_role||'')&&s.evidence_ids.length===0)errors.push(`slides[${i}].evidence_ids must cite at least one source/evidence ID for substantive content`);
      }
      if(s.section_name!==undefined&&typeof s.section_name!=='string')errors.push(`slides[${i}].section_name must be a string when present`);
    }
    if(!Array.isArray(plan.representative_slides)||!plan.representative_slides.length||plan.representative_slides.some(id=>!ids.has(id)))errors.push('representative_slides must name one or more planned slide IDs');
    if(Array.isArray(quality?.narrative_sections)&&Array.isArray(slides)){
      const agenda=slides.filter(slide=>AGENDA_ROLE.test(slide.narrative_role||''));
      if(agenda.length!==1)errors.push('slides must contain exactly one agenda slide with narrative_role=agenda');
      else{
        const agendaIndex=slides.indexOf(agenda[0]);
        const openings=slides.map((slide,index)=>({slide,index})).filter(({slide})=>OPENING_ROLE.test(slide.narrative_role||''));
        if(openings.length>1||openings.some(({index})=>index!==0))errors.push('the deck may contain at most one cover/opening slide and it must be the first page');
        if(agendaIndex>1||slides.slice(0,agendaIndex).some(slide=>!OPENING_ROLE.test(slide.narrative_role||'')))errors.push('the agenda must follow at most one cover/opening slide and precede section content');
        const endings=slides.map((slide,index)=>({slide,index})).filter(({slide})=>ENDING_ROLE.test(slide.narrative_role||''));
        if(endings.length>1||endings.some(({index})=>index!==slides.length-1))errors.push('the deck may contain at most one closing/conclusion/summary slide and it must be last');
      }
      const transitionPages=slides.filter(slide=>SECTION_ROLE.test(slide.narrative_role||''));
      if(transitionPages.length!==quality.narrative_sections.length)errors.push('the deck must contain exactly one section-transition page for each declared narrative section');
      for(const slide of transitionPages)if(!quality.narrative_sections.includes(slide.section_name))errors.push(`section-transition slide "${slide.slide_id}" names undeclared section "${slide.section_name||''}"`);
      const sectionOrder=[];
      for(const section of quality.narrative_sections){
        const transitions=slides.filter(slide=>SECTION_ROLE.test(slide.narrative_role||'')&&slide.section_name===section);
        if(transitions.length!==1)errors.push(`narrative section "${section}" must have exactly one section-transition slide with matching section_name`);
        const content=slides.filter(slide=>slide.section_name===section&&!NON_CONTENT_ROLE.test(slide.narrative_role||''));
        if(!content.length)errors.push(`narrative section "${section}" must own at least one content slide via section_name`);
        if(transitions.length===1&&content.length){
          const transitionIndex=slides.indexOf(transitions[0]),firstContentIndex=Math.min(...content.map(slide=>slides.indexOf(slide)));
          if(agenda.length===1&&transitionIndex<=slides.indexOf(agenda[0]))errors.push(`section-transition slide for "${section}" must follow the agenda`);
          if(transitionIndex>=firstContentIndex)errors.push(`section-transition slide for "${section}" must precede its content slides`);
          sectionOrder.push(transitionIndex);
        }
      }
      if(sectionOrder.some((index,i)=>i>0&&index<=sectionOrder[i-1]))errors.push('section-transition slides must follow quality_contract.narrative_sections order');
      for(const [i,slide] of slides.entries())if(!NON_CONTENT_ROLE.test(slide.narrative_role||'')&&(!slide.section_name||!quality.narrative_sections.includes(slide.section_name)))errors.push(`slides[${i}] content must have section_name matching quality_contract.narrative_sections`);
    }
    if(Array.isArray(quality?.content_priorities)&&Array.isArray(slides))for(const priority of quality.content_priorities){
      const owners=slides.filter(slide=>Array.isArray(slide.priority_ids)&&slide.priority_ids.includes(priority));
      if(!owners.some(slide=>classifyImportance(slide.importance)==='priority'))errors.push(`content priority "${priority}" must map to at least one core/high slide`);
      const depth=quality.priority_depth?.find(item=>item?.priority_id===priority),coreOwners=owners.filter(slide=>classifyImportance(slide.importance)==='priority');
      if(depth&&coreOwners.length<depth.minimum_core_slides)errors.push(`content priority "${priority}" has ${coreOwners.length} core/high pages; its ${depth.depth_level} depth requires ${depth.minimum_core_slides}`);
      if(depth?.depth_level==='deep'){
        const invalid=coreOwners.filter(slide=>!DEEP_EXPLANATION_STAGES.includes(slide.explanation_stage));
        if(invalid.length)errors.push(`deep content priority "${priority}" requires every mapped core/high slide to declare explanation_stage from: ${DEEP_EXPLANATION_STAGES.join(', ')} (missing/invalid: ${invalid.map(slide=>slide.slide_id).join(', ')})`);
        const stages=new Set(coreOwners.map(slide=>slide.explanation_stage).filter(stage=>DEEP_EXPLANATION_STAGES.includes(stage)));
        if(stages.size<4)errors.push(`deep content priority "${priority}" must cover at least 4 different explanation stages; found ${stages.size}`);
      }
    }
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
  const availableEvidence=new Set([...(presentationIR.source_ir?.sources||[]).map(item=>item.source_id),...(presentationIR.source_ir?.evidence||[]).map(item=>item.evidence_id)]);
  for(const plannedSlide of plan.slides){
    const actualSlide=presentationIR.slides.find(slide=>slide.slide_id===plannedSlide.slide_id);
    if(!actualSlide)continue;
    const plannedAssertion=normalizeAssertion(plannedSlide.assertion),actualAssertion=normalizeAssertion(actualSlide.assertion_title||actualSlide.title);
    if(!plannedAssertion||plannedAssertion!==actualAssertion)throw new Error(`Approved assertion for slide ${plannedSlide.slide_id} does not match its Presentation IR headline.`);
    const unknown=(plannedSlide.evidence_ids||[]).filter(id=>!availableEvidence.has(id));
    if(unknown.length)throw new Error(`Deck plan slide ${plannedSlide.slide_id} cites unknown source/evidence IDs: ${unknown.join(', ')}.`);
    const actual=new Set(actualSlide.evidence_ids||[]),missing=(plannedSlide.evidence_ids||[]).filter(id=>!actual.has(id));
    if(missing.length)throw new Error(`Deck plan evidence is not carried into Presentation IR slide ${plannedSlide.slide_id}: ${missing.join(', ')}.`);
  }
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
  for(const id of required){const item=byId.get(id);if(!item)continue;
    if(item.status!=='pass'||!item.findings||!item.rechecked)errors.push(`${id} requires status=pass, findings (use "none" when empty), and rechecked=true`);
    if(item.status==='pass'&&!/^(?:none|resolved:\s*\S)/i.test(String(item.findings||'').trim()))errors.push(`${id} cannot pass with unresolved findings; use "none" or "resolved: ..." after rechecking`);
    const checks=item.quality_checks;
    if(!checks||typeof checks!=='object'||Array.isArray(checks)){errors.push(`${id} requires quality_checks for every required quality dimension`);continue;}
    const noteOwners=new Map();
    for(const check of PAGE_QUALITY_CHECKS){const value=checks[check];if(!value||!['pass','not_applicable'].includes(value.status)||typeof value.note!=='string'||!value.note.trim())errors.push(`${id}.${check} requires status=pass or not_applicable and a nonempty note`);else{
      const note=value.note.trim(),noteUnits=reviewNoteUnits(note),normalized=normalizeReviewNote(note);
      if(noteUnits<MIN_PAGE_REVIEW_NOTE_UNITS)errors.push(`${id}.${check} note must contain at least ${MIN_PAGE_REVIEW_NOTE_UNITS} informative text units; found ${noteUnits}`);
      const owner=noteOwners.get(normalized);if(owner)errors.push(`${id}.${check} repeats the ${owner} note; each quality dimension needs its own page-specific observation`);else noteOwners.set(normalized,check);
      if(value.status==='not_applicable'&&!/^(?:n\/?a|not applicable):\s*\S/i.test(note))errors.push(`${id}.${check} not_applicable requires a reason after "N/A:"`);
    }}
    for(const check of Object.keys(checks))if(!PAGE_QUALITY_CHECKS.includes(check))errors.push(`${id}.${check} is not a recognized quality check`);
  }
  return fail(errors);
}
