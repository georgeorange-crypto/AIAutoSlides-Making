const TYPES=['cover','statement','bullets','closing'];
const LAYOUTS=['assertion-evidence','two-column-contrast','metric-focus','chart-and-takeaway'];
const VISUAL_KINDS=['none','local-image','architecture','process','data-figure','table'];

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
  const policy=`Create 6 to 20 slides for audience profile ${audienceProfile}, target duration ${duration} minutes, goal: ${goal}. Select the most suitable narrative_structure from the allowed values and explain the choice briefly. For every slide provide one assertion_title, a supported layout, any visual_needs, and speaker_notes suitable for presenting that page. Keep cover and closing claims modest. Use ONLY factual claims supported by the supplied brief and evidence ledger. Permitted evidence IDs: ${evidenceIds.join(', ')||'(none)'}. Cite only IDs whose ledger entries directly support the claim. Never invent numbers, sources, citations, experiments, significance, or conclusions; hypotheses and proposed future work must be explicitly labeled. A data-figure need is only a recommendation: do not supply chart values or imply data exists unless it is present in the source brief. Set unneeded visual_needs to an empty array. The application will preserve your output as a draft with requires_human_review=true; do not label any source verified. Return exactly the required JSON schema.`;
  return {schema:slidesSchema,policy};
}

export function createPlannerDraft(response,{audienceProfile,duration,goal,theme='keynote-minimal'}){
  return {meta:{title:response.title,subtitle:response.subtitle,audience:audienceProfile,audience_profile:audienceProfile,goal,duration_minutes:duration,narrative_structure:response.narrative_structure,structure_rationale:response.structure_rationale,theme,status:'AI-GENERATED DRAFT — HUMAN REVIEW REQUIRED',draft_origin:'OpenAI Responses API',requires_human_review:true},slides:response.slides};
}
