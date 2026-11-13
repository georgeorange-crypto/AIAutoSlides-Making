import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {zipSync} from 'fflate';
import {inspectPresentationTemplate,registerPresentationTemplate} from '../src/templates/import-template.mjs';

function fixture({template=false,entryName='ppt/slides/slide1.xml'}={}){
  const contentType=template?'application/vnd.openxmlformats-officedocument.presentationml.template.main+xml':'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';
  return Buffer.from(zipSync({
    '[Content_Types].xml':Buffer.from(`<Types><Override PartName="/ppt/presentation.xml" ContentType="${contentType}"/></Types>`),
    'ppt/presentation.xml':Buffer.from('<p:presentation><p:sldSz cx="12192000" cy="6858000"/></p:presentation>'),
    [entryName]:Buffer.from('<p:sld><a:rPr><a:latin typeface="Example Sans"/></a:rPr></p:sld>'),
    'ppt/slideLayouts/slideLayout1.xml':Buffer.from('<p:sldLayout/>'),
    'ppt/slideMasters/slideMaster1.xml':Buffer.from('<p:sldMaster/>'),
    'ppt/media/pixel.png':Buffer.from([137,80,78,71,13,10,26,10]),
    'ppt/_rels/presentation.xml.rels':Buffer.from('<Relationships><Relationship Target="https://example.invalid" TargetMode="External"/></Relationships>')
  }));
}
function withTemp(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-template-'));try{return fn(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}

test('inspects a local PPTX without storing its absolute path or changing rights state',()=>withTemp(dir=>{
  const file=path.join(dir,'sample.pptx');fs.writeFileSync(file,fixture());
  const record=inspectPresentationTemplate(file,{registeredAt:'2026-11-12T00:00:00Z'});
  assert.equal(record.package.slide_count,1);assert.deepEqual(record.package.slide_size_emu,{width:12192000,height:6858000});
  assert.equal(record.package.slide_layout_count,1);assert.equal(record.package.slide_master_count,1);assert.deepEqual(record.package.fonts,['Example Sans']);
  assert.deepEqual(record.package.media_types,['png']);
  assert.equal(record.package.external_relationship_count,1);assert.equal(record.rights.state,'unknown');assert.equal(record.availability.usable_for_generation,false);
  assert.equal(JSON.stringify(record).includes(dir),false);assert.equal(record.file.name,'sample.pptx');
}));

test('accepts POTX only when extension matches its OOXML content type',()=>withTemp(dir=>{
  const file=path.join(dir,'sample.potx');fs.writeFileSync(file,fixture({template:true}));
  assert.equal(inspectPresentationTemplate(file).package.format,'PowerPoint template');
  const mismatched=path.join(dir,'wrong-extension.pptx');fs.writeFileSync(mismatched,fixture({template:true}));
  assert.throws(()=>inspectPresentationTemplate(mismatched),/does not match/);
}));

test('rejects non-ZIP input, unsafe package paths, unsupported extension and overwritten registry',()=>withTemp(dir=>{
  const bad=path.join(dir,'bad.pptx');fs.writeFileSync(bad,'not a zip');assert.throws(()=>inspectPresentationTemplate(bad),/ZIP\/OOXML/);
  const unsafe=path.join(dir,'unsafe.pptx');fs.writeFileSync(unsafe,fixture({entryName:'../outside.xml'}));assert.throws(()=>inspectPresentationTemplate(unsafe),/unsafe entry path/);
  assert.throws(()=>inspectPresentationTemplate(path.join(dir,'bad.pdf')),/Only \.pptx and \.potx/);
  const good=path.join(dir,'good.pptx');fs.writeFileSync(good,fixture());const output=path.join(dir,'entry.json');registerPresentationTemplate(good,output);
  assert.throws(()=>registerPresentationTemplate(good,output),/refusing to overwrite/);
}));

test('rejects declared ZIP expansion bombs before inflating package entries',()=>withTemp(dir=>{
  const file=path.join(dir,'bomb.pptx');const bytes=fixture();const central=bytes.lastIndexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
  assert.notEqual(central,-1);bytes.writeUInt32LE(50*1024*1024+1,central+24);fs.writeFileSync(file,bytes);
  assert.throws(()=>inspectPresentationTemplate(file),/ZIP entry exceeds/);
}));
