const AUDIENCE={
  research_group:{opening:'research_question',closing:'limitations_and_next_experiment',roles:{chart:'experimental_result',table:'protocol_or_measurements',architecture:'system_setup',process:'method',bullets:'research_context',statement:'research_claim',metrics:'measured_result'}},
  academic_conference:{opening:'research_question',closing:'contribution_and_implications',roles:{chart:'result_supporting_contribution',table:'evidence_summary',architecture:'technical_approach',process:'method',bullets:'related_context',statement:'contribution_claim',metrics:'key_result'}},
  investment_committee:{opening:'decision_context',closing:'decision_request',roles:{chart:'performance_or_sensitivity',table:'unit_economics_or_risks',architecture:'execution_model',process:'plan_or_milestones',bullets:'opportunity_and_risks',statement:'investment_thesis',metrics:'business_metrics'}}
};
const ELEMENT_MEDIA={chart:['data_chart','Compare the supplied numeric series or distribution directly.'],table:['editable_table','Preserve exact row-level values and labels.'],image:['source_image','Use the declared asset and retain its source and rights state.'],process:['process_diagram','Show the authored sequence as editable steps when supported.'],diagram:['system_diagram','Show the supplied components and relations.'],mermaid:['diagram_source','Retain the supplied Mermaid source; confirm renderer editability before choosing an output backend.'],cards:['metric_cards','Emphasize the supplied structured metrics.'],text:['text','Keep the authored explanatory text editable.'],bullets:['editable_bullets','Keep the authored points editable.'],callout:['callout','Emphasize the supplied statement without adding claims.']};

function fallbackRole(slide,index,count,audience){
  if(index===0)return AUDIENCE[audience]?.opening||'opening_context';
  if(index===count-1)return AUDIENCE[audience]?.closing||'conclusion';
  const type=slide.elements?.some(element=>element.kind==='chart')?'chart':slide.elements?.some(element=>element.kind==='table')?'table':slide.elements?.some(element=>element.kind==='diagram'||element.kind==='mermaid')?'architecture':slide.type;
  return AUDIENCE[audience]?.roles?.[type]||({chart:'evidence',table:'evidence',architecture:'system_model',process:'method',metrics:'key_metrics',bullets:'supporting_points',statement:'claim',timeline:'sequence',code:'implementation_detail'}[type]||'supporting_context');
}
function elementsOf(slide){return slide.elements||[];}
function mediaFor(slide,assetById){
  const elements=elementsOf(slide);
  const candidates=elements.map(element=>{
    const [media_type,reason]=ELEMENT_MEDIA[element.kind]||['text','Keep content in editable text because no specialized visual element was supplied.'];
    const asset=element.asset_id?assetById.get(element.asset_id):null;
    return{element_id:element.element_id,media_type,reason,source_ids:element.source_ids||slide.evidence_ids||[],asset_id:element.asset_id||null,license:asset?.license||null,rights_status:asset?.rights_status||element.rights_status||null};
  });
  if(!candidates.length)candidates.push({element_id:null,media_type:'text',reason:'No structured visual element was supplied; retain the authored content without inventing an asset.',source_ids:slide.evidence_ids||[],asset_id:null,license:null,rights_status:null});
  const selected=candidates.find(item=>item.media_type==='data_chart'||item.media_type==='editable_table'||item.media_type==='system_diagram'||item.media_type==='process_diagram'||item.media_type==='source_image')||candidates[0];
  return{candidates,selected_media_type:selected.media_type,selection_reason:selected.reason};
}
function seconds(value){return Math.round(value);}

/** Deterministic, inspectable presentation intelligence. This ranks authored IR only; it does not invent or verify content. */
export function planPresentationIntelligence(presentationIR){
  const slides=presentationIR.slides||[],meta=presentationIR.meta||{},assetById=new Map((presentationIR.assets||[]).map(asset=>[asset.asset_id,asset])),rawAudience=meta.audience_profile||meta.audience||'general',audience=typeof rawAudience==='string'?rawAudience:(rawAudience?.profile||rawAudience?.type||'general'),duration=Number(meta.duration_seconds??(Number(meta.duration_minutes)*60)),known=slides.map(slide=>Number(slide.time_budget_seconds)).filter(value=>Number.isFinite(value)&&value>0),total=Number.isFinite(duration)&&duration>0?duration:null;
  const explicitTotal=known.reduce((sum,value)=>sum+value,0),remaining=total===null?null:Math.max(0,total-explicitTotal),unassigned=slides.filter(slide=>!(Number.isFinite(Number(slide.time_budget_seconds))&&Number(slide.time_budget_seconds)>0));
  const weights=unassigned.map(slide=>{
    const typeWeight={cover:0.6,closing:0.65,chart:1.35,table:1.3,architecture:1.25,process:1.2,metrics:1.15,statement:1.05}[slide.type]||1;
    const complexity=1+Math.min(0.7,(elementsOf(slide).length+((slide.body||[]).length*0.35))/10);
    return typeWeight*complexity;
  });
  const weightTotal=weights.reduce((sum,value)=>sum+value,0)||1;
  let assignedSoFar=0;
  const planned=slides.map((slide,index)=>{
    const refs=[...new Set([...(slide.evidence_ids||[]),...elementsOf(slide).flatMap(element=>element.source_ids||[])])];
    const explicit=Number(slide.time_budget_seconds),hasExplicit=Number.isFinite(explicit)&&explicit>0;
    let budget=hasExplicit?seconds(explicit):null;
    if(!hasExplicit&&remaining!==null){const position=unassigned.findIndex(item=>item===slide);if(position>=0){budget=position===unassigned.length-1?seconds(Math.max(0,remaining-assignedSoFar)):seconds(remaining*weights[position]/weightTotal);assignedSoFar+=budget;}}
    const media=mediaFor(slide,assetById);
    return{slide_id:slide.slide_id,ordinal:index+1,takeaway:slide.takeaway||slide.assertion_title||slide.title||'',evidence_refs:refs,narrative_role:slide.role||fallbackRole(slide,index,slides.length,audience),media_candidates:media.candidates,selected_media_type:media.selected_media_type,selection_reason:media.selection_reason,time_budget_seconds:budget,time_budget_origin:hasExplicit?'authored':budget===null?'unspecified':'deterministic_estimate'};
  });
  const totalAllocated=planned.every(item=>item.time_budget_seconds!==null)?planned.reduce((sum,item)=>sum+item.time_budget_seconds,0):null;
  return{schema_version:'1.0.0',method:'deterministic_ir_heuristics',audience_profile:audience,target_duration_seconds:total,total_allocated_seconds:totalAllocated,time_budget_status:total===null||totalAllocated===null?'unspecified':totalAllocated>total?'over_target':totalAllocated<total?'under_target':'allocated',limitations:['Narrative roles are heuristic defaults; authored narrative_role values take precedence.','Media suggestions only map existing structured elements and never search for or invent assets.','Time is an allocation estimate, not a rehearsal measurement; explicit slide budgets are preserved.','This planner does not assess factual accuracy, semantic claim support, or visual aesthetics.'],slides:planned};
}
