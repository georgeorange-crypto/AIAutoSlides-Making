import {classifyImportance} from './importance.mjs';

const VISUAL_KINDS=new Set(['image','chart','table','diagram','mermaid','process','cards']);
const AGENDA_ROLE=/^(agenda|contents|table[_ -]?of[_ -]?contents|目录)$/i;
const SECTION_ROLE=/^(section[_ -]?transition|section)$/i;
const TRANSITION_ROLE=/^(cover|opening(?:[_ -].*)?|agenda|contents|table[_ -]?of[_ -]?contents|目录|section(?:[_ -]?transition)?|transition|closing|conclusion|summary)$/i;
const ASSISTANT_VOICE=/(?:\b(?:you can|your task|please provide|let me know|tell me|in this presentation you)\b|你可以|您可以|请告诉我|告诉我|如果你|如果您|你需要|您需要|我建议你|我建议您|接下来我将|下面我将)/iu;
const CAVEAT_CLAUSE=/(?:\b(?:does not|doesn't|do not|don't|cannot|can't|should not|shouldn't|is not|isn't|are not|aren't)\s+(?:prove|show|mean|imply|establish|demonstrate|represent|indicate|guarantee|confirm|measure|capture|constitute|replace|cover)\b|\bnot\s+(?:necessarily|evidence of|proof of|a measure of|intended to|a guarantee)\b|\b(?:no claim is made|should not be interpreted|cannot be interpreted)\b|不代表|不表明|不意味着|并不意味着|不能证明|无法证明|不能说明|无法说明|不构成|不可据此|不应(?:被)?解读为|不宜解读为)/iu;
const VISUAL_WORDS=/(?:image|illustration|photo|figure|chart|diagram|architecture|process|table|图|照片|插图|示意|图表|架构|流程|表格|原图)/iu;
const CJK=/\p{Script=Han}/u;

function textOfElement(element){
  const values=[element.text,element.value,element.caption,element.description,element.takeaway,element.x_axis_label,element.y_axis_label];
  for(const item of element.items||[])values.push(typeof item==='string'?item:item?.title,item?.value,item?.body,item?.detail);
  values.push(...(element.headers||[]));for(const row of element.rows||[])values.push(...row);
  for(const node of element.nodes||[])values.push(node.label);for(const group of element.groups||[])values.push(group.label);
  for(const edge of element.edges||[])values.push(edge.label);for(const step of element.steps||[])values.push(typeof step==='string'?step:step?.title,typeof step==='object'?step?.detail:null);
  for(const series of element.series||[])values.push(series.name);
  return values.filter(value=>typeof value==='string'&&value.trim());
}
function units(text){const han=[...text].filter(char=>CJK.test(char)).length,latin=(text.match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu)||[]).filter(token=>!CJK.test(token)).length;return han+latin;}
function caveatClauses(text){return String(text||'').split(/[.!?。！？；;\n]+/u).map(clause=>clause.trim()).filter(clause=>CAVEAT_CLAUSE.test(clause));}
function isTransition(planned){return TRANSITION_ROLE.test(planned?.narrative_role||'');}
function issue(code,slideId,message,details={}){return{code,slide_id:slideId||'DECK',message,...details};}

/** Deterministic hard checks for formal decks. This is a screening gate, not an aesthetic or factual judge. */
export function auditDeckQuality({plan,presentationIR,renderedQa,imageReview,contentPlan}){
  const blockers=[],warnings=[],contract=plan?.quality_contract||{},plannedSlides=plan?.slides||[],byId=new Map(plannedSlides.map(slide=>[slide.slide_id,slide]));
  if(!renderedQa||!Array.isArray(renderedQa.slides))blockers.push(issue('QUALITY_RENDER_QA_MISSING','DECK','Rendered OOXML QA details are missing; formal quality checks cannot run.'));
  if(renderedQa?.status==='fail'||renderedQa?.errors?.length)blockers.push(issue('QUALITY_STRUCTURAL_QA_FAILED','DECK','Structural PPTX QA has blocking errors.',{errors:renderedQa.errors||[]}));
  if(!imageReview||!Array.isArray(imageReview.pages)||imageReview.status==='not_rendered')blockers.push(issue('QUALITY_RENDER_SCREEN_BLOCKED','DECK','Rendered page images are missing; every page must have a rendered-image screen.',{status:imageReview?.status||'missing'}));
  for(const page of imageReview?.pages||[]){if(page.status==='missing_page_image')blockers.push(issue('QUALITY_RENDER_PAGE_MISSING',page.slide_id,'Rendered page image is missing.',{page:page.page}));else if(page.status==='ocr_failed'||page.status==='no_expected_text')warnings.push(issue('QUALITY_OCR_INCOMPLETE',page.slide_id,'OCR could not fully screen authored text; human page inspection remains required.',{status:page.status}));else if(page.status==='low_text_coverage')warnings.push(issue('QUALITY_OCR_COVERAGE_LOW',page.slide_id,'OCR detected less than the expected authored text; confirm it is visible in the rendered page.',{coverage:page.coverage}));}
  const slides=presentationIR?.slides||[],content=[],repeatedCaveats=new Map();
  const sections=Array.isArray(contract.narrative_sections)?contract.narrative_sections:[];
  const expectedSlideCount=Number.isInteger(plan?.task?.expected_slide_count)?plan.task.expected_slide_count:plannedSlides.length;
  const isFullDeck=slides.length===expectedSlideCount&&slides.length===plannedSlides.length;
  if(!isFullDeck)warnings.push(issue('QUALITY_NARRATIVE_STRUCTURE_DEFERRED','DECK','This run is a representative-slide subset; complete agenda and section checks are deferred to the full-deck run.',{planned_slide_count:expectedSlideCount,rendered_slide_count:slides.length}));
  else{
    const agendaPlans=plannedSlides.filter(slide=>AGENDA_ROLE.test(slide.narrative_role||''));
    if(agendaPlans.length!==1)blockers.push(issue('QUALITY_AGENDA_PLAN','DECK',`The approved plan must contain exactly one agenda slide; found ${agendaPlans.length}.`));
    else{
      const agendaIR=slides.find(slide=>slide.slide_id===agendaPlans[0].slide_id);
      const agendaCopy=[agendaIR?.title,...(agendaIR?.elements||[]).flatMap(textOfElement)].filter(Boolean).join('\n').normalize('NFC').toLocaleLowerCase();
      if(!agendaIR||sections.some(section=>!agendaCopy.includes(String(section).normalize('NFC').toLocaleLowerCase())))blockers.push(issue('QUALITY_AGENDA_CONTENT','DECK','The rendered IR agenda is missing or does not visibly list every planned narrative section.',{slide_id:agendaPlans[0].slide_id,missing_sections:sections.filter(section=>!agendaCopy.includes(String(section).normalize('NFC').toLocaleLowerCase()))}));
    }
    for(const section of sections){
      const transitions=plannedSlides.filter(slide=>SECTION_ROLE.test(slide.narrative_role||'')&&slide.section_name===section);
      const contentPlans=plannedSlides.filter(slide=>slide.section_name===section&&!AGENDA_ROLE.test(slide.narrative_role||'')&&!SECTION_ROLE.test(slide.narrative_role||'')&&!/^(cover|opening|closing|conclusion|summary)$/i.test(slide.narrative_role||''));
      if(transitions.length!==1)blockers.push(issue('QUALITY_SECTION_TRANSITION_PLAN','DECK',`Planned section "${section}" must have exactly one transition slide.`,{section,slide_ids:transitions.map(slide=>slide.slide_id)}));
      else{
        const transition=slides.find(slide=>slide.slide_id===transitions[0].slide_id);
        const heading=[transition?.title,transition?.assertion_title,...(transition?.elements||[]).flatMap(textOfElement)].filter(Boolean).join('\n').normalize('NFC').toLocaleLowerCase();
        if(!transition||!heading.includes(String(section).normalize('NFC').toLocaleLowerCase()))blockers.push(issue('QUALITY_SECTION_TRANSITION_CONTENT',transitions[0].slide_id,`Section transition does not visibly name "${section}".`,{section}));
        const transitionUnits=(transition?.elements||[]).flatMap(textOfElement).join('\n');
        if(units(transitionUnits)<18)blockers.push(issue('QUALITY_SECTION_TRANSITION_TOO_THIN',transitions[0].slide_id,'Section transition needs at least 18 visible text units of orientation beyond its heading.',{section,text_units:units(transitionUnits),minimum:18,recommendation:'Add a concise explanation of the section question, mechanism, or takeaway so the transition does real audience work.'}));
      }
      if(!contentPlans.length)blockers.push(issue('QUALITY_SECTION_CONTENT_PLAN','DECK',`Planned section "${section}" has no assigned content slides.`,{section}));
      else if(contentPlans.every(item=>!slides.some(slide=>slide.slide_id===item.slide_id)))blockers.push(issue('QUALITY_SECTION_CONTENT_MISSING','DECK',`No rendered IR content slide is present for section "${section}".`,{section,slide_ids:contentPlans.map(slide=>slide.slide_id)}));
    }
  }
  for(const [index,slide] of slides.entries()){
    const planned=byId.get(slide.slide_id),role=planned?.narrative_role||slide.role||'',elements=slide.elements||[],elementTexts=elements.flatMap(textOfElement),visible=[slide.title,slide.assertion_title,slide.kicker,...elementTexts].filter(value=>typeof value==='string').join('\n'),explanation=elementTexts.join('\n'),slideUnits=units(explanation),hasVisual=elements.some(element=>VISUAL_KINDS.has(element.kind)),id=slide.slide_id;
    if(!isTransition({narrative_role:role}))content.push({slide,planned,index,visible,elementTexts,slideUnits,hasVisual});
    if(!isTransition({narrative_role:role})){
      const clauses=caveatClauses(visible);
      if(clauses.length>=3)blockers.push(issue('QUALITY_CAVEAT_OVERLOAD',id,`${clauses.length} disclaimer-style clauses appear on one content slide; consolidate them and keep only caveats needed to interpret that page.`,{caveat_clause_count:clauses.length,recommendation:'Keep only caveats needed to interpret this page; state broader study limitations once, concisely, where they best support interpretation.'}));
      for(const clause of clauses){const normalized=clause.normalize('NFC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');if(!normalized)continue;const owners=repeatedCaveats.get(normalized)||new Set();owners.add(id);repeatedCaveats.set(normalized,owners);}
    }
    if(ASSISTANT_VOICE.test(visible))blockers.push(issue('QUALITY_ASSISTANT_VOICE',id,'Visible copy reads like instructions or a conversation with the user.',{recommendation:'Rewrite it as presentation content addressed to the audience without assistant-to-user phrasing.'}));
    if(CJK.test(contract.language||'')||/chinese|中文|简体|繁體/i.test(contract.language||'')){
      for(const text of [slide.title,slide.assertion_title,...elementTexts].filter(value=>typeof value==='string')){
        const latinWords=(text.match(/[A-Za-z][A-Za-z0-9'’.-]*/g)||[]).length,han=[...text].filter(char=>CJK.test(char)).length;
        if(latinWords>=16&&han<8)blockers.push(issue('QUALITY_LONG_ENGLISH_BLOCK',id,'A Chinese deck contains a long English-only text block.',{excerpt:text.slice(0,120),latin_words:latinWords,recommendation:'Translate or substantially explain the passage in natural Chinese; keep only necessary technical terms in English.'}));
      }
    }
    const qa=renderedQa?.slides?.[index];
    if(qa){
      if(qa.textBoundsPass===false||Array.isArray(qa.textBounds)&&qa.textBounds.some(bound=>!bound.ok))blockers.push(issue('QUALITY_TEXT_OUT_OF_BOUNDS',id,'Rendered text extends beyond the slide canvas.'));
      if(Array.isArray(qa.elementBounds)&&qa.elementBounds.some(bound=>!bound.ok))blockers.push(issue('QUALITY_OBJECT_OUT_OF_BOUNDS',id,'A rendered object extends beyond the slide canvas.'));
      for(const overlap of qa.textOverlaps||[])blockers.push(issue('QUALITY_TEXT_OVERLAP',id,'Rendered text boxes overlap.',{objects:[overlap.shape_a,overlap.shape_b],text:[overlap.text_a,overlap.text_b]}));
      for(const small of qa.smallText||[])if(Number(small.min_font_size_pt)<12)blockers.push(issue('QUALITY_TEXT_TOO_SMALL',id,'Authored text below 12 pt is blocked, including text placed in the footer area.',{font_size_pt:small.min_font_size_pt,shape:small.shape,text:small.text,position:{x:small.x,y:small.y,w:small.w,h:small.h}}));
      for(const unknown of qa.unmeasuredText||[])blockers.push(issue('QUALITY_TEXT_SIZE_UNMEASURED',id,'Authored text has no explicit measurable font size; it cannot pass the readability gate by silently inheriting an unknown style.',{shape:unknown.shape,text:unknown.text,position:{x:unknown.x,y:unknown.y,w:unknown.w,h:unknown.h}}));
    }
  }
  for(const owners of repeatedCaveats.values())if(owners.size>=3)blockers.push(issue('QUALITY_CAVEAT_REPETITION',[...owners][0],`The same disclaimer-style clause is repeated on ${owners.size} content slides.`,{slide_ids:[...owners],repetition_count:owners.size,recommendation:'State a shared limitation once, then use each page for the evidence, mechanism, or implication that matters there.'}));
  let priorityAllocation=null;
  if(isFullDeck){
    const ranked=content.map(item=>({...item,importanceBand:classifyImportance(item.planned?.importance)})),unranked=ranked.filter(item=>!item.importanceBand);
    for(const item of unranked)blockers.push(issue('QUALITY_IMPORTANCE_UNRANKED',item.slide.slide_id,'This content slide has no recognized importance level, so emphasis allocation cannot be audited.'));
    const priority=ranked.filter(item=>item.importanceBand==='priority'),prioritySlideShare=content.length?priority.length/content.length:1,minimumPrioritySlideShare=Number(contract.minimum_priority_slide_share);
    if(!Number.isFinite(minimumPrioritySlideShare))blockers.push(issue('QUALITY_PRIORITY_SHARE_UNSET','DECK','The approved quality contract must set minimum_priority_slide_share between 0.25 and 0.75.'));
    else if(prioritySlideShare<minimumPrioritySlideShare)blockers.push(issue('QUALITY_PRIORITY_SLIDE_SHARE','DECK',`Only ${(prioritySlideShare*100).toFixed(1)}% of content slides are assigned core/high importance; the plan requires at least ${(minimumPrioritySlideShare*100).toFixed(1)}%.`,{priority_slide_ids:priority.map(item=>item.slide.slide_id),content_slide_count:content.length,priority_slide_count:priority.length,actual_share:Number(prioritySlideShare.toFixed(3)),minimum_share:minimumPrioritySlideShare,recommendation:'Expand the central mechanisms and results into a larger share of the page map; merge or remove low-priority detail pages.'}));
    const times=new Map((contentPlan?.slides||[]).map(slide=>[slide.slide_id,slide.time_budget_seconds])),measured=ranked.map(item=>({item,seconds:Number(times.get(item.slide.slide_id))})),unmeasured=measured.filter(entry=>!Number.isFinite(entry.seconds)||entry.seconds<=0);
    if(unmeasured.length)blockers.push(issue('QUALITY_PRIORITY_TIME_UNMEASURED','DECK','Core-versus-supporting talk-time allocation cannot be audited because one or more content slides have no positive time budget.',{slide_ids:unmeasured.map(entry=>entry.item.slide.slide_id),recommendation:'Set a target talk duration in the approved deck plan or provide explicit positive time budgets for every content slide.'}));
    else{
      const contentSeconds=measured.reduce((sum,entry)=>sum+entry.seconds,0),prioritySeconds=measured.filter(entry=>entry.item.importanceBand==='priority').reduce((sum,entry)=>sum+entry.seconds,0),priorityTimeShare=contentSeconds?prioritySeconds/contentSeconds:1,minimumPriorityTimeShare=Number(contract.minimum_priority_time_share);
      if(!Number.isFinite(minimumPriorityTimeShare))blockers.push(issue('QUALITY_PRIORITY_TIME_SHARE_UNSET','DECK','The approved quality contract must set minimum_priority_time_share between 0.50 and 0.90.'));
      else if(priorityTimeShare<minimumPriorityTimeShare)blockers.push(issue('QUALITY_PRIORITY_TIME_SHARE','DECK',`Core/high-importance content receives ${(priorityTimeShare*100).toFixed(1)}% of planned explanation time; the plan requires at least ${(minimumPriorityTimeShare*100).toFixed(1)}%.`,{priority_seconds:prioritySeconds,content_seconds:contentSeconds,actual_share:Number(priorityTimeShare.toFixed(3)),minimum_share:minimumPriorityTimeShare,recommendation:'Give the central mechanisms and findings more explanation time, or reduce time spent on supporting details.'}));
      priorityAllocation={priority_slide_count:priority.length,content_slide_count:content.length,priority_slide_share:Number(prioritySlideShare.toFixed(3)),minimum_priority_slide_share:minimumPrioritySlideShare,priority_time_seconds:prioritySeconds,content_time_seconds:contentSeconds,priority_time_share:Number(priorityTimeShare.toFixed(3)),minimum_priority_time_share:minimumPriorityTimeShare};
    }
  }
  const minimumUnits=Number(contract.minimum_explanation_units),minimumVisualRatio=Number(contract.visual_slide_ratio_min);
  for(const item of content){if(item.slideUnits<minimumUnits)blockers.push(issue('QUALITY_CONTENT_TOO_THIN',item.slide.slide_id,`Visible explanatory copy has ${item.slideUnits} text units; the plan requires at least ${minimumUnits}.`,{text_units:item.slideUnits,minimum:minimumUnits,recommendation:'Explain the mechanism, evidence, or implication on the slide; do not count speaker notes as visible explanation.'}));const page=imageReview?.pages?.find(candidate=>candidate.slide_id===item.slide.slide_id),occupancy=page?.visible_text_occupancy_ratio,lineCount=page?.visible_text_line_count,minimum=item.hasVisual?0.012:0.045;if(!Number.isFinite(occupancy)||!Number.isInteger(lineCount))blockers.push(issue('QUALITY_VISIBLE_DENSITY_UNMEASURED',item.slide.slide_id,'Rendered body-text density could not be measured; a page cannot pass on authored text units alone.',{recommendation:'Provide page OCR word bounds and matching slide geometry, then inspect the rendered page.'}));else if(occupancy<minimum||(!item.hasVisual&&lineCount<2))blockers.push(issue('QUALITY_VISIBLE_DENSITY_LOW',item.slide.slide_id,`Visible body text occupies ${(occupancy*100).toFixed(2)}% of the content region across ${lineCount} detected line(s); this page needs more visible explanation or a meaningful visual.`,{visible_text_occupancy_ratio:occupancy,visible_text_line_count:lineCount,minimum_ratio:minimum,minimum_line_count:item.hasVisual?null:2,structured_visual_planned:item.hasVisual,recommendation:'Add legible visible explanation or a meaningful, sufficiently large visual; preserve whitespace around actual content.'}));}
  const visualCount=content.filter(item=>item.hasVisual).length,visualRatio=content.length?visualCount/content.length:1;
  if(visualRatio<minimumVisualRatio)blockers.push(issue('QUALITY_VISUAL_COVERAGE', 'DECK',`Only ${visualCount}/${content.length} content slides (${visualRatio.toFixed(2)}) contain a structured visual; the plan requires ${minimumVisualRatio.toFixed(2)}.`,{visual_slides:visualCount,content_slides:content.length,actual_ratio:Number(visualRatio.toFixed(3)),minimum_ratio:minimumVisualRatio}));
  for(const item of content)if(VISUAL_WORDS.test(item.planned?.visual_type||'')&&!item.hasVisual)blockers.push(issue('QUALITY_PLANNED_VISUAL_MISSING',item.slide.slide_id,'The approved slide plan calls for a figure, image, chart, diagram, or table, but the rendered IR has no structured visual.'));
  let run=[];
  const flush=()=>{if(run.length>=5)blockers.push(issue('QUALITY_LAYOUT_REPETITION',run[0].slide.slide_id,`${run.length} consecutive content slides use the same composition signature.`,{slide_ids:run.map(item=>item.slide.slide_id),signature:run[0].signature,recommendation:'Vary the explanatory form where the story supports it: figure, diagram, comparison, worked example, or concise text.'}));else if(run.length===4)warnings.push(issue('QUALITY_LAYOUT_REPETITION_WARNING',run[0].slide.slide_id,'Four consecutive content slides share the same composition signature.',{slide_ids:run.map(item=>item.slide.slide_id)}));run=[];};
  for(const item of slides.map((slide,index)=>({slide,planned:byId.get(slide.slide_id)||{},index}))) {
    if(isTransition({narrative_role:item.planned.narrative_role||item.slide.role||''})){flush();continue;}
    const signature=`${item.planned.layout_intent||''}|${item.slide.type}|${(item.slide.elements||[]).map(element=>element.kind).sort().join(',')}`;
    if(run.length&&run[0].signature!==signature)flush();run.push({...item,signature});
  }
  flush();
  const pageCount=slides.length,screenPages=imageReview?.pages||[];
  if(screenPages.length!==pageCount)blockers.push(issue('QUALITY_RENDER_PAGE_COUNT','DECK',`Rendered image screen covers ${screenPages.length} pages but the deck has ${pageCount}.`));
  const severity=blockers.length?'fail':warnings.length?'review':'pass';
  return{status:severity,method:'deterministic_ir_and_rendered_qa',blocking_issue_count:blockers.length,warning_count:warnings.length,content_slide_count:content.length,visual_slide_count:visualCount,visual_slide_ratio:Number(visualRatio.toFixed(3)),minimum_visual_slide_ratio:minimumVisualRatio,minimum_explanation_units:minimumUnits,priority_allocation:priorityAllocation,blockers,warnings,limitations:['These checks can identify sparse visible copy, absent structured visuals, repeated composition signatures, long English-only blocks in Chinese decks, assistant-facing copy, repeated or stacked disclaimer-style clauses, disproportionate core-versus-supporting page and time allocation, small text, unmeasured text size, text overlap, and missing renders.','They cannot determine which topics deserve core importance; that priority must be set correctly in the approved plan. They also cannot judge beauty, semantic relevance or correctness of external images, causal reasoning, scientific truth, or whether a single caveat is truly necessary. Human review remains mandatory.','The thresholds are explicit plan constraints and can still be misconfigured; a passing result is not a guarantee of audience satisfaction.']};
}
