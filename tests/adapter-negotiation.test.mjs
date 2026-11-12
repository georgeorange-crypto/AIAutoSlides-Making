import test from 'node:test';
import assert from 'node:assert/strict';
import {defineToolAdapter,definePresentationAdapter} from '../packages/adapters/protocol.mjs';
import {slidevAdapter} from '../packages/adapters/slidev.mjs';

test('tool adapters negotiate requested formats and feature requirements before execution',async()=>{
 const adapter=defineToolAdapter({manifest:{id:'fixture',version:'1',status:'ready'},async doctor(){return{ok:true};},async probeCapabilities(){return{formats:['svg','png'],nativeCharts:false,editableObjects:['text','shapes']};},async run(){}});
 const supported=await adapter.negotiate({formats:['svg'],requirements:{editableObjects:['text']}});
 assert.equal(supported.status,'supported');assert.deepEqual(supported.formats,['svg']);
 await assert.rejects(adapter.negotiate({requirements:{nativeCharts:true}}),/Requested formats must be a non-empty array/);
 const rejected=await adapter.negotiate({formats:['pptx'],requirements:{nativeCharts:true,editableObjects:['charts']}});
 assert.equal(rejected.status,'unsupported');assert.deepEqual(rejected.reasons,["Unsupported output format 'pptx'","Required capability 'nativeCharts' is unavailable","Required 'editableObjects' value 'charts' is unavailable"]);
});

test('presentation adapters negotiate formats against their renderer capability report',async()=>{
 const adapter=definePresentationAdapter({manifest:{id:'renderer',version:'1',kind:'deck-backend',status:'ready',capabilities:['native-pptx'],platforms:['win32'],inputs:['presentation-ir-1.0.0'],outputs:['pptx'],needsNetwork:false,needsAuth:false},async probe(){return{status:'available'};},async capabilities(){return{formats:['pptx'],nativeCharts:true,editableObjects:['text','chart']};},async render(){}});
 assert.equal((await adapter.negotiate({format:'pptx',requirements:{nativeCharts:true}})).ok,true);
 const missing=await adapter.negotiate({format:'pdf',requirements:{nativeCharts:false}});
 assert.equal(missing.status,'unsupported');assert.deepEqual(missing.reasons,["Unsupported output format 'pdf'"]);
});

test('capability negotiation fails closed when a probe throws',async()=>{
 const adapter=defineToolAdapter({manifest:{id:'offline',version:'1',status:'ready'},async doctor(){return{ok:true};},async probeCapabilities(){throw new Error('runtime absent');},async run(){}});
 const result=await adapter.negotiate({formats:['pptx']});
 assert.equal(result.status,'blocked');assert.match(result.reasons[0],/runtime absent/);
});

test('Slidev publishes its own negotiated renderer capabilities',async()=>{
 const slidev=await slidevAdapter.negotiate({formats:['pdf','png'],requirements:{nativeCharts:false,notes:true}});
 assert.equal(slidev.status,'supported');assert.deepEqual(slidev.formats,['pdf','png']);
 const slidevChart=await slidevAdapter.negotiate({format:'pptx',requirements:{nativeCharts:true}});
 assert.equal(slidevChart.status,'unsupported');assert.ok(slidevChart.reasons.length>=2);
});
