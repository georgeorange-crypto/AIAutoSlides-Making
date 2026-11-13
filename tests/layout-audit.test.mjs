import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTextLayout} from '../src/layout-audit.mjs';

const shape=(x,y,w,h,size=1200,text='Label')=>`<p:sp><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:rPr sz="${size}"/><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
test('text layout audit identifies bounds, overlaps, and small fonts even in the footer area',()=>{
 const xml=shape(0,0,100000,100000,800)+shape(50000,50000,100000,100000,1200)+shape(200000,0,100000,100000,900)+shape(0,950000,100000,40000,700);
 const report=auditTextLayout(xml,250000,1000000);
 assert.equal(report.textBounds[0].ok,true);assert.equal(report.textBounds[2].ok,false);
 assert.equal(report.overlaps.length,1);assert.deepEqual(report.smallText.map(x=>x.min_font_size_pt),[8,9,7]);assert.equal(report.smallText[2].text,'Label');
});

test('text with inherited or absent explicit font size is reported as unmeasured, regardless of vertical position',()=>{
 const xml='<p:sp><p:spPr><a:xfrm><a:off x="0" y="950000"/><a:ext cx="100000" cy="40000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Long footer-like body content</a:t></a:r></a:p></p:txBody></p:sp>';
 const report=auditTextLayout(xml,250000,1000000);
 assert.deepEqual(report.smallText,[]);assert.equal(report.unmeasuredText.length,1);assert.match(report.unmeasuredText[0].text,/Long footer/);
});

test('slide bounds audit covers pictures, chart frames, connectors, and negative coordinates',()=>{
 const xml='<p:spTree><p:pic><p:spPr><a:xfrm><a:off x="-1" y="10"/><a:ext cx="20" cy="20"/></a:xfrm></p:spPr></p:pic><p:graphicFrame><p:xfrm><a:off x="10" y="10"/><a:ext cx="20" cy="20"/></p:xfrm><c:chart><c:txPr><a:defRPr sz="1050"/></c:txPr></c:chart></p:graphicFrame><p:cxnSp><p:spPr><a:xfrm><a:off x="90" y="40"/><a:ext cx="20" cy="10"/></a:xfrm></p:spPr></p:cxnSp></p:spTree>';
 const result=auditTextLayout(xml,100,100);
 assert.deepEqual(result.elementBounds.map(item=>item.ok),[false,true,false]);
 assert.deepEqual(result.elementBounds.map(item=>item.element),['pic','graphicFrame','cxnSp']);
 assert.deepEqual(result.smallText.map(item=>item.min_font_size_pt),[10.5]);
});
