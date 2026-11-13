import test from 'node:test';
import assert from 'node:assert/strict';
import {critiqueRenderedPages} from '../packages/workflow/rendered-critic.mjs';

const deck={slides:[{slide_id:'S01',title:'研究结果',assertion_title:'Latency improved',evidence_ids:['E1'],elements:[{element_id:'C1',kind:'chart',x_axis_label:'Request rate',y_axis_label:'Latency ms',series:[{name:'A'}]}]}]};

test('rendered-page Critic checks real page text with injected local recognizer and never reports scientific approval',async()=>{
 const calls=[],report=await critiqueRenderedPages({presentationIR:deck,pages:[{format:'png',path:'fixture-page-1.png',sha256:'a'.repeat(64)}],recognizerFactory:async language=>{calls.push(language);return{recognize:async image=>{assert.equal(image,'fixture-page-1.png');return{text:'研究结果 Latency improved Request rate Latency ms',confidence:91.3};},close:async()=>calls.push('closed')}}});
 assert.deepEqual(calls,['chi_sim+eng','closed']);
 assert.equal(report.status,'text_detected');
 assert.equal(report.pages[0].coverage,1);
 assert.equal(report.pages[0].image_sha256,'a'.repeat(64));
 assert.ok(report.limitations.some(item=>item.includes('does not prove')));
});

test('rendered-page Critic reports missing and low-coverage pages without inventing visual success',async()=>{
 const report=await critiqueRenderedPages({presentationIR:{slides:[...deck.slides,{slide_id:'S02',title:'Missing page',elements:[]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:'',confidence:0}),close:async()=>{}})});
 assert.equal(report.status,'incomplete');
 assert.equal(report.pages[0].status,'low_text_coverage');
 assert.equal(report.pages[1].status,'missing_page_image');
});

test('rendered-page Critic records when no preview exists',async()=>{
 const report=await critiqueRenderedPages({presentationIR:deck,pages:[]});
 assert.equal(report.status,'not_rendered');
});

test('rendered-page Critic degrades gracefully when local OCR cannot initialize or recognize a page',async()=>{
 const pages=[{format:'png',path:'fixture-page-1.png'}];
 const unavailable=await critiqueRenderedPages({presentationIR:deck,pages,recognizerFactory:async()=>{throw new Error('trained data missing');}});
 assert.equal(unavailable.status,'unavailable');assert.match(unavailable.error,/trained data missing/);
 let closed=false;const partial=await critiqueRenderedPages({presentationIR:deck,pages,recognizerFactory:async()=>({recognize:async()=>{throw new Error('bad preview');},close:async()=>{closed=true;throw new Error('worker shutdown warning');}})});
 assert.equal(partial.status,'partial');assert.equal(partial.pages[0].status,'ocr_failed');assert.equal(closed,true);
});
