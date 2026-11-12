import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const REVIEW_RUBRIC=Object.freeze({scientific_accuracy:25,narrative_logic:20,visual_evidence:20,design_consistency:15,readability_accessibility:10,engineering_delivery:10});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function scoreDeck(scores){
  if(!scores||typeof scores!=='object'||Array.isArray(scores))throw new Error('Scores must be a JSON object');
  const required=Object.keys(REVIEW_RUBRIC),missing=required.filter(key=>!Object.hasOwn(scores,key)),unknown=Object.keys(scores).filter(key=>!required.includes(key));
  if(missing.length||unknown.length)throw new Error(`Score keys mismatch; missing: ${missing.join(',')||'none'}; unknown: ${unknown.join(',')||'none'}`);
  for(const key of required)if(!Number.isInteger(scores[key])||scores[key]<1||scores[key]>5)throw new Error(`${key} must be an integer from 1 to 5`);
  return Number(Object.entries(REVIEW_RUBRIC).reduce((sum,[key,weight])=>sum+scores[key]*weight/5,0).toFixed(2));
}
export function prepareBlindReview({deckA,deckB,outDir,randomBytes=crypto.randomBytes}={}){
  for(const [label,file] of [['A',deckA],['B',deckB]])if(!file||!fs.existsSync(file)||path.extname(file).toLowerCase()!=='.pptx')throw new Error(`Condition ${label} must be an existing PPTX file`);
  if(hash(deckA)===hash(deckB))throw new Error('Blind comparison requires two different PPTX files');
  fs.mkdirSync(outDir,{recursive:true});const swap=(randomBytes(1)[0]&1)===1,assignment=swap?{A:'condition-B',B:'condition-A'}:{A:'condition-A',B:'condition-B'};
  const inputs={'condition-A':deckA,'condition-B':deckB},decks=[];
  for(const blindId of ['A','B']){const source=inputs[assignment[blindId]],target=path.join(outDir,`deck-${blindId}.pptx`);fs.copyFileSync(source,target);decks.push({blind_id:blindId,file:path.basename(target),sha256:hash(target)});}
  const manifest={schema_version:1,status:'blinded',rubric:REVIEW_RUBRIC,decks,limitations:['Deck contents, embedded author metadata, themes, or logos may reveal the producing condition; this process randomizes labels/order but cannot guarantee perceptual blinding.','Raters must score independently before the condition key is opened. No ratings are fabricated or prefilled.']};
  fs.writeFileSync(path.join(outDir,'blind-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const key={schema_version:1,assignment,source_sha256:{'condition-A':hash(deckA),'condition-B':hash(deckB)}};
  fs.writeFileSync(path.join(outDir,'blind-key.json'),JSON.stringify(key,null,2)+'\n',{mode:0o600});
  return manifest;
}
export function recordBlindRating({manifest,deckId,reviewerId,scores,note='',reviewedAt=new Date().toISOString()}={}){
  if(!['A','B'].includes(deckId))throw new Error('deckId must be A or B');
  if(typeof reviewerId!=='string'||!reviewerId.trim())throw new Error('reviewerId is required');
  const deck=manifest?.decks?.find(item=>item.blind_id===deckId);if(!deck)throw new Error(`Unknown blinded deck ${deckId}`);
  const total=scoreDeck(scores);
  return{schema_version:1,blind_id:deckId,deck_sha256:deck.sha256,reviewer_id:reviewerId.trim(),reviewed_at:reviewedAt,scores:{...scores},weighted_score_0_100:total,note:String(note).trim(),rubric:REVIEW_RUBRIC};
}
export function summarizeBlindRatings(ratings){
  if(!Array.isArray(ratings)||!ratings.length)throw new Error('At least one blinded rating is required');
  const groups=new Map();for(const rating of ratings){if(!['A','B'].includes(rating.blind_id))throw new Error('Every rating must reference blinded deck A or B');scoreDeck(rating.scores);const list=groups.get(rating.blind_id)||[];if(list.some(item=>item.deck_sha256!==rating.deck_sha256))throw new Error(`Inconsistent deck hash for blinded deck ${rating.blind_id}`);list.push(rating);groups.set(rating.blind_id,list);}
  if(!groups.has('A')||!groups.has('B'))throw new Error('A paired blinded summary requires ratings for both A and B');
  const reviewers=new Map();for(const rating of ratings){const set=reviewers.get(rating.reviewer_id)||new Set();if(set.has(rating.blind_id))throw new Error(`Duplicate rating for reviewer ${rating.reviewer_id} and deck ${rating.blind_id}`);set.add(rating.blind_id);reviewers.set(rating.reviewer_id,set);}
  for(const [reviewer,set] of reviewers)if(set.size!==2)throw new Error(`Reviewer ${reviewer} must rate both blinded decks A and B before summarizing`);
  return{schema_version:1,status:'blinded-summary',decks:[...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([blind_id,items])=>({blind_id,rating_count:items.length,mean_weighted_score_0_100:Number((items.reduce((sum,r)=>sum+scoreDeck(r.scores),0)/items.length).toFixed(2)),criterion_means:Object.fromEntries(Object.keys(REVIEW_RUBRIC).map(key=>[key,Number((items.reduce((sum,r)=>sum+r.scores[key],0)/items.length).toFixed(2))]))})),limitation:'Descriptive ratings only. No significance or generalization without an appropriate rater/sample design.'};
}
export function unblindRatings({ratings,key}={}){
  if(!key?.assignment)throw new Error('A blind key is required');
  const blinded=summarizeBlindRatings(ratings);
  return{...blinded,status:'unblinded-summary',decks:blinded.decks.map(deck=>({...deck,condition:key.assignment[deck.blind_id]||'unknown'})).sort((a,b)=>a.condition.localeCompare(b.condition))};
}
