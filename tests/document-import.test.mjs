import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {unzipSync,zipSync,strToU8} from 'fflate';
import {buildSourceBundle,createTesseractRecognizer,extractDocxParagraphs,extractPdfPages,extractPdfPagesWithOcr,parsePdfPages} from '../src/document-extractors.mjs';
import {extractDocxAssets} from '../src/document-assets.mjs';
import {extractPdfAssets} from '../src/pdf-assets.mjs';
import {loadAssetManifest} from '../src/assets.mjs';
import {generatePresentation} from '../src/render.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function syntheticDocx(){
 const xml='<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>SYNTHETIC source statement &amp; evidence.</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methods section</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell text</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>';
 return zipSync({'[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),'word/document.xml':strToU8(xml)});
}

function syntheticDocxWithImages(){
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nmGQAAAAASUVORK5CYII=','base64'),jpeg=Buffer.from([0xff,0xd8,0xff,0xd9]),svg=strToU8('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#123456"/></svg>');
 const document='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>SYNTHETIC embedded image source</w:t></w:r><w:drawing><wp:docPr id="1" name="Picture 1" descr="Synthetic topology"/><a:blip r:embed="rIdPng"/></w:drawing></w:p><w:p><w:drawing><wp:docPr id="2" name="Picture 2" title="Synthetic vector"/><a:blip r:embed="rIdSvg"/></w:drawing></w:p><w:p><w:drawing><a:blip r:embed="rIdDuplicate"/><a:blip r:embed="rIdJpeg"/></w:drawing></w:p></w:body></w:document>';
 const rels='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdPng" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/><Relationship Id="rIdSvg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.svg"/><Relationship Id="rIdDuplicate" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image3.png"/><Relationship Id="rIdJpeg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/photo.jpg"/></Relationships>';
 const header='<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><wp:docPr id="3" name="Header mark" descr="Header logo"/><a:blip r:embed="rIdHeader"/></w:p></w:hdr>',footer='<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><wp:docPr id="4" name="Footer mark"/><a:blip r:embed="rIdFooter"/></w:p></w:ftr>',headerRels='<Relationships><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/></Relationships>',footerRels='<Relationships><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image3.png"/></Relationships>';
 return zipSync({'[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),'word/document.xml':strToU8(document),'word/_rels/document.xml.rels':strToU8(rels),'word/header1.xml':strToU8(header),'word/_rels/header1.xml.rels':strToU8(headerRels),'word/footer1.xml':strToU8(footer),'word/_rels/footer1.xml.rels':strToU8(footerRels),'word/media/image1.png':png,'word/media/image2.svg':svg,'word/media/image3.png':png,'word/media/photo.jpg':jpeg});
}

function syntheticPdf(text='SYNTHETIC PDF source text'){
 const stream=text?`BT /F1 16 Tf 72 720 Td (${text}) Tj ET\n`:'';
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream,'binary')} >>\nstream\n${stream}endstream`];let pdf='%PDF-1.4\n';const offsets=[0];for(let id=1;id<=5;id++){offsets[id]=Buffer.byteLength(pdf,'binary');pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`;}
 const xrefOffset=Buffer.byteLength(pdf,'binary'),xref=['xref','0 6','0000000000 65535 f ',...offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n `)].join('\n');return Buffer.from(`${pdf}${xref}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,'binary');
}

function imageOnlyPdfFromPng(pngBytes,{repeat=false}={}){
 const width=pngBytes.readUInt32BE(16),height=pngBytes.readUInt32BE(20),colorType=pngBytes[25];if(colorType!==2||pngBytes[24]!==8)throw new Error('Test PNG must be 8-bit RGB');
 const chunks=[];for(let i=8;i<pngBytes.length;){const size=pngBytes.readUInt32BE(i),type=pngBytes.toString('ascii',i+4,i+8);if(type==='IDAT')chunks.push(pngBytes.subarray(i+8,i+8+size));i+=12+size;}
 const image=Buffer.concat(chunks),pageHeight=612*height/width,content=Buffer.from(`q\n612 0 0 ${pageHeight} 0 0 cm\n/Im0 Do${repeat?' /Im0 Do':''}\nQ\n`),objects=[
  Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
  Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
  Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${width} >> /Length ${image.length} >>\nstream\n`),image,Buffer.from('\nendstream')]),
  Buffer.concat([Buffer.from(`<< /Length ${content.length} >>\nstream\n`),content,Buffer.from('endstream')])
 ];
 const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];let length=parts[0].length;
 for(let i=0;i<objects.length;i++){offsets.push(length);const part=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),objects[i],Buffer.from('\nendobj\n')]);parts.push(part);length+=part.length;}
 const xrefOffset=length,xref=['xref','0 6','0000000000 65535 f ',...offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n `)].join('\n');parts.push(Buffer.from(`${xref}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`));return Buffer.concat(parts);
}

test('DOCX import preserves ordered paragraphs, decoded text, locators, hashes, and pending verification through deck build',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-docx-import-')),source=path.join(dir,'synthetic-source.docx'),prefix=path.join(dir,'imported'),storyboard=path.join(dir,'storyboard.json'),pptx=path.join(dir,'deck.pptx');
 try{
  const bytes=syntheticDocx();fs.writeFileSync(source,bytes);
  const imported=spawnSync(process.execPath,['src/import-document.mjs','--input',source,'--id','E_LOCAL_SYNTH','--out-prefix',prefix],{encoding:'utf8'});assert.equal(imported.status,0,imported.stderr);
  const evidence=JSON.parse(fs.readFileSync(`${prefix}.evidence.json`,'utf8')),manifest=JSON.parse(fs.readFileSync(`${prefix}.manifest.json`,'utf8')),markdown=fs.readFileSync(`${prefix}.md`,'utf8');
  assert.equal(evidence.entries[0].verified,false);assert.equal(evidence.entries[0].source_sha256,crypto.createHash('sha256').update(bytes).digest('hex'));assert.equal(manifest.block_count,3);assert.match(markdown,/Paragraph 0001/);assert.match(markdown,/Table cell text/);assert.match(markdown,/not instructions/);
  const deck={meta:{title:'Synthetic local import demo',theme:'keynote-minimal'},slides:[{slide_id:'S01',type:'statement',title:'Imported source text is available for human review',body:['Synthetic only; no research result is asserted.'],evidence_ids:['E_LOCAL_SYNTH'],claim_support:[{evidence_id:'E_LOCAL_SYNTH',claim_text:'Imported source text is available for human review',source_excerpt:'SYNTHETIC source statement & evidence.',locator:'synthetic-source.docx, paragraph 1',review_status:'pending'}]}]};fs.writeFileSync(storyboard,JSON.stringify(deck));
  const build=spawnSync(process.execPath,['src/cli.mjs','build','--input',storyboard,'--evidence',`${prefix}.evidence.json`,'--out',pptx],{encoding:'utf8'});assert.equal(build.status,0,build.stderr);assert.ok(fs.statSync(pptx).size>10000);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('DOCX parser rejects invalid packages and PDF page parser preserves blank-page locators',()=>{
 assert.throws(()=>extractDocxParagraphs(strToU8('not a DOCX zip')));
 assert.deepEqual(parsePdfPages('Page one\f\fPage three\f').map(x=>x.locator),['page 1','page 2','page 3']);
 assert.equal(parsePdfPages('Page one\f\fPage three\f')[1].content,'');
 assert.throws(()=>parsePdfPages('\f\n\f'),/image-only PDFs require OCR/);
});

test('optional DOCX image extraction writes deduplicated local assets and a compatible provenance manifest',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-docx-assets-')),source=path.join(dir,'synthetic-images.docx'),prefix=path.join(dir,'imported');
 try{
  fs.writeFileSync(source,syntheticDocxWithImages());
  const run=spawnSync(process.execPath,['src/import-document.mjs','--input',source,'--id','E_LOCAL_IMAGES','--extract-images','--out-prefix',prefix],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const manifest=JSON.parse(fs.readFileSync(`${prefix}.assets.json`,'utf8')),importReport=JSON.parse(fs.readFileSync(`${prefix}.manifest.json`,'utf8'));
  assert.equal(manifest.assets.length,3,'duplicate image bytes should be deduplicated');assert.equal(importReport.extracted_asset_count,3);assert.equal(manifest.assets[0].verified,false);
  assert.ok(manifest.assets.every(asset=>asset.source_file_sha256===crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex')));
  const svg=manifest.assets.find(asset=>asset.mime_type==='image/svg+xml'),png=manifest.assets.find(asset=>asset.mime_type==='image/png'),jpeg=manifest.assets.find(asset=>asset.mime_type==='image/jpeg');assert.equal(svg.source_parts[0].relationships[0].alt_text,'Synthetic vector');assert.equal(png.source_parts.length,2,'duplicate media parts share one content-addressed asset');const pngRefs=png.source_parts.flatMap(source=>source.relationships);assert.equal(pngRefs.length,4);assert.deepEqual(new Set(pngRefs.map(ref=>ref.source_part)),new Set(['word/document.xml','word/header1.xml','word/footer1.xml']));assert.ok(jpeg);
  for(const asset of manifest.assets)assert.ok(fs.existsSync(path.join(dir,asset.path)));
  const deck={slides:[{slide_id:'S01',visuals:[{asset_id:png.asset_id,x:1,y:1,w:2,h:2},{asset_id:svg.asset_id,x:4,y:1,w:2,h:2},{asset_id:jpeg.asset_id,x:7,y:1,w:2,h:2}]}]};
  const mapped=loadAssetManifest(`${prefix}.assets.json`,deck);assert.equal(mapped.get(svg.asset_id).slides[0],'S01');assert.equal(mapped.get(jpeg.asset_id).slides[0],'S01');assert.equal(mapped.get(png.asset_id).verified,false);
  const renderDeck={meta:{title:'Synthetic extracted assets',status:'SYNTHETIC'},slides:[{slide_id:'S01',type:'cover',title:'Synthetic document image import',body:['Local source; pending review'],evidence_ids:[],visuals:[{asset_id:png.asset_id,x:1,y:1,w:2,h:2},{asset_id:svg.asset_id,x:4,y:1,w:2,h:2}]}]},renderAssets=new Map([png.asset_id,svg.asset_id].map(id=>[id,mapped.get(id)])),pptx=path.join(dir,'extracted-assets.pptx'),theme=JSON.parse(fs.readFileSync('themes/academic-light.json','utf8'));
  await generatePresentation(renderDeck,{entries:[]},theme,pptx,renderAssets);
  const packageFiles=unzipSync(new Uint8Array(fs.readFileSync(pptx))),slideXml=new TextDecoder().decode(packageFiles['ppt/slides/slide1.xml']);assert.equal((slideXml.match(/<p:pic>/g)||[]).length,2);assert.ok(Object.keys(packageFiles).some(file=>/^ppt\/media\/.*\.png$/i.test(file)));assert.ok(Object.keys(packageFiles).some(file=>/^ppt\/media\/.*\.svg$/i.test(file)));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('DOCX image extraction ignores external and path-traversal relationships',()=>{
 const bytes=zipSync({'[Content_Types].xml':strToU8('<Types/>'),'word/document.xml':strToU8('<w:document><a:blip r:embed="rId1"/><a:blip r:embed="rId2"/></w:document>'),'word/_rels/document.xml.rels':strToU8('<Relationships><Relationship Id="rId1" Type="image" Target="https://example.test/p.png" TargetMode="External"/><Relationship Id="rId2" Type="image" Target="../outside.png"/></Relationships>'),'outside.png':Buffer.from([0x89,0x50,0x4e,0x47])});
 assert.throws(()=>extractDocxAssets(bytes),/no referenced PNG, JPEG, or SVG/);
});

test('optional PDF image extraction decodes bounded XObjects and imports them into a PPTX as sourced picture objects',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-pdf-assets-')),source=path.join(dir,'synthetic-scan.pdf'),prefix=path.join(dir,'imported'),pptx=path.join(dir,'assets.pptx');
 try{
  const pdfBytes=imageOnlyPdfFromPng(fs.readFileSync(path.join(root,'tests/fixtures/ocr-synthetic.png')),{repeat:true});fs.writeFileSync(source,pdfBytes);
  const result=await extractPdfAssets(pdfBytes,{filename:path.basename(source)});assert.equal(result.assets.length,1,'same decoded object should be deduplicated');assert.equal(result.assets[0].source_parts.length,2);assert.equal(result.assets[0].source_file_sha256,crypto.createHash('sha256').update(pdfBytes).digest('hex'));
  const run=spawnSync(process.execPath,['src/import-document.mjs','--input',source,'--id','E_LOCAL_PDF_IMAGE','--extract-images','--out-prefix',prefix],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const manifest=JSON.parse(fs.readFileSync(`${prefix}.assets.json`,'utf8')),textReport=JSON.parse(fs.readFileSync(`${prefix}.manifest.json`,'utf8')),evidence=JSON.parse(fs.readFileSync(`${prefix}.evidence.json`,'utf8'));assert.equal(manifest.assets.length,1);assert.equal(textReport.extracted_asset_count,1);assert.equal(textReport.block_count,0);assert.equal(manifest.assets[0].verified,false);assert.match(fs.readFileSync(`${prefix}.md`,'utf8'),/Selectable text: none/);assert.match(evidence.entries[0].locator,/No selectable text/);assert.match(run.stdout,/No selectable PDF text was found/);
  const asset=manifest.assets[0],deck={slides:[{slide_id:'S01',visuals:[{asset_id:asset.asset_id,x:1,y:1,w:3,h:2}]}]},mapped=loadAssetManifest(`${prefix}.assets.json`,deck),renderDeck={meta:{title:'Synthetic PDF image',status:'SYNTHETIC'},slides:[{slide_id:'S01',type:'cover',title:'Extracted PDF image',body:['Local image object'],evidence_ids:[],visuals:[{asset_id:asset.asset_id,x:1,y:1,w:3,h:2}]}]},theme=JSON.parse(fs.readFileSync('themes/academic-light.json','utf8'));
  await generatePresentation(renderDeck,{entries:[]},theme,pptx,mapped);const packageFiles=unzipSync(new Uint8Array(fs.readFileSync(pptx))),xml=new TextDecoder().decode(packageFiles['ppt/slides/slide1.xml']);assert.equal((xml.match(/<p:pic>/g)||[]).length,1);assert.ok(Object.keys(packageFiles).some(file=>/^ppt\/media\/.*\.png$/i.test(file)));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('PDF image extraction does not mistake page renders for embedded images',async()=>{
 await assert.rejects(()=>extractPdfAssets(syntheticPdf('Selectable text only')),/No supported PDF image XObjects/);
});

test('optional bundled Tesseract fallback renders PDF pages and keeps OCR output explicitly unverified',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-ocr-test-')),input=path.join(dir,'scan.pdf');fs.writeFileSync(input,syntheticPdf(''));
 const calls=[];let closed=false;
 try{
  const pages=await extractPdfPagesWithOcr(input,{language:'eng',renderCommand:'fake-pdftoppm',run:(command,args)=>{calls.push({command,args});fs.writeFileSync(`${args.at(-1)}-1.png`,Buffer.from('png'));return{status:0,stdout:'',stderr:''};},recognizerFactory:async language=>{assert.equal(language,'eng');return{recognize:async()=>({text:'SYNTHETIC OCR text',confidence:93.4}),close:async()=>{closed=true;}};}});
  assert.deepEqual(pages,[{locator:'page 1',content:'SYNTHETIC OCR text',ocr_confidence:93.4}]);assert.equal(calls.length,1);assert.deepEqual(calls[0].args.slice(0,3),['-png','-r','200']);assert.equal(closed,true);
  const bundle=buildSourceBundle({bytes:fs.readFileSync(input),filename:'scan.pdf',format:'pdf',blocks:pages,id:'E_LOCAL_OCR',extractionMethod:'Tesseract.js@7.0.0 offline model, language eng; output remains unverified'});assert.equal(bundle.entry.verified,false);assert.match(bundle.manifest.extraction_method,/Tesseract.js/);assert.deepEqual(bundle.manifest.ocr_pages,[{locator:'page 1',confidence:93.4}]);
  await assert.rejects(()=>extractPdfPagesWithOcr(input,{language:'bad lang'}),/one or more bundled languages/);
  await assert.rejects(()=>extractPdfPagesWithOcr(input,{renderCommand:'missing-poppler',run:()=>({status:null,error:{message:'executable unavailable'},stderr:''})}),/missing-poppler failed: executable unavailable/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('bundled Tesseract.js engine and English traineddata perform real offline image recognition',async()=>{
 const recognizer=await createTesseractRecognizer('eng');
 try{const result=await recognizer.recognize(path.join(root,'tests','fixtures','ocr-synthetic.png'));assert.match(result.text,/SYSTEMS\s+2026/);assert.ok(result.confidence>50);}
 finally{await recognizer.close();}
});

test('bundled Simplified Chinese traineddata performs real local OCR',async()=>{
 const recognizer=await createTesseractRecognizer('chi_sim');
 try{const result=await recognizer.recognize(path.join(root,'tests','fixtures','ocr-chinese.png'));assert.match(result.text.replace(/\s/g,''),/人工智能系统2026/);assert.ok(result.confidence>50);}
 finally{await recognizer.close();}
});

test('image-only synthetic PDF imports end-to-end with bundled offline OCR and page confidence',async t=>{
 const probe=spawnSync('pdftoppm',['-v'],{encoding:'utf8',windowsHide:true});if(probe.error||probe.status!==0){t.skip('local Poppler pdftoppm is required for the PDF rasterization step');return;}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-real-ocr-')),source=path.join(dir,'synthetic-scan.pdf'),prefix=path.join(dir,'ocr');fs.writeFileSync(source,imageOnlyPdfFromPng(fs.readFileSync(path.join(root,'tests','fixtures','ocr-synthetic.png'))));
 try{
  const result=spawnSync(process.execPath,['src/import-document.mjs','--input',source,'--id','E_LOCAL_REAL_OCR','--ocr','tesseract','--ocr-lang','eng','--out-prefix',prefix],{cwd:root,encoding:'utf8',timeout:120000});assert.equal(result.status,0,result.stderr);const markdown=fs.readFileSync(`${prefix}.md`,'utf8'),ledger=JSON.parse(fs.readFileSync(`${prefix}.evidence.json`,'utf8')),manifest=JSON.parse(fs.readFileSync(`${prefix}.manifest.json`,'utf8'));
  assert.match(markdown,/SYSTEMS\s+2026/);assert.equal(ledger.entries[0].verified,false);assert.match(ledger.entries[0].extraction_method,/Tesseract\.js@7\.0\.0/);assert.ok(manifest.ocr_pages[0].confidence>50);assert.match(manifest.warnings[0],/unverified/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('PDF.js extracts selectable local text and importer preserves local provenance without Poppler',async()=>{
 const bytes=syntheticPdf();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-pdf-import-')),source=path.join(dir,'synthetic.pdf'),prefix=path.join(dir,'imported');
 try{fs.writeFileSync(source,bytes);const pages=await extractPdfPages(bytes);assert.equal(pages.length,1);assert.match(pages[0].content,/SYNTHETIC PDF source text/);const imported=spawnSync(process.execPath,['src/import-document.mjs','--input',source,'--id','E_LOCAL_PDF','--pdf-engine','auto','--out-prefix',prefix],{encoding:'utf8',env:{...process.env,PATH:path.dirname(process.execPath)}});assert.equal(imported.status,0,imported.stderr);assert.match(fs.readFileSync(`${prefix}.md`,'utf8'),/SYNTHETIC PDF source text/);assert.equal(JSON.parse(fs.readFileSync(`${prefix}.manifest.json`,'utf8')).block_count,1);assert.equal(JSON.parse(fs.readFileSync(`${prefix}.manifest.json`,'utf8')).extraction_method,'PDF.js (pdfjs-dist), selectable text only');assert.equal(JSON.parse(fs.readFileSync(`${prefix}.evidence.json`,'utf8')).entries[0].verified,false);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('PDF.js rejects a PDF with no selectable text without claiming OCR',async()=>{
 await assert.rejects(()=>extractPdfPages(syntheticPdf('')),/image-only PDFs require OCR/);
});
