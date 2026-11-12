import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {zipSync,strToU8} from 'fflate';
import {extractDocxParagraphs,extractPdfPages,parsePdfPages} from '../src/document-extractors.mjs';

function syntheticDocx(){
 const xml='<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>SYNTHETIC source statement &amp; evidence.</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methods section</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table cell text</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr/></w:body></w:document>';
 return zipSync({'[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'),'word/document.xml':strToU8(xml)});
}

function syntheticPdf(text='SYNTHETIC PDF source text'){
 const stream=text?`BT /F1 16 Tf 72 720 Td (${text}) Tj ET\n`:'';
 const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream,'binary')} >>\nstream\n${stream}endstream`];let pdf='%PDF-1.4\n';const offsets=[0];for(let id=1;id<=5;id++){offsets[id]=Buffer.byteLength(pdf,'binary');pdf+=`${id} 0 obj\n${objects[id]}\nendobj\n`;}
 const xrefOffset=Buffer.byteLength(pdf,'binary'),xref=['xref','0 6','0000000000 65535 f ',...offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n `)].join('\n');return Buffer.from(`${pdf}${xref}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,'binary');
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

test('PDF.js extracts selectable local text and importer preserves local provenance without Poppler',async()=>{
 const bytes=syntheticPdf();
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-pdf-import-')),source=path.join(dir,'synthetic.pdf'),prefix=path.join(dir,'imported');
 try{fs.writeFileSync(source,bytes);const pages=await extractPdfPages(bytes);assert.equal(pages.length,1);assert.match(pages[0].content,/SYNTHETIC PDF source text/);const imported=spawnSync(process.execPath,['src/import-document.mjs','--input',source,'--id','E_LOCAL_PDF','--pdf-engine','auto','--out-prefix',prefix],{encoding:'utf8',env:{...process.env,PATH:path.dirname(process.execPath)}});assert.equal(imported.status,0,imported.stderr);assert.match(fs.readFileSync(`${prefix}.md`,'utf8'),/SYNTHETIC PDF source text/);assert.equal(JSON.parse(fs.readFileSync(`${prefix}.manifest.json`,'utf8')).block_count,1);assert.equal(JSON.parse(fs.readFileSync(`${prefix}.manifest.json`,'utf8')).extraction_method,'PDF.js (pdfjs-dist), selectable text only');assert.equal(JSON.parse(fs.readFileSync(`${prefix}.evidence.json`,'utf8')).entries[0].verified,false);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('PDF.js rejects a PDF with no selectable text without claiming OCR',async()=>{
 await assert.rejects(()=>extractPdfPages(syntheticPdf('')),/image-only PDFs require OCR/);
});
