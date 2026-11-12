import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createTalkReadingDecks} from '../src/deck-profiles.mjs';
import {loadEvidence,validateDeck} from '../src/validate.mjs';

test('talk and reading editions branch from one storyboard and evidence graph',()=>{
 const source=JSON.parse(fs.readFileSync('examples/research-demo.json','utf8')),ledger=loadEvidence('sources/evidence.json'),{talk,reading,appendixSlides,sourceIds}=createTalkReadingDecks(source,ledger);
 assert.equal(talk.meta.mode,'talk');assert.equal(reading.meta.mode,'reading');assert.equal(talk.slides.length,source.slides.length);assert.equal(reading.slides.length,source.slides.length+appendixSlides);assert.deepEqual(talk.slides,source.slides);assert.deepEqual(talk.slides,reading.slides.slice(0,source.slides.length));assert.deepEqual(validateDeck(talk,ledger).errors,[]);assert.deepEqual(validateDeck(reading,ledger).errors,[]);assert.deepEqual(sourceIds,[...new Set(source.slides.flatMap(s=>s.evidence_ids||[]))]);
 const dataPages=reading.slides.filter(s=>s.kicker==='FIGURE DATA');assert.ok(dataPages.length);assert.match(dataPages[0].speaker_notes,/chart/i);assert.ok(dataPages.every(s=>s.evidence_ids.includes('E1')));
});
