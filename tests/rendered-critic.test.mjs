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
 assert.ok(report.limitations.some(item=>item.includes('all four text-box edges')));
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

test('rendered-page Critic detects OCR word boxes colliding inside the native chart bounds',async()=>{
 const qa={slideWidthEmu:1000,slideHeightEmu:1000,charts:1,chartBounds:[{ok:true,x:100,y:100,w:800,h:700}]};
 const words=[{text:'12',confidence:95,bbox:{x0:250,y0:300,x1:320,y1:350}},{text:'18',confidence:95,bbox:{x0:280,y0:310,x1:330,y1:360}},{text:'title',confidence:95,bbox:{x0:105,y0:20,x1:180,y1:60}}];
 const report=await critiqueRenderedPages({presentationIR:deck,renderedQa:{slides:[qa]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:'研究结果 Latency improved Request rate Latency ms 12 18 title',confidence:90,image_width:1000,image_height:1000,words}),close:async()=>{}})});
 assert.equal(report.pages[0].chart_text_overlap_count,1);assert.deepEqual(report.pages[0].chart_text_overlaps.map(item=>[item.text_a,item.text_b]),[['12','18']]);
});

test('rendered-page Critic measures title words against title-box geometry and reports overflow',async()=>{
 const title='A title extending past its right edge',words=['title','extending','past','its'].map((text,index)=>({text,confidence:95,bbox:{x0:130+index*55,y0:120,x1:175+index*55,y1:150}}));words.push({text:'right',confidence:95,bbox:{x0:440,y0:120,x1:495,y1:150}},{text:'edge',confidence:95,bbox:{x0:510,y0:120,x1:560,y1:150}});
 const renderedQa={slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[{text:title,x:100,y:100,w:300,h:100}]}]},pages=[{format:'png',path:'fixture-page-1.png'}],recognizerFactory=async()=>({recognize:async()=>({text:title,confidence:90,image_width:1000,image_height:1000,words}),close:async()=>{}});
 const report=await critiqueRenderedPages({presentationIR:{slides:[{slide_id:'S01',title,elements:[]}]},renderedQa,pages,recognizerFactory});assert.equal(report.pages[0].title_text_overflow_word_count,2);assert.deepEqual(report.pages[0].title_text_overflow_directions,{above:0,below:0,left:0,right:2});
 const missing=await critiqueRenderedPages({presentationIR:{slides:[{slide_id:'S01',title,elements:[]}]},renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[]}]},pages,recognizerFactory});assert.equal(missing.pages[0].title_text_overflow_word_count,null);assert.equal(missing.pages[0].title_text_overflow_reason,'title_text_box_missing');
});

test('rendered-page Critic marks chart collision screen unmeasured without chart geometry or enough detected labels',async()=>{
 const words=[{text:'12',bbox:{x0:250,y0:300,x1:300,y1:350}}],pages=[{format:'png',path:'fixture-page-1.png'}],recognizerFactory=async()=>({recognize:async()=>({text:'12',confidence:90,image_width:1000,image_height:1000,words}),close:async()=>{}});
 const missingBounds=await critiqueRenderedPages({presentationIR:deck,renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,charts:1,chartBounds:[]}]},pages,recognizerFactory});assert.equal(missingBounds.pages[0].chart_text_overlap_count,null);
 const tooFewLabels=await critiqueRenderedPages({presentationIR:deck,renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,charts:1,chartBounds:[{ok:true,x:100,y:100,w:800,h:700}]}]},pages,recognizerFactory});assert.equal(tooFewLabels.pages[0].chart_text_overlap_count,null);
});

test('rendered-page Critic detects authored body words rendered below their text-box bounds',async()=>{
 const body='The body explanation overflows its box and continues below.';
 const report=await critiqueRenderedPages({presentationIR:{slides:[{slide_id:'S01',title:'A clear claim',elements:[{element_id:'T1',kind:'text',text:body}]}]},renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[{text:body,x:100,y:300,w:800,h:200}]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:body,confidence:90,image_width:1000,image_height:1000,words:[{text:'explanation',bbox:{x0:170,y0:420,x1:340,y1:450}},{text:'continues',bbox:{x0:100,y0:530,x1:240,y1:560}},{text:'below',bbox:{x0:260,y0:530,x1:340,y1:560}}]}),close:async()=>{}})});
 assert.equal(report.pages[0].body_text_overflow_word_count,2);
});

test('rendered-page Critic detects authored body words rendered beyond the right edge of their text box',async()=>{
 const body='The body explanation continues and overflows past its box.';
 const words=[{text:'The',bbox:{x0:120,y0:350,x1:150,y1:380}},{text:'body',bbox:{x0:160,y0:350,x1:205,y1:380}},{text:'explanation',bbox:{x0:210,y0:350,x1:300,y1:380}},{text:'continues',bbox:{x0:420,y0:350,x1:480,y1:380}},{text:'overflows',bbox:{x0:500,y0:350,x1:570,y1:380}}];
 const report=await critiqueRenderedPages({presentationIR:{slides:[{slide_id:'S01',title:'Check horizontal fit',elements:[{element_id:'T1',kind:'text',text:body}]}]},renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[{text:body,x:100,y:300,w:300,h:200}]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:body,confidence:90,image_width:1000,image_height:1000,words}),close:async()=>{}})});
 assert.equal(report.pages[0].body_text_overflow_word_count,2);assert.deepEqual(report.pages[0].body_text_overflow_directions,{above:0,below:0,left:0,right:2});
});

test('rendered-page Critic checks all four edges and does not mistake a repeated title word for body overflow',async()=>{
 const body='The measured explanation extends beyond each matching box edge.';
 const report=await critiqueRenderedPages({presentationIR:{slides:[{slide_id:'S01',title:'Measured explanation',elements:[{element_id:'T1',kind:'text',text:body}]}]},renderedQa:{slides:[{slideWidthEmu:1000,slideHeightEmu:1000,textBounds:[{text:'Measured explanation',x:100,y:250,w:700,h:100},{text:body,x:300,y:300,w:400,h:300}]}]},pages:[{format:'png',path:'fixture-page-1.png'}],recognizerFactory:async()=>({recognize:async()=>({text:`Measured explanation ${body}`,confidence:90,image_width:1000,image_height:1000,words:[{text:'Measured',bbox:{x0:120,y0:280,x1:220,y1:310}},{text:'explanation',bbox:{x0:230,y0:280,x1:290,y1:310}},{text:'The',bbox:{x0:100,y0:400,x1:130,y1:430}},{text:'measured',bbox:{x0:720,y0:400,x1:780,y1:430}},{text:'beyond',bbox:{x0:400,y0:240,x1:490,y1:270}},{text:'edge',bbox:{x0:400,y0:620,x1:480,y1:650}}]}),close:async()=>{}})});
 assert.equal(report.pages[0].body_text_overflow_word_count,4,JSON.stringify(report.pages[0].body_text_overflow_directions));assert.deepEqual(report.pages[0].body_text_overflow_directions,{above:1,below:1,left:1,right:1});assert.equal(report.pages[0].title_text_overflow_word_count,0,'a repeated title word inside its separate body box is not title overflow');
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
