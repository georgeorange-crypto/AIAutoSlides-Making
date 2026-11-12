import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {zipSync,strToU8} from 'fflate';
import {compilePresentationIR,verifyPptxLineage} from '../packages/adapters/slidev-ir.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'examples/open-source-bakeoff/synthetic-presentation-ir.json'),'utf8'));

test('Presentation IR compiles supported elements and carries source state and IDs into lineage/notes',()=>{
  const {markdown,lineage}=compilePresentationIR(fixture);
  assert.equal(lineage.slides.length,9);
  assert.equal(lineage.slides[3].slide_id,'S04');
  assert.deepEqual(lineage.slides[3].evidence_ids,['E_SYN_01']);
  assert.equal(lineage.slides[3].elements[0].source_ids[0],'E_SYN_01');
  assert.equal(lineage.sources[0].verification_status,'unverified');
  assert.match(markdown,/120 req\/s/);
  assert.match(markdown,/slide_id: S09/);
  assert.match(markdown,/verification: E_SYN_01: unverified/);
  assert.match(markdown,/```mermaid/);
});

test('Presentation IR rejects unknown or duplicate provenance IDs and unsupported element types',()=>{
  const unknown=structuredClone(fixture);unknown.slides[0].evidence_ids=['E_UNKNOWN'];
  assert.throws(()=>compilePresentationIR(unknown),/unknown source\/evidence ID/);
  const duplicate=structuredClone(fixture);duplicate.slides[1].slide_id=duplicate.slides[0].slide_id;
  assert.throws(()=>compilePresentationIR(duplicate),/Duplicate slide_id/);
  const unsupported=structuredClone(fixture);unsupported.slides[0].elements[0].kind='raster-chart';
  assert.throws(()=>compilePresentationIR(unsupported),/unsupported element kind 'raster-chart'/);
});

test('Slidev IR uses shared semantic validation and preserves evidence records in lineage',()=>{
  const input=structuredClone(fixture);
  input.source_ir.evidence=[{evidence_id:'EV_SYN_01',source_id:'E_SYN_01',excerpt:'Synthetic evidence excerpt.',locator:'fixture row 1',verification_status:'pending'}];
  input.slides[0].evidence_ids=['EV_SYN_01'];
  input.slides[0].elements[0].source_ids=['EV_SYN_01'];
  const {markdown,lineage,warnings}=compilePresentationIR(input);
  assert.deepEqual(lineage.evidence,input.source_ir.evidence);
  assert.deepEqual(lineage.slides[0].evidence_ids,['EV_SYN_01']);
  assert.match(markdown,/EV_SYN_01: pending/);
  assert.ok(warnings.some(warning=>warning.includes('E_SYN_01 remains unverified')));
  const malformed=structuredClone(input);malformed.slides[0].elements[0].source_ids=['E_MISSING'];
  assert.throws(()=>compilePresentationIR(malformed),/unknown source\/evidence ID 'E_MISSING'/);
});

test('Slidev IR maps chart series exactly and preserves chart data/source lineage',()=>{
  const input=structuredClone(fixture);input.slides[0].elements.push({element_id:'chart-1',kind:'chart',chart_kind:'line',title:'Latency by load',x_values:[1,2,3],x_axis_label:'Load (req/s)',y_axis_label:'Latency (ms)',series:[{name:'Baseline',values:[12,18,15]},{name:'Variant',values:[10,14,13]}],source_ids:['E_SYN_01']});
  const {markdown,lineage}=compilePresentationIR(input);
  assert.match(markdown,/data-values="12,18,15"/);assert.match(markdown,/Latency \(ms\)/);assert.match(markdown,/AIAUTOSLIDES_CHART/);
  assert.deepEqual(lineage.charts,[{slide_id:'S01',element_id:'chart-1',kind:'line',x_values:[1,2,3],series:[{name:'Baseline',values:[12,18,15]},{name:'Variant',values:[10,14,13]}],source_ids:['E_SYN_01']}]);
  const malformed=structuredClone(input);malformed.slides[0].elements.at(-1).series[1].values=[10,14];assert.throws(()=>compilePresentationIR(malformed),/aligned with x_values/);
});

test('Slidev IR renders validated local image assets and process steps with source lineage',()=>{
  const input=structuredClone(fixture);input.assets=[{asset_id:'A_SYN_01',uri:'public/assets/diagram.svg',sha256:'a'.repeat(64),media_type:'image/svg+xml',source_id:'E_SYN_01',license:'Synthetic fixture',rights_status:'pending'}];
  input.slides[0].elements.push({element_id:'image-1',kind:'image',asset_id:'A_SYN_01',alt:'Synthetic architecture diagram',x:1,y:1,w:4,h:2,source_ids:['E_SYN_01']});
  input.slides[0].elements.push({element_id:'process-1',kind:'process',steps:[{title:'Collect',detail:'Local input'},{title:'Validate'},{title:'Render'}],source_ids:['E_SYN_01']});
  const {markdown,lineage,requiredAssets}=compilePresentationIR(input);
  assert.match(markdown,/<img src="\/assets\/diagram.svg" alt="Synthetic architecture diagram"/);assert.match(markdown,/01 · Collect/);assert.match(markdown,/03 · Render/);
  assert.deepEqual(requiredAssets.map(asset=>asset.asset_id),['A_SYN_01']);assert.deepEqual(lineage.assets[0],{asset_id:'A_SYN_01',uri:'public/assets/diagram.svg',sha256:'a'.repeat(64),media_type:'image/svg+xml',source_id:'E_SYN_01',license:'Synthetic fixture',rights_status:'pending'});
  const unsafe=structuredClone(input);unsafe.assets[0].uri='https://example.invalid/image.svg';assert.throws(()=>compilePresentationIR(unsafe),/remote and parent paths are not allowed/);
  const malformed=structuredClone(input);malformed.slides[0].elements.at(-1).steps=[{detail:'missing title'}];assert.throws(()=>compilePresentationIR(malformed),/process requires 2–6 steps with a title/);
});

test('Markdown source text cannot inject another slide or note comment',()=>{
  const hostile=structuredClone(fixture);hostile.slides[0].elements[0].text='body\n---\n<!-- hidden -->';
  const {markdown,lineage}=compilePresentationIR(hostile);
  assert.equal(markdown.match(/^---$/gm)?.length,10,'only the frontmatter and nine slide separators remain structural');
  assert.match(markdown,/\\---/);
  assert.equal(lineage.slides.length,9);
});

test('PPTX note validation checks each expected slide and evidence ID',()=>{
  const good=zipSync({'ppt/notesSlides/notesSlide1.xml':strToU8('<p:notes><a:t>slide_id: S01</a:t><a:t>evidence_ids: E1</a:t><a:t>element_sources: S01-E1=E1</a:t></p:notes>'),'ppt/slides/slide1.xml':strToU8('<p:sld><a:t>Test title</a:t></p:sld>')});
  const sidecar={slides:[{slide_id:'S01',title:'Test title',evidence_ids:['E1'],elements:[{element_id:'S01-E1',source_ids:['E1']}]}]};
  assert.equal(verifyPptxLineage(good,sidecar).status,'passed');
  const bad=zipSync({'ppt/notesSlides/notesSlide1.xml':strToU8('<p:notes><a:t>slide_id: S010</a:t><a:t>evidence_ids: E_OTHER</a:t></p:notes>'),'ppt/slides/slide1.xml':strToU8('<p:sld><a:t>Title</a:t></p:sld>')});
  assert.throws(()=>verifyPptxLineage(bad,sidecar),/Lineage mismatch on slide S01/);
  const blank=zipSync({'ppt/notesSlides/notesSlide1.xml':strToU8('<p:notes><a:t>slide_id: S01</a:t><a:t>evidence_ids: E1</a:t></p:notes>'),'ppt/slides/slide1.xml':strToU8('<p:sld><p:spTree/></p:sld>')});
  assert.throws(()=>verifyPptxLineage(blank,sidecar),/editable slide text/);
});
