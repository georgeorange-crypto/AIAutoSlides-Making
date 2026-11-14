import test from 'node:test';
import assert from 'node:assert/strict';
import {auditChartText,auditTextLayout} from '../src/layout-audit.mjs';

const shape=(x,y,w,h,size=1200,text='Label',font='Aptos')=>`<p:sp><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:rPr sz="${size}"><a:latin typeface="${font}"/></a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
test('text layout audit identifies bounds, overlaps, and small fonts even in the footer area',()=>{
 const xml=shape(0,0,100000,100000,800)+shape(50000,50000,100000,100000,1200)+shape(200000,0,100000,100000,900)+shape(0,950000,100000,40000,700);
 const report=auditTextLayout(xml,250000,1000000);
 assert.equal(report.textBounds[0].ok,true);assert.equal(report.textBounds[2].ok,false);
 assert.equal(report.overlaps.length,1);assert.deepEqual(report.smallText.map(x=>x.min_font_size_pt),[8,12,9,7]);assert.equal(report.smallText[2].text,'Label');
});

test('14 pt is the hard rendered-text floor',()=>{
 const report=auditTextLayout(shape(0,0,100000,100000,1399,'Too small')+shape(120000,0,100000,100000,1400,'Readable'),250000,1000000);
 assert.deepEqual(report.smallText.map(item=>item.text),['Too small']);
});

test('chart-part text audit measures data-label fonts and catches small or theme-mismatched labels',()=>{
 const chart='<c:chartSpace><c:dLbls><c:txPr><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1200"><a:latin typeface="Arial"/></a:defRPr></a:pPr></a:p></c:txPr></c:dLbls><c:catAx><c:txPr><a:p><a:pPr><a:defRPr sz="1400"><a:latin typeface="Aptos"/></a:defRPr></a:pPr></a:p></c:txPr></c:catAx></c:chartSpace>';
 const report=auditChartText(chart);assert.deepEqual(report.fontFaces,['Arial','Aptos']);assert.equal(report.textStyleCount,2);assert.deepEqual(report.smallText.map(item=>item.min_font_size_pt),[12]);assert.equal(report.unmeasuredText.length,0);assert.equal(report.unmeasuredFonts.length,0);
});

test('chart-part text audit marks inherited font and size styles unmeasured',()=>{
 const report=auditChartText('<c:chartSpace><c:valAx><c:txPr><a:p><a:pPr><a:defRPr/></a:pPr></a:p></c:txPr></c:valAx></c:chartSpace>');assert.equal(report.unmeasuredText.length,1);assert.equal(report.unmeasuredFonts.length,1);
});

test('text with inherited or absent explicit font size is reported as unmeasured, regardless of vertical position',()=>{
 const xml='<p:sp><p:spPr><a:xfrm><a:off x="0" y="950000"/><a:ext cx="100000" cy="40000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:t>Long footer-like body content</a:t></a:r></a:p></p:txBody></p:sp>';
 const report=auditTextLayout(xml,250000,1000000);
 assert.deepEqual(report.smallText,[]);assert.equal(report.unmeasuredText.length,1);assert.match(report.unmeasuredText[0].text,/Long footer/);
});

test('text layout audit records explicit font families and reports inherited font faces',()=>{
 const inherited='<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100000" cy="100000"/></a:xfrm></p:spPr><p:txBody><a:p><a:r><a:rPr sz="1400"/><a:t>Inherited family</a:t></a:r></a:p></p:txBody></p:sp>';
 const result=auditTextLayout(shape(0,0,100000,100000,1800,'Heading','Aptos Display')+shape(120000,0,100000,100000,1400,'Body','Aptos')+inherited,300000,200000);
 assert.deepEqual(result.fontFaces,['Aptos Display','Aptos']);assert.equal(result.unmeasuredFonts.length,1);assert.match(result.unmeasuredFonts[0].text,/Inherited family/);
});

test('slide bounds audit covers pictures, chart frames, connectors, and negative coordinates',()=>{
 const xml='<p:spTree><p:pic><p:spPr><a:xfrm><a:off x="-1" y="10"/><a:ext cx="20" cy="20"/></a:xfrm></p:spPr></p:pic><p:graphicFrame><p:xfrm><a:off x="10" y="10"/><a:ext cx="20" cy="20"/></p:xfrm><c:chart><c:txPr><a:defRPr sz="1050"/></c:txPr></c:chart></p:graphicFrame><p:cxnSp><p:spPr><a:xfrm><a:off x="90" y="40"/><a:ext cx="20" cy="10"/></a:xfrm></p:spPr></p:cxnSp></p:spTree>';
 const result=auditTextLayout(xml,100,100);
 assert.deepEqual(result.elementBounds.map(item=>item.ok),[false,true,false]);
 assert.deepEqual(result.elementBounds.map(item=>item.element),['pic','graphicFrame','cxnSp']);
 assert.deepEqual(result.smallText.map(item=>item.min_font_size_pt),[10.5]);
});

test('visual group QA unions named native shapes and connectors into one measurable footprint',()=>{
 const tagged=(type,x,y,w,h)=>`<p:${type}><p:nvSpPr><p:cNvPr id="1" name="AIAutoSlidesVisualGroup:S01:diagram"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm></p:spPr></p:${type}>`;
 const result=auditTextLayout(tagged('sp',100,200,300,400)+tagged('cxnSp',800,1000,500,200),2000,2000);
 assert.deepEqual(result.visualGroupBounds,[{group_id:'S01:diagram',kind:'diagram',ok:true,member_count:2,unmeasured_member_count:0,x:100,y:200,w:1200,h:1000,area_ratio:0.055,bounds_area_ratio:0.3}]);
});

test('visual group QA marks incomplete member geometry instead of treating the partial group as measured',()=>{
 const measured='<p:sp><p:nvSpPr><p:cNvPr id="1" name="AIAutoSlidesVisualGroup:S02:process"/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr></p:sp>';
 const missing='<p:sp><p:nvSpPr><p:cNvPr id="2" name="AIAutoSlidesVisualGroup:S02:process"/></p:nvSpPr></p:sp>';
 const result=auditTextLayout(measured+missing,1000,1000);
 assert.equal(result.visualGroupBounds[0].member_count,2);assert.equal(result.visualGroupBounds[0].unmeasured_member_count,1);assert.equal(result.visualGroupBounds[0].ok,false);assert.equal(result.visualGroupBounds[0].area_ratio,0.01);
});
