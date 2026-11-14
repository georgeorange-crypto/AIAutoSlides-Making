import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {auditTextContrast} from '../src/contrast.mjs';
import {generatePresentation} from '../src/render.mjs';

const shape=(text,color,geometry='<a:off x="0" y="0"/><a:ext cx="1000000" cy="200000"/>',fill='<a:noFill/>')=>`<p:sp><p:spPr><a:xfrm>${geometry}</a:xfrm>${fill}</p:spPr><p:txBody><a:p><a:r><a:rPr sz="1800"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;

test('actual PPTX text contrast uses the slide background and blocks pale text',()=>{
 const xml=`<p:sld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></p:bgPr></p:bg>${shape('Readable title','171717')}${shape('Pale title','A0A0A0','<a:off x="0" y="300000"/><a:ext cx="1000000" cy="200000"/>')}</p:sld>`;
 const result=auditTextContrast(xml,{slideBackground:'FFFFFF'});assert.equal(result.status,'fail');assert.equal(result.checked_text_runs,2);assert.equal(result.violations.length,1);assert.equal(result.violations[0].text,'Pale title');assert.ok(result.violations[0].ratio<4.5);
});

test('actual PPTX contrast considers every known background beneath a text box',()=>{
 const panel=`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="400000"/></a:xfrm><a:solidFill><a:srgbClr val="F4F4F1"/></a:solidFill></p:spPr></p:sp>`,label=shape('Panel label','31465A','<a:off x="0" y="100000"/><a:ext cx="1000000" cy="200000"/>');
 const result=auditTextContrast(`<p:sld>${panel}${label}</p:sld>`,{slideBackground:'FFFFFF'});assert.equal(result.status,'pass');assert.equal(result.violations.length,0);assert.deepEqual(result.violations,[]);assert.ok(result.minimumContrastRatio>=4.5);
});

test('actual PPTX contrast composites a simple alpha panel over the slide background',()=>{
 const panel=`<p:sp><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="400000"/></a:xfrm><a:solidFill><a:srgbClr val="000000"><a:alpha val="50000"/></a:srgbClr></a:solidFill></p:spPr></p:sp>`,label=shape('Alpha panel label','888888','<a:off x="0" y="100000"/><a:ext cx="1000000" cy="200000"/>');
 const result=auditTextContrast(`<p:sld>${panel}${label}</p:sld>`,{slideBackground:'FFFFFF'});assert.equal(result.status,'fail');assert.equal(result.violations[0].background,'808080');assert.ok(result.violations[0].ratio<4.5);
});

test('actual PPTX contrast fails closed when the text background is an unsupported image fill',()=>{
 const picture='<p:pic><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="400000"/></a:xfrm><a:blipFill><a:blip r:embed="rId1"/></a:blipFill></p:spPr></p:pic>',label=shape('Image-backed text','31465A','<a:off x="0" y="100000"/><a:ext cx="1000000" cy="200000"/>');
 const result=auditTextContrast(`<p:sld>${picture}${label}</p:sld>`);assert.equal(result.status,'incomplete');assert.equal(result.unmeasured.length,1);assert.match(result.unmeasured[0].reason,/background is unknown/);
});

test('actual PPTX QA rejects custom low-contrast run colors even when the selected theme is valid',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-text-contrast-'));
 try{
  const out=path.join(dir,'contrast.pptx'),theme=JSON.parse(fs.readFileSync('themes/academic-light.json','utf8')),deck={meta:{title:'Synthetic contrast fixture',subtitle:'Color audit',theme:'academic-light',status:'SYNTHETIC'},slides:[{slide_id:'S01',type:'statement',title:'A custom text color is part of the emitted file.',body:['Synthetic fixture used to audit actual PPTX colors.'],evidence_ids:['E1']}]},ledger={entries:[{id:'E1',label:'Synthetic contrast QA',source:'fixture',verified:false,note:'Generated QA fixture only.'}]};
  await generatePresentation(deck,ledger,theme,out);fs.writeFileSync(out.replace(/\.pptx$/i,'.review.json'),JSON.stringify({theme:'academic-light'}));const files=unzipSync(new Uint8Array(fs.readFileSync(out))),slidePath='ppt/slides/slide1.xml',xml=strFromU8(files[slidePath]);assert.ok(xml.includes('Synthetic fixture used to audit actual PPTX colors.'));assert.ok(xml.includes('val="31465A"'));files[slidePath]=strToU8(xml.replace('val="31465A"','val="A0A0A0"'));fs.writeFileSync(out,zipSync(files));
  const qa=spawnSync(process.execPath,['src/qa.mjs',out],{encoding:'utf8'});assert.equal(qa.status,1,qa.stdout);const report=JSON.parse(fs.readFileSync(out.replace(/\.pptx$/i,'.qa.json'),'utf8'));assert.ok(report.theme.pairsBelowMinimum.length===0,'the palette-only audit must still pass');assert.ok(report.errors.some(message=>/Slide 1 has .* below the 4.5:1 contrast floor/.test(message)),report.errors.join('\n'));assert.ok(report.objectiveFindings.some(item=>item.id==='TEXT-CONTRAST-001'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
