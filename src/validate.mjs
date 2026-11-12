import fs from 'node:fs';
import {empiricalCdfStep,studentTMeanInterval} from './statistics.mjs';

const VALID_TYPES = new Set(['cover','statement','bullets','metrics','chart','process','closing']);
const MANUAL_ONLY_TYPES = new Set(['metrics','chart','process']);

function isString(value) { return typeof value === 'string' && value.trim().length > 0; }
function boundedText(value, max=350) { return isString(value) && value.length <= max; }

export function loadEvidence(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing evidence ledger: ${file}`);
  const data = JSON.parse(fs.readFileSync(file,'utf8'));
  if (!Array.isArray(data.entries)) throw new Error('Evidence ledger must contain entries[]');
  const ids = new Set();
  for (const e of data.entries) {
    if (!isString(e.id) || !isString(e.label) || !isString(e.source) || typeof e.verified !== 'boolean') throw new Error('Invalid evidence entry; id, label, source, verified:boolean required');
    if(ids.has(e.id)) throw new Error(`Duplicate evidence ID ${e.id}`);
    ids.add(e.id);
  }
  return data;
}

export function normalizeDeck(deck) {
  // AI planning produces title/subtitle at top-level, whereas hand-written decks use meta.
  if (deck && !deck.meta && deck.title && Array.isArray(deck.slides)) {
    return { meta: {title:deck.title,subtitle:deck.subtitle || '',audience:'General',theme:'academic-light',status:'AI-generated draft; review all claims'},slides:deck.slides };
  }
  return deck;
}

export function validateDeck(input, ledger) {
  const deck = normalizeDeck(input);
  const errors = [], warnings = [];
  if (!deck || typeof deck !== 'object' || !deck.meta || !Array.isArray(deck.slides)) return {deck,errors:['Root must have meta and slides[]'],warnings};
  const ids = new Set(ledger.entries.map(e => e.id));
  if (!isString(deck.meta.title)) errors.push('meta.title is required');
  if (deck.meta.layout && !['assertion-evidence','two-column-contrast','metric-focus','chart-and-takeaway'].includes(deck.meta.layout)) errors.push(`Unsupported layout ${deck.meta.layout}`);
  if (deck.meta.aspect_ratio && deck.meta.aspect_ratio !== '16:9') errors.push('Only 16:9 decks are currently supported');
  if (deck.meta.audience_profile && !['research_group','academic_conference','investment_committee'].includes(deck.meta.audience_profile)) errors.push('Unsupported audience_profile');
  if(deck.meta.requires_human_review!==undefined&&typeof deck.meta.requires_human_review!=='boolean')errors.push('meta.requires_human_review must be boolean');
  if(deck.meta.requires_human_review===true&&(!deck.meta.human_review||deck.meta.human_review.decision!=='approve'))warnings.push('AI-generated draft requires a human review before PPTX build');
  if(deck.meta.speaker_notes_are_script!==undefined&&typeof deck.meta.speaker_notes_are_script!=='boolean')errors.push('meta.speaker_notes_are_script must be boolean');
  if(deck.meta.speech_rate_words_per_minute!==undefined&&(!Number.isFinite(deck.meta.speech_rate_words_per_minute)||deck.meta.speech_rate_words_per_minute<=0))errors.push('meta.speech_rate_words_per_minute must be a positive number');
  if(deck.meta.timing_window_minutes!==undefined&&(!Array.isArray(deck.meta.timing_window_minutes)||deck.meta.timing_window_minutes.length!==2||deck.meta.timing_window_minutes.some(x=>!Number.isFinite(x)||x<0)||deck.meta.timing_window_minutes[0]>deck.meta.timing_window_minutes[1]))errors.push('meta.timing_window_minutes must be an ordered [minimum, maximum] pair');
  if (!deck.slides.length || deck.slides.length>40) errors.push('slides must have 1–40 entries');
  for (const [i,s] of deck.slides.entries()) {
    const where=`Slide ${i+1}`;
    if (!VALID_TYPES.has(s.type)) errors.push(`${where}: unsupported type ${s.type}`);
    if (!boundedText(s.title,170)) errors.push(`${where}: title must contain 1–170 characters`);
    if(s.kicker && !boundedText(s.kicker,65)) errors.push(`${where}: kicker too long`);
    if(s.slide_id!==undefined && !/^S\d{2,3}$/.test(s.slide_id)) errors.push(`${where}: slide_id must use S01 format`);
    if(s.assertion_title!==undefined && !boundedText(s.assertion_title,170)) errors.push(`${where}: assertion_title must contain 1–170 characters`);
    if(s.layout && !['assertion-evidence','two-column-contrast','metric-focus','chart-and-takeaway'].includes(s.layout)) errors.push(`${where}: unsupported layout ${s.layout}`);
    if(s.speaker_notes!==undefined && !boundedText(s.speaker_notes,2000)) errors.push(`${where}: speaker_notes must contain 1–2000 characters`);
    if(s.figure_description!==undefined&&(!isString(s.figure_description)||s.figure_description.length>550))errors.push(`${where}: figure_description must contain 1–550 characters`);
    if(s.figure_description!==undefined&&s.type!=='chart')errors.push(`${where}: figure_description is only supported on chart slides`);
    if(s.body!==undefined && (!Array.isArray(s.body)||s.body.some(x=>!boundedText(x,550)))) errors.push(`${where}: body must be an array of nonempty strings (<=550 chars)`);
    if(s.body?.some(x=>x.length>190)) warnings.push(`${where}: long body item may reduce readability`);
    if(!Array.isArray(s.evidence_ids)) errors.push(`${where}: evidence_ids[] is required, even when empty`);
    else {
      for(const id of s.evidence_ids) if(!ids.has(id)) errors.push(`${where}: evidence ID ${id} absent from ledger`);
      if (i>0 && !s.evidence_ids.length && s.type!=='closing') warnings.push(`${where}: no evidence ID — verify all factual claims manually`);
    }
    if(s.type==='metrics') {
      if(!Array.isArray(s.metrics)||!s.metrics.length||s.metrics.length>4) errors.push(`${where}: metrics requires 1–4 items`);
      else for(const m of s.metrics) if(!isString(m.label)||!isString(m.value)) errors.push(`${where}: each metric requires label and value`);
      if(!(s.evidence_ids?.length)) errors.push(`${where}: metrics require evidence IDs`);
    }
    if(s.type==='chart') {
      const c=s.chart;
      const scatter=['scatter','cdf'].includes(c?.kind), series=c?.series||[{name:c?.series_name||'Series',values:c?.values}];
      const labels=scatter?c?.x_values:c?.categories, pointLimit=c?.kind==='cdf'?400:scatter?200:9;
      const validSeries=Array.isArray(series)&&series.length>=1&&series.length<=6&&series.every(v=>isString(v.name)&&Array.isArray(v.values)&&v.values.length===labels?.length&&v.values.every(x=>typeof x==='number'&&Number.isFinite(x)&&!(c.kind==='bar'&&x<0)));
      const validAxes=scatter?Array.isArray(labels)&&labels.length>=2&&labels.length<=pointLimit&&labels.every(Number.isFinite)&&isString(c.x_unit):Array.isArray(labels)&&labels.length>=2&&labels.length<=pointLimit&&labels.every(isString);
      if(!c || !['bar','line','scatter','cdf'].includes(c.kind) || !validAxes || !validSeries || !isString(c.unit) || !isString(c.y_axis_label)) errors.push(`${where}: ${c?.kind||'chart'} requires valid axes, 1–6 finite series, unit, and y_axis_label`);
      if(c?.kind==='cdf'&&validSeries){
        if(!Array.isArray(c.raw_values)||c.raw_values.length<2||c.raw_values.length>200||c.raw_values.some(v=>typeof v!=='number'||!Number.isFinite(v)))errors.push(`${where}: CDF raw_values must contain 2–200 finite observations`);
        else{const expected=empiricalCdfStep(c.raw_values);if(JSON.stringify(expected.x_values)!==JSON.stringify(labels)||JSON.stringify(expected.values)!==JSON.stringify(series[0].values))errors.push(`${where}: CDF plotted staircase must be derived from raw_values using grouped ties and cumulative count / n`);}
        if(series.length!==1||!Number.isInteger(c.sample_size)||c.sample_size!==c.raw_values?.length)errors.push(`${where}: CDF requires one series and sample_size equal to raw observation count`);
        if(series[0].values.some((v,i)=>v<0||v>1||(i>0&&v<series[0].values[i-1]))||labels.some((v,i)=>i>0&&v<labels[i-1]))errors.push(`${where}: CDF x values must be sorted and cumulative probabilities must be nondecreasing within [0,1]`);
      }
      else if (c && (!Number.isInteger(c.sample_size) || c.sample_size < 1)) warnings.push(`${where}: chart sample_size is missing; state the basis in notes before interpreting values`);
      if(c?.kind==='bar'&&c?.min_value!==undefined && c?.min_value>0) errors.push(`${where}: truncated chart axis can exaggerate differences; use a zero baseline for bar charts`);
      if(c?.uncertainty){
        const u=c.uncertainty,statSeries=series.length===1?series[0]:null;
        if(c.kind!=='bar'||!statSeries||u.method!=='two-sided Student-t confidence interval for the mean; assumes independent, approximately normal run-level values'||u.confidence_level!==0.95||u.independent_unit!=='run_id'||u.minimum_runs_per_condition!==10||!Array.isArray(statSeries.run_values)||statSeries.run_values.length!==labels?.length||!Array.isArray(statSeries.error_minus)||!Array.isArray(statSeries.error_plus)||statSeries.error_minus.length!==labels?.length||statSeries.error_plus.length!==labels?.length||!Array.isArray(statSeries.run_ids)||statSeries.run_ids.length!==labels?.length||!Array.isArray(statSeries.observation_ids)||statSeries.observation_ids.length!==labels?.length||!Array.isArray(statSeries.source_rows)||statSeries.source_rows.length!==labels?.length)errors.push(`${where}: repeated-run uncertainty requires one bar series with complete values, run IDs, observation IDs, source rows, Student-t intervals, and the supported method`);
        else{
          const allRunIds=statSeries.run_ids.flat(),allObservationIds=statSeries.observation_ids.flat();
          if(new Set(allRunIds).size!==allRunIds.length||new Set(allObservationIds).size!==allObservationIds.length)errors.push(`${where}: run_id and observation_id values must be unique across all conditions`);
          for(let j=0;j<labels.length;j++){
          const vals=statSeries.run_values[j],ids=statSeries.run_ids[j],obs=statSeries.observation_ids[j],locators=statSeries.source_rows[j];
          if(!Array.isArray(vals)||!Array.isArray(ids)||!Array.isArray(obs)||!Array.isArray(locators)||vals.length<10||ids.length!==vals.length||obs.length!==vals.length||locators.length!==vals.length||ids.some((id,i)=>!isString(id)||ids.indexOf(id)!==i)||obs.some((id,i)=>!isString(id)||obs.indexOf(id)!==i)||locators.some(n=>!Number.isInteger(n)||n<2)||statSeries.error_minus[j]<0||statSeries.error_plus[j]<0){errors.push(`${where}: each condition requires at least 10 finite uniquely identified run observations and nonnegative interval widths`);break;}
          try{const expected=studentTMeanInterval(vals,{confidence:u.confidence_level});if(Math.abs(expected.mean-statSeries.values[j])>1e-10||Math.abs(expected.error_minus-statSeries.error_minus[j])>1e-10||Math.abs(expected.error_plus-statSeries.error_plus[j])>1e-10)errors.push(`${where}: mean or Student-t interval does not match raw run_values for ${labels[j]}`);}catch(error){errors.push(`${where}: ${error.message}`);}
          if(vals.every(v=>v===vals[0]))warnings.push(`${where}: ${labels[j]} has zero observed run-to-run variance and a zero-width interval; confirm measurement precision and run independence`);
        }
        }
        if(c.sample_size!==undefined&&statSeries?.run_values?.length&&c.sample_size!==Math.min(...statSeries.run_values.map(v=>v.length)))errors.push(`${where}: sample_size must equal the minimum independent run count across conditions`);
      }
      if(!(s.evidence_ids?.length)) errors.push(`${where}: charts require evidence IDs`);
    }
    if(s.type==='process' && (!Array.isArray(s.steps)||s.steps.length<2||s.steps.length>6||s.steps.some(x=>!boundedText(x,45)))) errors.push(`${where}: process requires 2–6 steps under 45 characters`);
    if (s.type==='bullets' && (!s.body?.length || s.body.length>5)) errors.push(`${where}: bullets requires 1–5 body items`);
    if(s.type==='statement' && !s.evidence_ids?.length) warnings.push(`${where}: assertion has no evidence ID; confirm this is not presented as a finding`);
    if(MANUAL_ONLY_TYPES.has(s.type) && i===0) warnings.push(`${where}: recommended first slide type is cover`);
  }
  return {deck,errors,warnings};
}
