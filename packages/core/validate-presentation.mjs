const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const HASH=/^[a-f\d]{64}$/i;
const VERIFICATION=new Set(['verified','unverified','pending','contradicted']);
const CHARTS=new Set(['bar','line','scatter','cdf']);
const text=value=>typeof value==='string'&&value.trim().length>0;
const unique=(items,key)=>{
  const seen=new Set();
  for(const item of items){const value=item?.[key];if(!text(value)||!ID.test(value))return `Each ${key} must be a non-empty stable identifier`;if(seen.has(value))return `Duplicate ${key} '${value}'`;seen.add(value);}
  return null;
};

export function validatePresentationIR(ir){
  const errors=[],warnings=[];
  if(!ir||typeof ir!=='object'||Array.isArray(ir))return{valid:false,errors:['Presentation IR must be an object'],warnings:[]};
  if(ir.schema_version!=='1.0.0')errors.push("schema_version must be '1.0.0'");
  if(!ir.meta||typeof ir.meta!=='object'||Array.isArray(ir.meta))errors.push('meta must be an object');
  if(!Array.isArray(ir.slides)||ir.slides.length===0)errors.push('slides must be a non-empty array');
  const sourceIR=ir.source_ir;
  if(sourceIR?.schema_version!=='1.0.0'||!Array.isArray(sourceIR.sources))errors.push("source_ir must have schema_version '1.0.0' and sources[]");
  const sources=Array.isArray(sourceIR?.sources)?sourceIR.sources:[],sourceError=unique(sources,'source_id');
  if(sourceError)errors.push(sourceError);
  const sourceById=new Map();
  for(const source of sources){
    if(!VERIFICATION.has(source?.verification_status))errors.push(`Source '${source?.source_id||'(missing id)'}' has invalid verification_status`);
    if(source?.sha256!==undefined&&source.sha256!==null&&!HASH.test(source.sha256))errors.push(`Source '${source.source_id}' sha256 must contain 64 hexadecimal characters`);
    if(source?.uri!==undefined&&source.uri!==null&&typeof source.uri!=='string')errors.push(`Source '${source.source_id}' uri must be a string or null`);
    if(text(source?.source_id))sourceById.set(source.source_id,source);
  }
  const evidenceRecords=sourceIR?.evidence===undefined?[]:sourceIR.evidence,claims=sourceIR?.claims===undefined?[]:sourceIR.claims;
  if(!Array.isArray(evidenceRecords))errors.push('source_ir.evidence must be an array when supplied');
  if(!Array.isArray(claims))errors.push('source_ir.claims must be an array when supplied');
  const evidenceList=Array.isArray(evidenceRecords)?evidenceRecords:[],evidenceError=unique(evidenceList,'evidence_id');if(evidenceError)errors.push(evidenceError);
  const evidenceById=new Map();
  for(const evidence of evidenceList){
    if(sourceById.has(evidence?.evidence_id))errors.push(`Evidence ID '${evidence.evidence_id}' duplicates a source_id`);
    if(!sourceById.has(evidence?.source_id))errors.push(`Evidence '${evidence?.evidence_id||'(missing id)'}' refers to unknown source ID '${evidence?.source_id}'`);
    if(!text(evidence?.excerpt))errors.push(`Evidence '${evidence?.evidence_id||'(missing id)'}' requires excerpt`);
    if(!VERIFICATION.has(evidence?.verification_status))errors.push(`Evidence '${evidence?.evidence_id||'(missing id)'}' has invalid verification_status`);
    if(text(evidence?.evidence_id))evidenceById.set(evidence.evidence_id,evidence);
  }
  const claimList=Array.isArray(claims)?claims:[],claimError=unique(claimList,'claim_id');if(claimError)errors.push(claimError);
  for(const claim of claimList){
    if(!text(claim?.statement))errors.push(`Claim '${claim?.claim_id||'(missing id)'}' requires statement`);
    if(!['pending','verified','contradicted'].includes(claim?.review_status))errors.push(`Claim '${claim?.claim_id||'(missing id)'}' has invalid review_status`);
    if(!Array.isArray(claim?.evidence_ids))errors.push(`Claim '${claim?.claim_id||'(missing id)'}' evidence_ids must be an array`);
    else for(const evidenceId of claim.evidence_ids)if(!evidenceById.has(evidenceId)&&!sourceById.has(evidenceId))errors.push(`Claim '${claim.claim_id}' refers to unknown evidence ID '${evidenceId}'`);
  }
  const assets=ir.assets===undefined?[]:ir.assets;
  if(!Array.isArray(assets))errors.push('assets must be an array when supplied');
  const assetList=Array.isArray(assets)?assets:[],assetError=unique(assetList,'asset_id');if(assetError)errors.push(assetError);
  const assetById=new Map();
  for(const asset of assetList){
    if(!text(asset?.media_type))errors.push(`Asset '${asset?.asset_id||'(missing id)'}' requires media_type`);
    if(!['approved','pending','restricted','unknown'].includes(asset?.rights_status))errors.push(`Asset '${asset?.asset_id||'(missing id)'}' has invalid rights_status`);
    if(asset?.sha256!==undefined&&asset.sha256!==null&&!HASH.test(asset.sha256))errors.push(`Asset '${asset.asset_id}' sha256 must contain 64 hexadecimal characters`);
    if(asset?.source_id&&!sourceById.has(asset.source_id))errors.push(`Asset '${asset.asset_id}' refers to unknown source ID '${asset.source_id}'`);
    if(asset?.uri!==undefined&&asset.uri!==null&&typeof asset.uri!=='string')errors.push(`Asset '${asset?.asset_id||'(missing id)'}' uri must be a local path string or null`);
    if(text(asset?.asset_id))assetById.set(asset.asset_id,asset);
  }
  const slides=Array.isArray(ir.slides)?ir.slides:[],slideError=unique(slides,'slide_id');if(slideError)errors.push(slideError);
  for(const slide of slides){
    const sid=slide?.slide_id||'(missing slide_id)';
    if(!text(slide?.type))errors.push(`${sid}: type must be a non-empty string`);
    if(!text(slide?.title))errors.push(`${sid}: title must be a non-empty string`);
    if(!Array.isArray(slide?.evidence_ids))errors.push(`${sid}: evidence_ids must be an array`);
    if(!Array.isArray(slide?.elements))errors.push(`${sid}: elements must be an array`);
    const refs=Array.isArray(slide?.evidence_ids)?slide.evidence_ids:[];
    for(const ref of refs){if(typeof ref!=='string'||(!sourceById.has(ref)&&!evidenceById.has(ref)))errors.push(`${sid}: unknown source/evidence ID '${ref}'`);}
    if(slide?.asset_ids!==undefined&&!Array.isArray(slide.asset_ids))errors.push(`${sid}: asset_ids must be an array`);
    for(const assetId of Array.isArray(slide?.asset_ids)?slide.asset_ids:[])if(typeof assetId!=='string'||!assetById.has(assetId))errors.push(`${sid}: unknown asset ID '${assetId}'`);
    if(slide?.type!=='cover'&&slide?.type!=='closing'&&refs.length===0)warnings.push(`${sid}: no source/evidence ID; confirm all content is non-factual or add provenance`);
    const elements=Array.isArray(slide?.elements)?slide.elements:[],elementError=unique(elements,'element_id');if(elementError)errors.push(`${sid}: ${elementError}`);
    for(const element of elements){
      const eid=element?.element_id||'(missing element_id)',kind=element?.kind;
      if(!text(kind))errors.push(`${sid}/${eid}: kind must be a non-empty string`);
      const elementRefs=element?.source_ids===undefined?refs:element.source_ids;
      if(!Array.isArray(elementRefs))errors.push(`${sid}/${eid}: source_ids must be an array`);
      else for(const ref of elementRefs)if(typeof ref!=='string'||(!sourceById.has(ref)&&!evidenceById.has(ref)))errors.push(`${sid}/${eid}: unknown source/evidence ID '${ref}'`);
      if(kind==='text'&&!text(element.text??element.value))errors.push(`${sid}/${eid}: text requires non-empty text or value`);
      if(kind==='bullets'&&(!Array.isArray(element.items)||!element.items.length||element.items.some(item=>!(typeof item==='string'||typeof item==='number'))))errors.push(`${sid}/${eid}: bullets requires non-empty string/number items[]`);
      if(kind==='table'){
        if(!Array.isArray(element.headers)||element.headers.length<2||element.headers.length>6||element.headers.some(item=>!text(item)||item.length>45))errors.push(`${sid}/${eid}: table requires 2–6 non-empty headers of at most 45 characters`);
        if(!Array.isArray(element.rows)||!element.rows.length||element.rows.length>10||element.rows.some(row=>!Array.isArray(row)||row.length!==element.headers?.length||row.some(cell=>!(typeof cell==='string'&&cell.length<=90||typeof cell==='number'&&Number.isFinite(cell)))))errors.push(`${sid}/${eid}: table rows must have 1–10 rows matching headers and finite numeric or bounded string cells`);
      }
      if(kind==='cards'&&(!Array.isArray(element.items)||element.items.length<2||element.items.length>4||element.items.some(card=>!text(card?.title)||!text(card?.body))))errors.push(`${sid}/${eid}: cards requires 2–4 items with title and body`);
      if(kind==='callout'&&!text(element.text??element.value))errors.push(`${sid}/${eid}: callout requires non-empty text`);
      if(kind==='image'){
        if(!assetById.has(element.asset_id))errors.push(`${sid}/${eid}: image refers to unknown asset ID '${element.asset_id||''}'`);
        if(!text(element.alt))errors.push(`${sid}/${eid}: image requires descriptive alt text`);
        if(![element.x,element.y,element.w,element.h].every(Number.isFinite)||element.x<0||element.y<0||element.w<=0||element.h<=0||element.x+element.w>13.333||element.y+element.h>7.5)errors.push(`${sid}/${eid}: image requires positive x/y/w/h within 16:9 slide bounds`);
      }
      if(kind==='process'){
        const steps=element.steps??element.items;
        if(!Array.isArray(steps)||steps.length<2||steps.length>6||steps.some(step=>!(text(step)||text(step?.title))))errors.push(`${sid}/${eid}: process requires 2–6 steps with a title`);
      }
      if(kind==='mermaid'&&!text(element.source))errors.push(`${sid}/${eid}: mermaid requires source`);
      if(kind==='process'){
        const steps=element.steps??element.items;
        if(!Array.isArray(steps)||steps.length<2||steps.length>6||steps.some(step=>!text(typeof step==='string'?step:step?.title)||String(typeof step==='string'?step:step.title).length>45))errors.push(`${sid}/${eid}: process requires 2–6 labeled steps of at most 45 characters`);
      }
      if(kind==='diagram'){
        const groups=element.groups,nodes=element.nodes,edges=element.edges,inside=box=>box&&[box.x,box.y,box.w,box.h].every(Number.isFinite)&&box.x>=0&&box.y>=2.35&&box.w>0&&box.h>0&&box.x+box.w<=13.333&&box.y+box.h<=6.85;
        if(!Array.isArray(groups)||!groups.length||!Array.isArray(nodes)||nodes.length<2||nodes.length>12||!Array.isArray(edges)||!edges.length)errors.push(`${sid}/${eid}: diagram requires labeled groups, 2–12 nodes, and at least one edge`);
        else{
          for(const [index,group] of groups.entries())if(!text(group?.label)||!inside(group))errors.push(`${sid}/${eid}: diagram group ${index} requires a label and in-bounds geometry`);
          const nodeIds=new Set();
          for(const [index,node] of nodes.entries()){
            if(!text(node?.id)||nodeIds.has(node.id)||!text(node?.label)||node.label.length>65||node.shape!==undefined&&!['rect','roundRect','diamond'].includes(node.shape)||!inside(node))errors.push(`${sid}/${eid}: diagram node ${index} requires a unique ID, bounded label, supported shape, and in-bounds geometry`);
            if(text(node?.id))nodeIds.add(node.id);
          }
          for(const [index,edge] of edges.entries())if(!nodeIds.has(edge?.from)||!nodeIds.has(edge?.to)||edge.from===edge.to)errors.push(`${sid}/${eid}: diagram edge ${index} must connect two distinct known nodes`);
        }
        if(slide?.type!=='architecture')errors.push(`${sid}/${eid}: diagram elements require slide type 'architecture'`);
      }
      if(kind==='chart'){
        if(!CHARTS.has(element.chart_kind))errors.push(`${sid}/${eid}: unsupported chart_kind '${element.chart_kind}'`);
        if(!Array.isArray(element.x_values)||element.x_values.length<2||element.x_values.some(value=>!Number.isFinite(value)))errors.push(`${sid}/${eid}: chart x_values must contain at least two finite numbers`);
        if(!text(element.x_axis_label)||!text(element.y_axis_label))errors.push(`${sid}/${eid}: chart requires x_axis_label and y_axis_label`);
        if(!Array.isArray(element.series)||!element.series.length||element.series.some(series=>!text(series?.name)||!Array.isArray(series.values)||series.values.length!==element.x_values?.length||series.values.some(value=>!Number.isFinite(value))))errors.push(`${sid}/${eid}: chart series must be named, finite, and aligned with x_values`);
        if((element.source_ids??refs).length===0)errors.push(`${sid}/${eid}: chart requires source/evidence IDs`);
        if(element.chart_kind==='cdf'&&Array.isArray(element.series))for(const series of element.series)if(series.values.some((value,index)=>value<0||value>1||(index>0&&value<series.values[index-1])))errors.push(`${sid}/${eid}: CDF probabilities must be bounded [0,1] and nondecreasing`);
      }
      const supported=new Set(['text','bullets','table','cards','callout','image','chart','mermaid','process','diagram']);
      if(kind&&!supported.has(kind))errors.push(`${sid}/${eid}: unsupported element kind '${kind}'`);
    }
    if(refs.length)for(const ref of refs){const source=sourceById.get(ref),evidence=evidenceById.get(ref),verification=source?.verification_status||evidence?.verification_status;if(verification&&verification!=='verified')warnings.push(`${source?'Source':'Evidence'} ${ref} remains ${verification}; IR validation does not verify it`);}
  }
  return{valid:errors.length===0,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}

export function assertValidPresentationIR(ir){
  const result=validatePresentationIR(ir);
  if(!result.valid)throw new Error(`Presentation IR validation failed: ${result.errors.join('; ')}`);
  return result;
}
