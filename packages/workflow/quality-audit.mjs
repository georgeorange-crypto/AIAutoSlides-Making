import {classifyImportance} from './importance.mjs';
import {MIN_FORMAL_VISUAL_SLIDE_RATIO} from './deck-gate.mjs';

const VISUAL_KINDS=new Set(['image','chart','table','diagram','mermaid','process','cards']);
const AGENDA_ROLE=/^(agenda|contents|table[_ -]?of[_ -]?contents|目录)$/i;
const SECTION_ROLE=/^(section[_ -]?transition|section)$/i;
const TRANSITION_ROLE=/^(cover|opening|agenda|contents|table[_ -]?of[_ -]?contents|目录|section[_ -]?transition|section|closing|conclusion|summary)$/i;
const ENDING_ROLE=/^(closing|conclusion|summary)$/i;
const EVIDENCE_OPTIONAL_ROLE=/^(agenda|contents|table[_ -]?of[_ -]?contents|目录|section[_ -]?transition|section|cover|opening)$/i;
const ASSISTANT_VOICE=/(?:\b(?:you(?:'ll| will| can| may| should| need to| might want to)|your (?:task|next step|turn|input)|if you (?:want|would like|need)|please (?:provide|tell|share|upload|choose|review)|let me know|tell me|in this presentation you|I will now|I am going to show you|I hope this helps|feel free to ask)\b|你(?:可以|将会|会发现|需要|可以看到|可以先)|您(?:可以|将会|会发现|需要|可以看到|可以先)|如果(?:你|您)(?:愿意|需要|想要|希望)|(?:请|麻烦)(?:告诉我|提供|上传|选择|检查|查看)|告诉我|我(?:将|会)(?:为你|为您|向你|向您)?(?:展示|介绍|说明|讲解)|下面我(?:将|会)|接下来我(?:将|会)|希望(?:这|本次汇报|以上内容)(?:能)?(?:对你|对您)?(?:有帮助|有所帮助)|如(?:果你|果您|需)|欢迎(?:随时)?(?:提问|告诉我)|供(?:你|您)参考)/iu;
const CAVEAT_CLAUSE=/(?:\b(?:does not|doesn't|do not|don't|cannot|can't|should not|shouldn't|is not|isn't|are not|aren't)\s+(?:prove|show|mean|imply|establish|demonstrate|represent|indicate|guarantee|confirm|measure|capture|constitute|replace|cover)\b|\bnot\s+(?:necessarily|evidence of|proof of|a measure of|intended to|a guarantee)\b|\b(?:no claim is made|should not be interpreted|cannot be interpreted)\b|不代表|不表明|不意味着|并不意味着|不能证明|无法证明|不能说明|无法说明|不构成|不可据此|不应(?:被)?解读为|不宜解读为)/iu;
const VISUAL_WORDS=/(?:image|illustration|photo|figure|chart|diagram|architecture|process|table|图|照片|插图|示意|图表|架构|流程|表格|原图)/iu;
const CJK=/\p{Script=Han}/u;
const MIN_RENDERED_VISUAL_AREA={image:0.08,chart:0.15,table:0.15,diagram:0.03,process:0.08,cards:0.08};
const MIN_RENDERED_VISUAL_FOOTPRINT=0.12;

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
function materializedVisual(slide,renderWarnings){
  return(slide.elements||[]).some(element=>{
    if(!VISUAL_KINDS.has(element.kind))return false;
    if(element.kind==='mermaid'&&renderWarnings.some(warning=>String(warning).includes(`${slide.slide_id}/${element.element_id}: Mermaid source was preserved as text`)))return false;
    return true;
  });
}
function compositionSignature(slide,qa,renderWarnings=[]){
  const elements=(slide.elements||[]).filter(element=>!(element.kind==='mermaid'&&renderWarnings.some(warning=>String(warning).includes(`${slide.slide_id}/${element.element_id}: Mermaid source was preserved as text`)))),fellBackMermaid=elements.length!==(slide.elements||[]).length,hasOtherVisual=elements.some(element=>VISUAL_KINDS.has(element.kind));
  const type=fellBackMermaid&&!hasOtherVisual&&slide.type==='architecture'?'statement':slide.type||'unknown',kinds=[...new Set(elements.map(element=>element.kind).concat(fellBackMermaid?['text']:[]))].sort(),structure=`${type}|${kinds.join(',')}`;
  const width=Number(qa?.slideWidthEmu),height=Number(qa?.slideHeightEmu),bounds=qa?.elementBounds;
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!Array.isArray(bounds))return structure;
  const slots=new Map();
  for(const box of bounds){
    if(box.ok===false||![box.x,box.y,box.w,box.h].every(Number.isFinite))continue;
    const centerX=(box.x+box.w/2)/width,centerY=(box.y+box.h/2)/height;
    if(centerY<0.15||centerY>0.9)continue;
    const slot=`${Math.min(3,Math.floor(centerX*4))}:${Math.min(3,Math.floor(centerY*4))}`;
    slots.set(slot,(slots.get(slot)||0)+1);
  }
  const geometry=[...slots].sort(([a],[b])=>a.localeCompare(b)).map(([slot,count])=>`${slot}=${count}`).join(',');
  return geometry?`${structure}|body-grid:${geometry}`:structure;
}

/** Deterministic hard checks for formal decks. This is a screening gate, not an aesthetic or factual judge. */
export function auditDeckQuality({plan,presentationIR,renderedQa,imageReview,contentPlan,renderWarnings=[]}){
  const blockers=[],warnings=[],contract=plan?.quality_contract||{},plannedSlides=plan?.slides||[],byId=new Map(plannedSlides.map(slide=>[slide.slide_id,slide]));
  if(!renderedQa||!Array.isArray(renderedQa.slides))blockers.push(issue('QUALITY_RENDER_QA_MISSING','DECK','Rendered OOXML QA details are missing; formal quality checks cannot run.'));
  if(renderedQa?.status==='fail'||renderedQa?.errors?.length)blockers.push(issue('QUALITY_STRUCTURAL_QA_FAILED','DECK','Structural PPTX QA has blocking errors.',{errors:renderedQa.errors||[]}));
  if(!imageReview||!Array.isArray(imageReview.pages)||imageReview.status==='not_rendered')blockers.push(issue('QUALITY_RENDER_SCREEN_BLOCKED','DECK','Rendered page images are missing; every page must have a rendered-image screen.',{status:imageReview?.status||'missing'}));
  for(const page of imageReview?.pages||[]){if(page.status==='missing_page_image')blockers.push(issue('QUALITY_RENDER_PAGE_MISSING',page.slide_id,'Rendered page image is missing.',{page:page.page}));else if(page.status==='ocr_failed'||page.status==='no_expected_text')warnings.push(issue('QUALITY_OCR_INCOMPLETE',page.slide_id,'OCR could not fully screen authored text; human page inspection remains required.',{status:page.status}));else if(page.status==='low_text_coverage')warnings.push(issue('QUALITY_OCR_COVERAGE_LOW',page.slide_id,'OCR detected less than the expected authored text; confirm it is visible in the rendered page.',{coverage:page.coverage}));}
  const slides=presentationIR?.slides||[],content=[],endings=[],repeatedCaveats=new Map();
  const sections=Array.isArray(contract.narrative_sections)?contract.narrative_sections:[];
  const expectedSlideCount=Number.isInteger(plan?.task?.expected_slide_count)?plan.task.expected_slide_count:plannedSlides.length;
  const plannedIds=new Set(plannedSlides.map(slide=>slide.slide_id)),actualIds=new Set(slides.map(slide=>slide.slide_id));
  const sameIds=(left,right)=>left.size===right.size&&[...left].every(id=>right.has(id));
  const isFullDeck=slides.length===expectedSlideCount&&slides.length===plannedSlides.length&&sameIds(plannedIds,actualIds);
  const representativeIds=new Set(Array.isArray(plan?.representative_slides)?plan.representative_slides:[]);
  const isRepresentativeRun=representativeIds.size>0&&sameIds(representativeIds,actualIds);
  if(!isFullDeck&&!isRepresentativeRun)blockers.push(issue('QUALITY_PLAN_PAGE_MAP_MISMATCH','DECK','Rendered Presentation IR must match the complete planned page map or exactly match its declared representative slide IDs.',{planned_slide_count:expectedSlideCount,planned_ids:[...plannedIds],rendered_ids:[...actualIds],representative_ids:[...representativeIds]}));
  if(isFullDeck||(!isRepresentativeRun&&slides.length===plannedSlides.length)){
    for(const id of plannedIds)if(!actualIds.has(id))blockers.push(issue('QUALITY_PLAN_SLIDE_MISSING',id,'A slide required by the approved plan is absent from the rendered Presentation IR.'));
    for(const id of actualIds)if(!plannedIds.has(id))blockers.push(issue('QUALITY_PLAN_SLIDE_UNPLANNED',id,'This rendered slide is absent from the approved deck plan.'));
  }
  if(!isFullDeck&&isRepresentativeRun)warnings.push(issue('QUALITY_NARRATIVE_STRUCTURE_DEFERRED','DECK','This run matches the declared representative-slide subset; complete agenda and section checks are deferred to the full-deck run.',{planned_slide_count:expectedSlideCount,rendered_slide_count:slides.length}));
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
    const planned=byId.get(slide.slide_id),role=planned?.narrative_role||slide.role||'',elements=slide.elements||[],elementTexts=elements.flatMap(textOfElement),visible=[slide.title,slide.assertion_title,slide.kicker,...elementTexts].filter(value=>typeof value==='string').join('\n'),speakerNotes=typeof slide.speaker_notes==='string'?slide.speaker_notes:'',explanation=elementTexts.join('\n'),slideUnits=units(explanation),hasVisual=materializedVisual(slide,renderWarnings),id=slide.slide_id;
    if(isFullDeck&&planned&&!EVIDENCE_OPTIONAL_ROLE.test(planned.narrative_role||'')){
      const plannedRefs=Array.isArray(planned.evidence_ids)?planned.evidence_ids:[],actualRefs=new Set(Array.isArray(slide.evidence_ids)?slide.evidence_ids:[]);
      if(!plannedRefs.length)blockers.push(issue('QUALITY_PLAN_EVIDENCE_MISSING',id,'Substantive content needs at least one source/evidence ID in the approved slide plan.'));
      const missing=plannedRefs.filter(ref=>!actualRefs.has(ref));
      if(missing.length)blockers.push(issue('QUALITY_EVIDENCE_LINEAGE_MISSING',id,'Evidence IDs declared for this slide are missing from the rendered Presentation IR page.',{missing_evidence_ids:missing}));
    }
    if(!isTransition({narrative_role:role}))content.push({slide,planned,index,visible,elementTexts,slideUnits,hasVisual});
    if(ENDING_ROLE.test(role))endings.push({slide,index,slideUnits});
    if(!/^(agenda|contents|table[_ -]?of[_ -]?contents|目录)$/i.test(role)){
      const clauses=caveatClauses(visible);
      if(clauses.length>=3)blockers.push(issue('QUALITY_CAVEAT_OVERLOAD',id,`${clauses.length} disclaimer-style clauses appear on one page; consolidate them and keep only caveats needed to interpret that page.`,{caveat_clause_count:clauses.length,recommendation:'Keep only caveats needed to interpret this page; state broader study limitations once, concisely, where they best support interpretation.'}));
      for(const clause of clauses){const normalized=clause.normalize('NFC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');if(!normalized)continue;const owners=repeatedCaveats.get(normalized)||new Set();owners.add(id);repeatedCaveats.set(normalized,owners);}
    }
    if(ASSISTANT_VOICE.test(visible))blockers.push(issue('QUALITY_ASSISTANT_VOICE',id,'Visible copy reads like instructions or a conversation with the user.',{location:'visible_copy',recommendation:'Rewrite it as presentation content addressed to the audience without assistant-to-user phrasing.'}));
    if(ASSISTANT_VOICE.test(speakerNotes))blockers.push(issue('QUALITY_ASSISTANT_VOICE',id,'Speaker notes contain assistant-to-user prompts rather than talk content.',{location:'speaker_notes',recommendation:'Replace assistant-facing prompts with concise presenter cues or audience-directed explanation.'}));
    if(CJK.test(contract.language||'')||/chinese|中文|简体|繁體/i.test(contract.language||'')){
      for(const text of [slide.title,slide.assertion_title,...elementTexts].filter(value=>typeof value==='string')){
        const latinWords=(text.match(/[A-Za-z][A-Za-z0-9'’.-]*/g)||[]).length,hanChars=[...text].filter(char=>CJK.test(char)).length,latinChars=[...text].filter(char=>/\p{Script=Latin}/u.test(char)).length,chineseShare=hanChars+latinChars?hanChars/(hanChars+latinChars):1;
        if(latinWords>=16&&chineseShare<0.35)blockers.push(issue('QUALITY_LONG_ENGLISH_BLOCK',id,'A Chinese deck contains a long English-dominant text block, even if a few Chinese characters are mixed in.',{excerpt:text.slice(0,120),latin_words:latinWords,han_characters:hanChars,latin_characters:latinChars,chinese_character_share:Number(chineseShare.toFixed(3)),minimum_chinese_share:0.35,recommendation:'Translate the passage or explain it substantially in natural Chinese; retain only necessary technical terms in English.'}));
      }
    }
    const qa=renderedQa?.slides?.[index];
    if(qa){
      if(qa.textBoundsPass===false||Array.isArray(qa.textBounds)&&qa.textBounds.some(bound=>!bound.ok))blockers.push(issue('QUALITY_TEXT_OUT_OF_BOUNDS',id,'Rendered text extends beyond the slide canvas.'));
      if(Array.isArray(qa.elementBounds)&&qa.elementBounds.some(bound=>!bound.ok))blockers.push(issue('QUALITY_OBJECT_OUT_OF_BOUNDS',id,'A rendered object extends beyond the slide canvas.'));
      for(const overlap of qa.textOverlaps||[])blockers.push(issue('QUALITY_TEXT_OVERLAP',id,'Rendered text boxes overlap.',{objects:[overlap.shape_a,overlap.shape_b],text:[overlap.text_a,overlap.text_b]}));
      for(const small of qa.smallText||[])if(Number(small.min_font_size_pt)<14)blockers.push(issue('QUALITY_TEXT_TOO_SMALL',id,'Authored text below 14 pt is blocked, including text placed in the footer area.',{font_size_pt:small.min_font_size_pt,shape:small.shape,text:small.text,position:{x:small.x,y:small.y,w:small.w,h:small.h}}));
      for(const unknown of qa.unmeasuredText||[])blockers.push(issue('QUALITY_TEXT_SIZE_UNMEASURED',id,'Authored text has no explicit measurable font size; it cannot pass the readability gate by silently inheriting an unknown style.',{shape:unknown.shape,text:unknown.text,position:{x:unknown.x,y:unknown.y,w:unknown.w,h:unknown.h}}));
      const width=Number(qa.slideWidthEmu),height=Number(qa.slideHeightEmu),area=width*height;
      for(const [kind,elementKind] of [['image','pic'],['chart','graphicFrame'],['table','graphicFrame']]){
        const count=elements.filter(element=>element.kind===kind).length;
        if(!count)continue;
        const boxes=Array.isArray(qa.elementBounds)?qa.elementBounds.filter(box=>box.element===elementKind&&box.ok!==false&&[box.x,box.y,box.w,box.h].every(Number.isFinite)&&box.w>0&&box.h>0):[];
        if(!Number.isFinite(area)||area<=0||boxes.length<count){blockers.push(issue('QUALITY_VISUAL_SIZE_UNMEASURED',id,`Rendered ${kind} geometry is missing; its visible size cannot pass the visual-size gate.`,{kind,expected_object_count:count,measured_object_count:boxes.length}));continue;}
        const ratios=boxes.map(box=>box.w*box.h/area).sort((a,b)=>a-b).slice(0,count);
        ratios.forEach((ratio,visualIndex)=>{if(ratio<MIN_RENDERED_VISUAL_AREA[kind])blockers.push(issue('QUALITY_VISUAL_TOO_SMALL',id,`Rendered ${kind} ${visualIndex+1} occupies ${(ratio*100).toFixed(1)}% of the slide; the minimum is ${(MIN_RENDERED_VISUAL_AREA[kind]*100).toFixed(0)}%.`,{kind,visual_index:visualIndex+1,actual_area_ratio:Number(ratio.toFixed(4)),minimum_area_ratio:MIN_RENDERED_VISUAL_AREA[kind]}));});
      }
      for(const [kind,groupKind] of [['diagram','diagram'],['mermaid','diagram'],['process','process'],['cards','cards']]){
        const count=elements.filter(element=>element.kind===kind).length;if(!count)continue;
        const groups=(qa.visualGroupBounds||[]).filter(group=>group.kind===groupKind&&String(group.group_id).startsWith(`${id}:`));
        if(groups.length<count||groups.slice(0,count).some(group=>!Number.isFinite(group.area_ratio)||Number(group.unmeasured_member_count)>0||Number(group.member_count)<=0)){blockers.push(issue('QUALITY_VISUAL_SIZE_UNMEASURED',id,`Rendered ${kind} shape-group geometry is missing or incomplete; its visible size cannot pass the visual-size gate.`,{kind,expected_group_count:count,measured_group_count:groups.length}));continue;}
        groups.slice(0,count).forEach((group,visualIndex)=>{const minimumArea=MIN_RENDERED_VISUAL_AREA[groupKind],footprintTooSmall=!Number.isFinite(group.bounds_area_ratio)||group.bounds_area_ratio<MIN_RENDERED_VISUAL_FOOTPRINT,objectAreaTooSmall=group.area_ratio<minimumArea;if(footprintTooSmall||objectAreaTooSmall)blockers.push(issue('QUALITY_VISUAL_TOO_SMALL',id,`Rendered ${kind} shape group ${visualIndex+1} has ${(group.area_ratio*100).toFixed(1)}% object-box coverage and ${(Number(group.bounds_area_ratio||0)*100).toFixed(1)}% overall footprint; minimums are ${(minimumArea*100).toFixed(0)}% and ${(MIN_RENDERED_VISUAL_FOOTPRINT*100).toFixed(0)}%.`,{kind,visual_index:visualIndex+1,actual_area_ratio:Number(group.area_ratio.toFixed(4)),minimum_area_ratio:minimumArea,actual_bounds_area_ratio:Number.isFinite(group.bounds_area_ratio)?Number(group.bounds_area_ratio.toFixed(4)):null,minimum_bounds_area_ratio:MIN_RENDERED_VISUAL_FOOTPRINT,member_count:group.member_count}));});
      }
    }
  }
  for(const owners of repeatedCaveats.values())if(owners.size>=3)blockers.push(issue('QUALITY_CAVEAT_REPETITION',[...owners][0],`The same disclaimer-style clause is repeated on ${owners.size} pages.`,{slide_ids:[...owners],repetition_count:owners.size,recommendation:'State a shared limitation once, then use each page for the evidence, mechanism, or implication that matters there.'}));
  let priorityAllocation=null,priorityTopicCoverage=null;
  if(isFullDeck){
    const ranked=content.map(item=>({...item,importanceBand:classifyImportance(item.planned?.importance)})),unranked=ranked.filter(item=>!item.importanceBand);
    for(const item of unranked)blockers.push(issue('QUALITY_IMPORTANCE_UNRANKED',item.slide.slide_id,'This content slide has no recognized importance level, so emphasis allocation cannot be audited.'));
    const declaredPriorities=Array.isArray(contract.content_priorities)?contract.content_priorities:[];
    if(!declaredPriorities.length)blockers.push(issue('QUALITY_PRIORITY_MAP_MISSING','DECK','The full-deck quality contract must list its content priorities so importance labels can be checked against the declared focus.'));
    if(new Set(declaredPriorities).size!==declaredPriorities.length)blockers.push(issue('QUALITY_PRIORITY_MAP_INVALID','DECK','Declared content priority labels must be unique.'));
    const priorityOwners=new Map(declaredPriorities.map(priority=>[priority,[]]));
    for(const item of ranked){
      const tags=item.planned?.priority_ids;
      if(!Array.isArray(tags)){blockers.push(issue('QUALITY_PRIORITY_TAGS_MISSING',item.slide.slide_id,'Every content slide must map to zero or more declared content priority labels.',{declared_priorities:declaredPriorities}));continue;}
      if(new Set(tags).size!==tags.length)blockers.push(issue('QUALITY_PRIORITY_TAGS_DUPLICATE',item.slide.slide_id,'A slide cannot repeat the same content priority label.'));
      const unknown=tags.filter(tag=>!priorityOwners.has(tag));
      if(unknown.length)blockers.push(issue('QUALITY_PRIORITY_TAG_UNKNOWN',item.slide.slide_id,'This slide maps to a content priority that is absent from the approved quality contract.',{unknown_priority_ids:unknown}));
      for(const tag of tags)if(priorityOwners.has(tag)&&item.importanceBand==='priority')priorityOwners.get(tag).push(item.slide.slide_id);
      if(item.importanceBand==='priority'&&!tags.some(tag=>priorityOwners.has(tag)))blockers.push(issue('QUALITY_PRIORITY_TAGS_MISSING',item.slide.slide_id,'A core/high slide must explain at least one declared content priority.'));
    }
    priorityTopicCoverage=[...priorityOwners].map(([priority,slideIds])=>({priority,core_slide_ids:slideIds,core_slide_count:slideIds.length}));
    for(const entry of priorityTopicCoverage)if(!entry.core_slide_count)blockers.push(issue('QUALITY_PRIORITY_UNCOVERED','DECK',`Declared content priority "${entry.priority}" is not assigned to any core/high slide.`,{priority:entry.priority,recommendation:'Assign at least one slide that explains this declared priority to a core/high importance level, or revise the approved priorities.'}));
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
  const minimumUnits=Number(contract.minimum_explanation_units),declaredVisualRatio=Number(contract.visual_slide_ratio_min),minimumVisualRatio=Number.isFinite(declaredVisualRatio)?Math.max(MIN_FORMAL_VISUAL_SLIDE_RATIO,declaredVisualRatio):MIN_FORMAL_VISUAL_SLIDE_RATIO;
  for(const item of content){if(item.slideUnits<minimumUnits)blockers.push(issue('QUALITY_CONTENT_TOO_THIN',item.slide.slide_id,`Visible explanatory copy has ${item.slideUnits} text units; the plan requires at least ${minimumUnits}.`,{text_units:item.slideUnits,minimum:minimumUnits,recommendation:'Explain the mechanism, evidence, or implication on the slide; do not count speaker notes as visible explanation.'}));const page=imageReview?.pages?.find(candidate=>candidate.slide_id===item.slide.slide_id),occupancy=page?.visible_text_occupancy_ratio,lineCount=page?.visible_text_line_count,minimum=item.hasVisual?0.045:0.06,minimumLines=2;if(!Number.isFinite(occupancy)||!Number.isInteger(lineCount))blockers.push(issue('QUALITY_VISIBLE_DENSITY_UNMEASURED',item.slide.slide_id,'Rendered body-text density could not be measured; a page cannot pass on authored text units alone.',{recommendation:'Provide page OCR word bounds and matching slide geometry, then inspect the rendered page.'}));else if(occupancy<minimum||lineCount<minimumLines)blockers.push(issue('QUALITY_VISIBLE_DENSITY_LOW',item.slide.slide_id,`Visible body text occupies ${(occupancy*100).toFixed(2)}% of the content region across ${lineCount} detected line(s); this page needs more visible explanation or a meaningful visual.`,{visible_text_occupancy_ratio:occupancy,visible_text_line_count:lineCount,minimum_ratio:minimum,minimum_line_count:minimumLines,structured_visual_planned:item.hasVisual,recommendation:'Add legible visible explanation or a meaningful, sufficiently large visual; preserve whitespace around actual content.'}));}
  for(const item of endings){
    if(item.slideUnits<18)blockers.push(issue('QUALITY_CLOSING_TOO_THIN',item.slide.slide_id,`The ending contains ${item.slideUnits} visible explanatory text units; at least 18 are required beyond the headline.`,{text_units:item.slideUnits,minimum:18,recommendation:'Use the ending to state a substantive takeaway grounded in the preceding content.'}));
    const page=imageReview?.pages?.find(candidate=>candidate.slide_id===item.slide.slide_id),occupancy=page?.visible_text_occupancy_ratio,lineCount=page?.visible_text_line_count;
    if(!Number.isFinite(occupancy)||!Number.isInteger(lineCount))blockers.push(issue('QUALITY_CLOSING_DENSITY_UNMEASURED',item.slide.slide_id,'Rendered explanatory text density on the ending page could not be measured.',{recommendation:'Provide OCR word bounds for authored body copy and inspect the rendered ending page.'}));
    else if(occupancy<0.06||lineCount<2)blockers.push(issue('QUALITY_CLOSING_DENSITY_LOW',item.slide.slide_id,`Ending-page explanation occupies ${(occupancy*100).toFixed(2)}% of the body region across ${lineCount} detected line(s); the minimum is 6% and two lines.`,{visible_text_occupancy_ratio:occupancy,visible_text_line_count:lineCount,minimum_ratio:0.06,minimum_line_count:2,recommendation:'Give the authored takeaway enough visible space to read as a real conclusion; do not count the headline or decorative objects as explanation.'}));
  }
  const visualSlides=content.filter(item=>item.hasVisual),visualCount=visualSlides.length,visualRatio=content.length?visualCount/content.length:1,unmaterializedVisuals=content.flatMap(item=>(item.slide.elements||[]).filter(element=>VISUAL_KINDS.has(element.kind)&&!materializedVisual({elements:[element],slide_id:item.slide.slide_id},renderWarnings)).map(element=>({slide_id:item.slide.slide_id,element_id:element.element_id,kind:element.kind})));
  if(isFullDeck){if(visualRatio<minimumVisualRatio)blockers.push(issue('QUALITY_VISUAL_COVERAGE','DECK',`Only ${visualCount}/${content.length} content slides (${visualRatio.toFixed(2)}) contain a materialized visual; the plan requires ${minimumVisualRatio.toFixed(2)}.`,{visual_slides:visualCount,visual_slide_ids:visualSlides.map(item=>item.slide.slide_id),content_slides:content.length,actual_ratio:Number(visualRatio.toFixed(3)),minimum_ratio:minimumVisualRatio,unmaterialized_visuals:unmaterializedVisuals}));}
  else warnings.push(issue('QUALITY_VISUAL_COVERAGE_DEFERRED','DECK','Visual coverage is measured on a representative subset and is not comparable to the full-deck threshold; verify it on the complete planned deck.',{visual_slides:visualCount,content_slides:content.length,observed_ratio:Number(visualRatio.toFixed(3)),minimum_ratio:minimumVisualRatio,unmaterialized_visuals:unmaterializedVisuals}));
  for(const item of content)if(VISUAL_WORDS.test(item.planned?.visual_type||'')&&!item.hasVisual)blockers.push(issue('QUALITY_PLANNED_VISUAL_MISSING',item.slide.slide_id,'The approved slide plan calls for a figure, image, chart, diagram, or table, but the rendered IR has no structured visual.'));
  const layoutGroups=new Map();
  for(const item of content){const qa=renderedQa?.slides?.[item.index],signature=compositionSignature(item.slide,qa,renderWarnings),slidesInLayout=layoutGroups.get(signature)||[];slidesInLayout.push(item.slide.slide_id);layoutGroups.set(signature,slidesInLayout);}
  const layoutVariantCount=layoutGroups.size,uniqueLayoutShare=content.length?layoutVariantCount/content.length:1,largestLayout=Math.max(0,...[...layoutGroups.values()].map(ids=>ids.length)),largestLayoutShare=content.length?largestLayout/content.length:0,layoutDistribution=[...layoutGroups].map(([signature,slideIds])=>({signature,slide_ids:slideIds,count:slideIds.length,share:Number((slideIds.length/Math.max(1,content.length)).toFixed(3))})).sort((a,b)=>b.count-a.count||a.signature.localeCompare(b.signature));
  let layoutDiversity={status:'deferred',content_slide_count:content.length,distinct_signature_count:layoutVariantCount,unique_signature_share:Number(uniqueLayoutShare.toFixed(3)),largest_signature_share:Number(largestLayoutShare.toFixed(3)),minimum_unique_signature_share:0.4,signature_distribution:layoutDistribution};
  if(isFullDeck){
    const lowVariety=content.length>=5&&uniqueLayoutShare<0.4,dominantTemplate=largestLayout>=4&&largestLayoutShare>=0.6;
    if(lowVariety||dominantTemplate)blockers.push(issue('QUALITY_LAYOUT_DIVERSITY','DECK',`The full deck uses ${layoutVariantCount} composition signatures across ${content.length} content pages; distinct layouts cover ${(uniqueLayoutShare*100).toFixed(1)}% and the most repeated layout covers ${(largestLayoutShare*100).toFixed(1)}%.`,{content_slide_count:content.length,distinct_signature_count:layoutVariantCount,unique_signature_share:Number(uniqueLayoutShare.toFixed(3)),largest_signature_share:Number(largestLayoutShare.toFixed(3)),minimum_unique_signature_share:0.4,signature_distribution:layoutDistribution,recommendation:'Use more than one genuinely different explanatory composition across the full deck; do not rely on changing titles or plan labels while reusing the same page structure.'}));
    layoutDiversity={...layoutDiversity,status:lowVariety||dominantTemplate?'fail':'pass'};
  }
  let run=[];
  const flush=()=>{if(run.length>=5)blockers.push(issue('QUALITY_LAYOUT_REPETITION',run[0].slide.slide_id,`${run.length} consecutive content slides use the same composition signature.`,{slide_ids:run.map(item=>item.slide.slide_id),signature:run[0].signature,recommendation:'Vary the explanatory form where the story supports it: figure, diagram, comparison, worked example, or concise text.'}));else if(run.length===4)warnings.push(issue('QUALITY_LAYOUT_REPETITION_WARNING',run[0].slide.slide_id,'Four consecutive content slides share the same composition signature.',{slide_ids:run.map(item=>item.slide.slide_id)}));run=[];};
  for(const item of slides.map((slide,index)=>({slide,planned:byId.get(slide.slide_id)||{},index}))) {
    if(isTransition({narrative_role:item.planned.narrative_role||item.slide.role||''})){flush();continue;}
    const signature=compositionSignature(item.slide,renderedQa?.slides?.[item.index],renderWarnings);
    if(run.length&&run[0].signature!==signature)flush();run.push({...item,signature});
  }
  flush();
  const pageCount=slides.length,screenPages=imageReview?.pages||[];
  if(screenPages.length!==pageCount)blockers.push(issue('QUALITY_RENDER_PAGE_COUNT','DECK',`Rendered image screen covers ${screenPages.length} pages but the deck has ${pageCount}.`));
  const severity=blockers.length?'fail':warnings.length?'review':'pass';
  return{status:severity,method:'deterministic_ir_and_rendered_qa',blocking_issue_count:blockers.length,warning_count:warnings.length,content_slide_count:content.length,visual_slide_count:visualCount,visual_slide_ratio:Number(visualRatio.toFixed(3)),unmaterialized_visuals:unmaterializedVisuals,minimum_visual_slide_ratio:minimumVisualRatio,minimum_explanation_units:minimumUnits,priority_allocation:priorityAllocation,priority_topic_coverage:priorityTopicCoverage,layout_diversity:layoutDiversity,blockers,warnings,limitations:['These checks can identify sparse visible copy, absent or unmaterialized structured visuals, undersized or unmeasured rendered images/charts/tables/diagram-process-card groups, repeated composition signatures, low full-deck layout diversity, English-dominant blocks in Chinese decks when a text block has at least 16 Latin words and under 35% Han characters among Han and Latin letters, assistant-facing copy, repeated or stacked disclaimer-style clauses, disproportionate core-versus-supporting page and time allocation, small text, unmeasured text size, text overlap, and missing renders.','Priority-topic coverage verifies that plan-authored focus labels are assigned to at least one core/high page; it cannot determine whether the labels themselves reflect actual user priorities or whether a page explains a topic adequately.','Grouped visual QA reports the enclosing rectangle and union of tagged editable OOXML member boxes. These are layout-geometry measures, not filled-pixel coverage or visual contrast; groups can still contain large gaps. Area thresholds cannot establish legibility, relevance, explanatory value, or aesthetic quality.','Composition signatures use slide type, structured element kinds, and coarse rendered body-object distribution when available; they cannot judge aesthetic quality or detect every reused visual theme. Human page review remains necessary. They also cannot determine which topics deserve core importance, verify semantic claim support, judge external-image relevance, causal reasoning, scientific truth, or whether a single caveat is truly necessary.','The thresholds are explicit plan constraints and can still be misconfigured; a passing result is not a guarantee of audience satisfaction.']};
}
