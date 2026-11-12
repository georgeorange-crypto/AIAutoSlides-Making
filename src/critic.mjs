import {validateDeck} from './validate.mjs';

const REF={
  'NARR-001':['MIT EECS Communication Lab','https://mitcommlab.mit.edu/eecs/commkit/slideshow/'],
  'NARR-002':['Stanford GSB communication advice','https://www.gsb.stanford.edu/insights/communication-tips-classroom-around-world'],
  'AE-001':['CMU Assertion–Evidence guidance','https://www.cmu.edu/student-success/other-resources/resource-descriptions/powerpoint-design.html'],
  'SCI-001':['Harvard T.H. Chan slide checklist','https://hsph.harvard.edu/research/health-communication/resources/slide-checklist/'],
  'SCI-002':['Storytelling with Data','https://www.storytellingwithdata.com/book/downloads'],
  'SRC-001':['AIAutoSlides evidence ledger contract','docs/SCHEMA.md'],
  'READ-001':['Y Combinator: simple, legible, obvious','https://www.ycombinator.com/blog/how-to-design-a-better-pitch-deck'],
  'READ-002':['Harvard T.H. Chan slide checklist','https://hsph.harvard.edu/research/health-communication/resources/slide-checklist/'],
  'TIME-001':['IEEE Author Center: Present Your Paper','https://conferences.ieeeauthorcenter.ieee.org/become-an-ieee-conference-author/present-your-paper/'],
  'CHART-001':['AIAutoSlides figure data contract','docs/SCHEMA.md'],
  'CHART-002':['Google developer style guide: Diagrams, Figures, Images','https://developers.google.com/style/images']
};

function wordCount(value){return String(value||'').trim().split(/\s+/).filter(Boolean).length;}
function slideId(slide,index){return slide.slide_id||`S${String(index+1).padStart(2,'0')}`;}
function issue(rule,severity,slide,field,message,recommendation,index){return{rule_id:rule,severity,slide_id:slideId(slide,index),element:field,message,recommendation,reference:{name:REF[rule]?.[0]||'AIAutoSlides review rule',url:REF[rule]?.[1]||'docs/RESEARCH_APPLICATION_MATRIX.md'}};}

export function critiqueDeck(storyboard,evidence){
  const {deck,errors,warnings}=validateDeck(storyboard,evidence),issues=[];
  if(errors.length)for(const message of errors)issues.push({rule_id:'SCHEMA-001',severity:'error',slide_id:'DECK',element:'storyboard',message,recommendation:'Correct the storyboard/evidence contract before building.',reference:{name:'AIAutoSlides schema contract',url:'docs/SCHEMA.md'}});
  if(!deck?.meta)return{schema_version:1,status:'fail',issues,warnings};
  if(!deck.meta.audience_profile)issues.push({rule_id:'NARR-001',severity:'warning',slide_id:'DECK',element:'meta.audience_profile',message:'Audience profile is not specified.',recommendation:'Choose research_group, academic_conference, or investment_committee, then review the narrative for that audience.',reference:{name:REF['NARR-001'][0],url:REF['NARR-001'][1]}});
  if(!deck.meta.goal)issues.push({rule_id:'NARR-002',severity:'warning',slide_id:'DECK',element:'meta.goal',message:'Deck goal or intended audience action is not specified.',recommendation:'State what the audience should understand, decide, or do after the talk.',reference:{name:REF['NARR-002'][0],url:REF['NARR-002'][1]}});
  if(!Number.isFinite(deck.meta.duration_minutes))issues.push({rule_id:'TIME-001',severity:'warning',slide_id:'DECK',element:'meta.duration_minutes',message:'Target duration is missing, so pacing cannot be reviewed.',recommendation:'Add the target talk duration and check any target-conference instructions separately.',reference:{name:REF['TIME-001'][0],url:REF['TIME-001'][1]}});
  const evidenceById=new Map((evidence?.entries||[]).map(entry=>[entry.id,entry]));
  deck.slides.forEach((slide,index)=>{
    if(slide.type==='statement'&&!slide.assertion_title)issues.push(issue('AE-001','suggestion',slide,'assertion_title','Statement slide has no separate assertion field.','Confirm the title itself states the supported claim; add assertion_title when the slide needs a distinct evidence takeaway.',index));
    if(slide.type==='chart'&&!Number.isInteger(slide.chart?.sample_size))issues.push(issue('SCI-001','warning',slide,'chart.sample_size','Chart has no sample count.','Add the actual sample count or state in notes why it is unavailable; do not infer it from plotted categories.',index));
    if(slide.type==='chart'&&!slide.figure_description)issues.push(issue('CHART-002','suggestion',slide,'figure_description','Chart has no plain-language description for readers who cannot interpret the visual directly.','Add a concise figure_description that states the encodings and the supported takeaway without adding claims.',index));
    if(slide.type==='chart'&&slide.chart?.kind==='bar'&&slide.chart.min_value>0)issues.push(issue('SCI-002','error',slide,'chart.min_value','Bar chart has a truncated positive baseline.','Set the axis minimum to zero or choose a chart form that represents the comparison fairly.',index));
    const unverified=(slide.evidence_ids||[]).filter(sourceId=>evidenceById.has(sourceId)&&!evidenceById.get(sourceId).verified);
    if(unverified.length)issues.push(issue('SRC-001','warning',slide,'evidence_ids',`Evidence ${unverified.join(', ')} is marked verified:false.`, 'Keep the verification warning visible and compare each cited source with the underlying records before treating claims as findings.',index));
    if((slide.title||'').length>72)issues.push(issue('READ-001','suggestion',slide,'title',`Title contains ${(slide.title||'').length} characters and may be hard to scan at presentation distance.`,'Shorten it or split the claim while preserving its meaning and source support.',index));
    (slide.body||[]).forEach((text,i)=>{if(text.length>155)issues.push(issue('READ-002','suggestion',slide,`body[${i}]`,`Body item contains ${text.length} characters.`,'Reduce the line to one point; move context to speaker notes or the reading edition.',index));});
    if(slide.type==='chart'&&wordCount(slide.speaker_notes||slide.notes)<8)issues.push(issue('CHART-001','suggestion',slide,'speaker_notes','Chart notes do not yet explain the figure’s comparison, units, and main limitation.','Add speaker notes that explain how to read the figure and what it does not establish.',index));
  });
  for(const warning of warnings){if(warning.includes('sample_size is missing')&&issues.some(i=>i.rule_id==='SCI-001'))continue;if(issues.some(i=>i.message===warning))continue;issues.push({rule_id:'VALIDATION-WARN',severity:'warning',slide_id:'DECK',element:'storyboard',message:warning,recommendation:'Resolve the warning or retain it as a documented limitation.',reference:{name:'AIAutoSlides validation rules',url:'docs/SCHEMA.md'}});}
  const severityOrder={error:0,warning:1,suggestion:2,info:3};issues.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||(a.slide_id||'').localeCompare(b.slide_id||'')||a.rule_id.localeCompare(b.rule_id));
  return{schema_version:1,status:errors.length?'fail':issues.some(i=>i.severity==='warning')?'review':'suggestions',slide_count:deck.slides.length,audience_profile:deck.meta.audience_profile||null,duration_minutes:deck.meta.duration_minutes||null,issues,validation_warnings:warnings};
}

export function auditDraftNumbers(storyboard,sourceText){
  const sourceNumbers=new Set((String(sourceText).match(/\d+(?:[.,]\d+)?\s*%?/g)||[]).map(x=>x.replace(/\s/g,'').replace(',','.'))),findings=[];
  storyboard.slides.forEach((slide,index)=>{
    const text=[slide.title,...(slide.body||[])].join(' '),id=slide.slide_id||`S${String(index+1).padStart(2,'0')}`;
    for(const number of text.match(/\d+(?:[.,]\d+)?\s*%?/g)||[]){const normalized=number.replace(/\s/g,'').replace(',','.');if(!sourceNumbers.has(normalized))findings.push({rule_id:'GROUND-NUMERIC-001',severity:'warning',slide_id:id,element:'title/body',number:normalized,message:`Numeric token “${number.trim()}” does not appear literally in the supplied source brief.`,recommendation:'Check the claim against the original source; numeric overlap does not establish semantic support.'});}
  });
  return{status:findings.length?'review':'literal-match-only',source_numbers_checked:true,limitations:['This lexical check only detects whether the same numeric token occurs in the brief. It cannot establish meaning, units, context, or source truth.','Numbers written as words and semantically unsupported paraphrases may not be detected.'],findings};
}
