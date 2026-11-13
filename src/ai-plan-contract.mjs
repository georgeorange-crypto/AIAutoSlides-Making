import {parseMermaidFlowchart} from '../packages/core/mermaid-flowchart.mjs';

const TYPES=['cover','statement','bullets','closing'];
const LAYOUTS=['assertion-evidence','two-column-contrast','metric-focus','chart-and-takeaway'];
const VISUAL_KINDS=['none','local-image','architecture','process','data-figure','table'];

// Structural checks on planner output are deterministic and offline. They do not
// assess whether a diagram is attractive or whether a claim is scientifically true.
export function auditPlannerQuality(response){
  const slides=response?.slides||[];const findings=[];
  if(slides.length<6||slides.length>20)findings.push({rule_id:'PLAN-COUNT',message:'A talk must contain 6–20 slides.'});
  if(slides[0]?.type!=='cover')findings.push({rule_id:'PLAN-OPEN',message:'The first slide must establish the talk.'});
  if(slides.at(-1)?.type!=='closing')findings.push({rule_id:'PLAN-CLOSE',message:'The last slide must close with a conclusion or next step.'});
  const explain=slides.map((slide,index)=>({slide,index})).filter(x=>!['cover','closing'].includes(x.slide.type));
  for(const {slide:s,index} of explain){
    const body=(s.body||[]).map(x=>String(x).trim()).filter(Boolean);
    if(body.length<2)findings.push({rule_id:'PLAN-THIN',slide:index+1,message:`Slide ${index+1} needs at least two explanatory points.`});
    if(body.join('').length<55)findings.push({rule_id:'PLAN-DEPTH',slide:index+1,message:`Slide ${index+1} has too little explanatory content (fewer than 55 characters).`});
  }
  const visualSlides=explain.filter(({slide:s,index})=>{
    let hasMaterializedVisual=false;
    const visuals=s.visual_needs||[];
    if(visuals.filter(item=>['architecture','process'].includes(item.kind)).length>1)findings.push({rule_id:'PLAN-MULTIPLE-VISUALS',slide:index+1,message:`Slide ${index+1} requests multiple structured visuals, but this layout can materialize only one.`});
    for(const v of visuals){
      const supported=['architecture','process'].includes(v.kind),meaningful=supported&&String(v.description||'').trim().length>=20;
      const lineage=Array.isArray(v.evidence_ids)&&v.evidence_ids.length>0&&v.evidence_ids.every(id=>s.evidence_ids?.includes(id));
      let specValid=true;
      if(v.kind!=='none'&&!supported)findings.push({rule_id:'PLAN-VISUAL-UNMATERIALIZED',slide:index+1,message:`Slide ${index+1} plans ${v.kind}, which this planner cannot yet materialize as an editable local visual.`});
      if(supported&&!meaningful)findings.push({rule_id:'PLAN-VISUAL-SPEC',slide:index+1,message:`Slide ${index+1} has a visual need without a concrete 20-character description.`});
      if(supported&&!lineage)findings.push({rule_id:'PLAN-VISUAL-LINEAGE',slide:index+1,message:`Slide ${index+1} visual must cite one or more evidence IDs already linked to that slide.`});
      if(v.kind==='process'&&(!Array.isArray(v.steps)||v.steps.length<3||v.steps.length>6||v.steps.some(step=>typeof step!=='string'||step.trim().length<2||step.length>45))){specValid=false;findings.push({rule_id:'PLAN-PROCESS-SPEC',slide:index+1,message:`Slide ${index+1} process visual needs 3–6 labeled steps (2–45 characters each).`});}
      if(v.kind==='architecture'){
        if(!Array.isArray(v.nodes)||v.nodes.length<3||v.nodes.length>6||!Array.isArray(v.edges)||v.edges.length<2||v.edges.length>6){specValid=false;findings.push({rule_id:'PLAN-DIAGRAM-SPEC',slide:index+1,message:`Slide ${index+1} architecture visual needs 3–6 nodes and 2–6 directed edges.`});}
        else try{compilePlannerDiagram(v);}catch(error){specValid=false;findings.push({rule_id:'PLAN-DIAGRAM-SPEC',slide:index+1,message:`Slide ${index+1} architecture cannot be laid out: ${error.message}`});}
      }
      if(meaningful&&lineage&&specValid)hasMaterializedVisual=true;
    }
    return hasMaterializedVisual;
  });
  slides.forEach((slide,index)=>{if(['cover','closing'].includes(slide.type)&&(slide.visual_needs||[]).some(visual=>visual.kind!=='none'))findings.push({rule_id:'PLAN-BOOKEND-VISUAL',slide:index+1,message:`Slide ${index+1} requests a visual kind not supported by the cover/closing renderer.`});});
  if(explain.length&&visualSlides.length/explain.length<0.3)findings.push({rule_id:'PLAN-VISUAL-RATIO',message:`Only ${visualSlides.length}/${explain.length} explanatory slides plan a meaningful visual; minimum is 30%.`});
  let run=1;
  for(let i=1;i<slides.length;i++){
    const signature=s=>`${s.type}|${s.layout}`;
    run=signature(slides[i])===signature(slides[i-1])?run+1:1;
    if(run>=5){findings.push({rule_id:'PLAN-REPETITION',slide:i+1,message:'Five consecutive slides use the same type and layout.'});break;}
  }
  const assistant=/\b(?:you can|please note|let me|in this presentation|as an ai)\b|你可以看到|请注意|下面我将|希望这能帮助你/i;
  slides.forEach((s,i)=>{for(const text of [s.title,s.kicker,s.assertion_title,...(s.body||[])])if(assistant.test(String(text||''))){findings.push({rule_id:'PLAN-ASSISTANT-VOICE',slide:i+1,message:`Slide ${i+1} contains assistant-to-user wording.`});break;}});
  return{status:findings.length?'blocked':'pass',findings,metrics:{slide_count:slides.length,explanatory_slides:explain.length,visual_slides:visualSlides.length,visual_ratio:explain.length?visualSlides.length/explain.length:0},limits:['This audit checks text volume and declared visual plans, not visual quality, semantic relevance, scientific validity, or rendered readability.']};
}

function compilePlannerDiagram(visual){
  const nodes=visual.nodes;
  if(nodes.some(node=>!node||!/^N[1-9]\d*$/.test(node.id)||typeof node.label!=='string'||node.label.trim().length<2||node.label.length>16||/[<>\[\]{}()\r\n]/.test(node.label)))throw new Error('node IDs must be N1… and labels must be 2–16 safe plain-text characters');
  if(visual.edges.length<2||visual.edges.length>6||visual.edges.some(edge=>!edge||!nodes.some(node=>node.id===edge.from)||!nodes.some(node=>node.id===edge.to)||edge.from===edge.to||typeof edge.label!=='string'||edge.label.trim().length<2||edge.label.length>12||/[<>|\r\n]/.test(edge.label)))throw new Error('edges must connect known node IDs and state their relationship in a 2–12 character plain-text label; use 2–6 edges');
  const declarations=new Map(nodes.map(node=>[node.id,`${node.id}[${node.label}]`]));
  const lines=['flowchart LR',...visual.edges.map(edge=>`${declarations.get(edge.from)} -->|${edge.label||'leads to'}| ${declarations.get(edge.to)}`)];
  const diagram=parseMermaidFlowchart(lines.join('\n'));
  if(diagram.groups.length!==1||diagram.nodes.length!==nodes.length||diagram.edges.length!==visual.edges.length)throw new Error('diagram declarations are incomplete or duplicated');
  return diagram;
}

const strings={type:'string'};

export function createPlannerContract({audienceProfile,duration,goal,evidenceIds}){
  const visualNeed={type:'object',additionalProperties:false,required:['kind','description','evidence_ids','nodes','edges','steps'],properties:{
    kind:{type:'string',enum:VISUAL_KINDS},description:{type:'string'},evidence_ids:{type:'array',items:{type:'string'}},
    nodes:{type:'array',items:{type:'object',additionalProperties:false,required:['id','label'],properties:{id:{type:'string'},label:{type:'string'}}}},
    edges:{type:'array',items:{type:'object',additionalProperties:false,required:['from','to','label'],properties:{from:{type:'string'},to:{type:'string'},label:{type:'string'}}}},
    steps:{type:'array',items:{type:'string'}}
  }};
  const slidesSchema={type:'object',additionalProperties:false,required:['title','subtitle','narrative_structure','structure_rationale','slides'],properties:{
    title:strings,subtitle:strings,
    narrative_structure:{type:'string',enum:['problem-method-evidence-limitations-next-steps','question-hypothesis-test','problem-solution-evaluation','decision-brief']},
    structure_rationale:{type:'string'},
    slides:{type:'array',minItems:6,maxItems:20,items:{type:'object',additionalProperties:false,required:['type','title','kicker','assertion_title','body','evidence_ids','layout','visual_needs','speaker_notes'],properties:{
      type:{type:'string',enum:TYPES},title:strings,kicker:strings,assertion_title:strings,
      body:{type:'array',items:{type:'string'}},evidence_ids:{type:'array',items:{type:'string'}},
      layout:{type:'string',enum:LAYOUTS},visual_needs:{type:'array',items:visualNeed},speaker_notes:{type:'string'}
    }}}
  }};
  const policy=`Create 6 to 20 slides for audience profile ${audienceProfile}, target duration ${duration} minutes, goal: ${goal}. Select the most suitable narrative_structure from the allowed values and explain the choice briefly. Start with a cover and end with a useful conclusion or next step; leave visual_needs empty on cover and closing slides. For every explanatory slide, provide at least two concrete explanatory body items and enough detail to explain its mechanism, evidence, or implication (normally at least 55 characters total). Plan a meaningful editable local visual on at least 30% of explanatory slides, using architecture or process. For architecture, provide 3–6 nodes with stable IDs N1…N6, plain-text labels of 2–16 characters, and 2–6 directed edges with 2–12 character labels that clearly state each relationship; every visual must cite evidence IDs already linked to its slide. The local renderer computes diagram layout. For process, provide 3–6 ordered, concise steps. Fill unused nodes, edges, and steps with empty arrays. Do not request data-figure, table, or local-image visuals because this planner cannot create those yet. Vary composition and avoid five consecutive slides with the same type and layout. Use report voice, never address the user or refer to the act of presenting. For every slide provide one assertion_title, a supported layout, visual_needs, and speaker_notes suitable for presenting that page. Keep cover and closing claims modest. Use ONLY factual claims supported by the supplied brief and evidence ledger. Permitted evidence IDs: ${evidenceIds.join(', ')||'(none)'}. Cite only IDs whose ledger entries directly support the claim. Never invent numbers, sources, citations, experiments, significance, or conclusions; hypotheses and proposed future work must be explicitly labeled. The application will preserve your output as a draft with requires_human_review=true; do not label any source verified. Return exactly the required JSON schema.`;
  return {schema:slidesSchema,policy};
}

export function createPlannerDraft(response,{audienceProfile,duration,goal,theme='keynote-minimal'}){
  const slides=response.slides.map(slide=>{
    const visual=(slide.visual_needs||[]).find(item=>item.kind==='architecture'||item.kind==='process');
    if(!visual)return slide;
    if(visual.kind==='architecture')return{...slide,diagram:compilePlannerDiagram(visual),figure_description:visual.description};
    return{...slide,steps:visual.steps,figure_description:visual.description};
  });
  return {meta:{title:response.title,subtitle:response.subtitle,audience:audienceProfile,audience_profile:audienceProfile,goal,duration_minutes:duration,narrative_structure:response.narrative_structure,structure_rationale:response.structure_rationale,theme,status:'AI-GENERATED DRAFT — HUMAN REVIEW REQUIRED',draft_origin:'OpenAI Responses API',requires_human_review:true},slides};
}
import crypto from 'node:crypto';


export function createPlannerReviewRecord({inputPath,brief,schemaErrors=[],validationWarnings=[],qualityAudit,critique,numberAudit}){
  if(!critique||!numberAudit)throw new TypeError('critique and numberAudit are required');
  return{schema_version:1,review_status:'pending',source_brief:{path:inputPath,sha256:crypto.createHash('sha256').update(brief).digest('hex')},schema_errors:schemaErrors,validation_warnings:validationWarnings,quality_audit:qualityAudit||null,critic:critique,number_audit:numberAudit,required_human_checks:['Check every factual claim and citation against the source material.','Check all numeric tokens against the original records; literal overlap is not semantic verification.','Review uncertainty, limitations, audience fit, narrative and every rendered slide.','After edits, record approval or rejection with src/review-draft.mjs.']};
}
