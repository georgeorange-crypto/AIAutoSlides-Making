import fs from 'node:fs';

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
    if (!isString(e.id) || !isString(e.label) || !isString(e.source)) throw new Error('Invalid evidence entry; id, label, source required');
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
  if (!deck.slides.length || deck.slides.length>40) errors.push('slides must have 1–40 entries');
  for (const [i,s] of deck.slides.entries()) {
    const where=`Slide ${i+1}`;
    if (!VALID_TYPES.has(s.type)) errors.push(`${where}: unsupported type ${s.type}`);
    if (!boundedText(s.title,170)) errors.push(`${where}: title must contain 1–170 characters`);
    if(s.kicker && !boundedText(s.kicker,65)) errors.push(`${where}: kicker too long`);
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
      if(!c || c.kind!=='bar' || !Array.isArray(c.categories) || !Array.isArray(c.values) || c.categories.length<2 || c.categories.length>9 || c.categories.length!==c.values.length || c.categories.some(x=>!isString(x)) || c.values.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0)) errors.push(`${where}: chart requires 2–9 finite nonnegative values matched to categories`);
      if(!(s.evidence_ids?.length)) errors.push(`${where}: charts require evidence IDs`);
    }
    if(s.type==='process' && (!Array.isArray(s.steps)||s.steps.length<2||s.steps.length>6||s.steps.some(x=>!boundedText(x,45)))) errors.push(`${where}: process requires 2–6 steps under 45 characters`);
    if (s.type==='bullets' && (!s.body?.length || s.body.length>5)) errors.push(`${where}: bullets requires 1–5 body items`);
    if(MANUAL_ONLY_TYPES.has(s.type) && i===0) warnings.push(`${where}: recommended first slide type is cover`);
  }
  return {deck,errors,warnings};
}
