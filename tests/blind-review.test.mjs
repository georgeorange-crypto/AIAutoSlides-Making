import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {prepareBlindReview,recordBlindRating,summarizeBlindRatings,unblindRatings,REVIEW_RUBRIC} from '../src/blind-review.mjs';

const scores={scientific_accuracy:5,narrative_logic:4,visual_evidence:3,design_consistency:4,readability_accessibility:5,engineering_delivery:4};
test('blind comparison randomizes deck labels, validates a fixed rubric, summarizes without unblinding, then reveals condition key',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-blind-')),a=path.join(dir,'actual-native.pptx'),b=path.join(dir,'actual-alt.pptx'),out=path.join(dir,'blinded');fs.writeFileSync(a,'native-deck');fs.writeFileSync(b,'alternate-deck');
 try{
  const manifest=prepareBlindReview({deckA:a,deckB:b,outDir:out,randomBytes:()=>Buffer.from([1])});assert.deepEqual(manifest.decks.map(d=>d.file),['deck-A.pptx','deck-B.pptx']);assert.equal(manifest.decks[0].sha256,requireHash(b));
  assert.equal(fs.existsSync(path.join(out,'blind-manifest.json')),true);const key=JSON.parse(fs.readFileSync(path.join(out,'blind-key.json'),'utf8'));assert.equal(key.assignment.A,'condition-B');
  const rating=recordBlindRating({manifest,deckId:'A',reviewerId:'R01',scores,note:'Readable, source labels clear'});assert.equal(rating.weighted_score_0_100,83);assert.deepEqual(rating.rubric,REVIEW_RUBRIC);
  assert.throws(()=>recordBlindRating({manifest,deckId:'A',reviewerId:'R1',scores:{...scores,scientific_accuracy:6}}),/integer from 1 to 5/);
  assert.throws(()=>summarizeBlindRatings([rating]),/both A and B/);
  const paired=recordBlindRating({manifest,deckId:'B',reviewerId:'R01',scores:{...scores,visual_evidence:4}}),summary=summarizeBlindRatings([rating,paired]);assert.equal(summary.status,'blinded-summary');assert.equal('condition'in summary.decks[0],false);
  const revealed=unblindRatings({ratings:[rating,paired],key});assert.equal(revealed.status,'unblinded-summary');assert.equal(revealed.decks.find(d=>d.blind_id==='A').condition,'condition-B');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
function requireHash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
