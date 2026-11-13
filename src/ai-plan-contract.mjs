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
  const visualSlides=explain.filter(({slide:s,index})=>(s.visual_needs||[]).some(v=>{
    const meaningful=v.kind!=='none'&&String(v.description||'').trim().length>=20;
    if(v.kind!=='none'&&!meaningful)findings.push({rule_id:'PLAN-VISUAL-SPEC',slide:index+1,message:`Slide ${index+1} has a visual need without a concrete 20-character description.`});
    return meaningful;
  }));
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

const strings={type:'string'};

export function createPlannerContract({audienceProfile,duration,goal,evidenceIds}){
  const visualNeed={type:'object',additionalProperties:false,required:['kind','description','evidence_ids'],properties:{
    kind:{type:'string',enum:VISUAL_KINDS},description:{type:'string'},evidence_ids:{type:'array',items:{type:'string'}}
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
  const policy=`Create 6 to 20 slides for audience profile ${audienceProfile}, target duration ${duration} minutes, goal: ${goal}. Select the most suitable narrative_structure from the allowed values and explain the choice briefly. Start with a cover and end with a useful conclusion or next step. For every explanatory slide, provide at least two concrete explanatory body items and enough detail to explain its mechanism, evidence, or implication (normally at least 55 characters total). Plan a meaningful visual on at least 30% of explanatory slides (architecture, process, data-figure, table, or local-image); explain what the visual communicates. Vary composition and avoid five consecutive slides with the same type and layout. Use report voice, never address the user or refer to the act of presenting. For every slide provide one assertion_title, a supported layout, visual_needs, and speaker_notes suitable for presenting that page. Keep cover and closing claims modest. Use ONLY factual claims supported by the supplied brief and evidence ledger. Permitted evidence IDs: ${evidenceIds.join(', ')||'(none)'}. Cite only IDs whose ledger entries directly support the claim. Never invent numbers, sources, citations, experiments, significance, or conclusions; hypotheses and proposed future work must be explicitly labeled. A data-figure need is only a recommendation: do not supply chart values or imply data exists unless it is present in the source brief. The application will preserve your output as a draft with requires_human_review=true; do not label any source verified. Return exactly the required JSON schema.`;
  return {schema:slidesSchema,policy};
}

export function createPlannerDraft(response,{audienceProfile,duration,goal,theme='keynote-minimal'}){
  return {meta:{title:response.title,subtitle:response.subtitle,audience:audienceProfile,audience_profile:audienceProfile,goal,duration_minutes:duration,narrative_structure:response.narrative_structure,structure_rationale:response.structure_rationale,theme,status:'AI-GENERATED DRAFT — HUMAN REVIEW REQUIRED',draft_origin:'OpenAI Responses API',requires_human_review:true},slides:response.slides};
}
import crypto from 'node:crypto';


export function createPlannerReviewRecord({inputPath,brief,schemaErrors=[],validationWarnings=[],qualityAudit,critique,numberAudit}){
  if(!critique||!numberAudit)throw new TypeError('critique and numberAudit are required');
  return{schema_version:1,review_status:'pending',source_brief:{path:inputPath,sha256:crypto.createHash('sha256').update(brief).digest('hex')},schema_errors:schemaErrors,validation_warnings:validationWarnings,quality_audit:qualityAudit||null,critic:critique,number_audit:numberAudit,required_human_checks:['Check every factual claim and citation against the source material.','Check all numeric tokens against the original records; literal overlap is not semantic verification.','Review uncertainty, limitations, audience fit, narrative and every rendered slide.','After edits, record approval or rejection with src/review-draft.mjs.']};
}
