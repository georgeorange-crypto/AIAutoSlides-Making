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
 assert.ok(report.limitations.some(item=>item.includes('horizontal overflow')));
});

test('rendered-page Critic reports missing and low-coverage pages without inventing visual success',async()=>{
 const report=await critiqueRenderedPages({presentationIR:{slides:[...deck.slides,{slide_id:'S02',title:'Missing page',elements:[]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:'',confidence:0}),close:async()=>{}})});
 assert.equal(report.status,'incomplete');
 assert.equal(report.pages[0].status,'low_text_coverage');
 assert.equal(report.pages[1].status,'missing_page_image');
});

test('rendered-page Critic measures OCR word-box union after excluding the authored title box',async()=>{
 const report=await critiqueRenderedPages({presentationIR:deck,renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[{text:'研究结果',x:100,y:50,w:800,h:100},{text:'Request rate',x:100,y:300,w:800,h:300}]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:'研究结果 Latency improved',confidence:90,image_width:1000,image_height:1000,words:[{text:'研究结果',bbox:{x0:200,y0:60,x1:700,y1:120}},{text:'Latency',bbox:{x0:200,y0:400,x1:500,y1:450}},{text:'improved',bbox:{x0:510,y0:400,x1:800,y1:450}}]}),close:async()=>{}})});
 assert.ok(report.pages[0].visible_text_occupancy_ratio>0.04);
});

test('rendered-page Critic detects authored body words rendered below their text-box bounds',async()=>{
 const body='The body explanation overflows its box and continues below.';
 const report=await critiqueRenderedPages({presentationIR:{slides:[{slide_id:'S01',title:'A clear claim',elements:[{element_id:'T1',kind:'text',text:body}]}]},renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[{text:body,x:100,y:300,w:800,h:200}]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:body,confidence:90,image_width:1000,image_height:1000,words:[{text:'explanation',bbox:{x0:170,y0:420,x1:340,y1:450}},{text:'continues',bbox:{x0:100,y0:530,x1:240,y1:560}},{text:'below',bbox:{x0:260,y0:530,x1:340,y1:560}}]}),close:async()=>{}})});
 assert.equal(report.pages[0].body_text_overflow_word_count,2);
});

test('rendered-page Critic recognizes single-character CJK OCR tokens in overflowing body copy',async()=>{
 const body='内容溢出文本框并继续显示。';
 const report=await critiqueRenderedPages({presentationIR:{slides:[{slide_id:'S01',title:'检查排版',elements:[{element_id:'T1',kind:'text',text:body}]}]},renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[{text:body,x:100,y:300,w:800,h:200}]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:body,confidence:90,image_width:1000,image_height:1000,words:[{text:'溢',bbox:{x0:120,y0:530,x1:160,y1:560}},{text:'出',bbox:{x0:160,y0:530,x1:200,y1:560}}]}),close:async()=>{}})});
 assert.equal(report.pages[0].body_text_overflow_word_count,2);
});

test('rendered-page Critic ignores unrelated footer words and OCR box jitter near the body boundary',async()=>{
 const body='The body explanation continues here.';
 const report=await critiqueRenderedPages({presentationIR:{slides:[{slide_id:'S01',title:'A clear claim',elements:[{element_id:'T1',kind:'text',text:body}]}]},renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[{text:body,x:100,y:300,w:800,h:200}]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:`${body} Chapter 1`,confidence:90,image_width:1000,image_height:1000,words:[{text:'continues',bbox:{x0:200,y0:505,x1:340,y1:515}},{text:'Chapter',bbox:{x0:500,y0:540,x1:650,y1:570}}]}),close:async()=>{}})});
 assert.equal(report.pages[0].body_text_overflow_word_count,0);
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
