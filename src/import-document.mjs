#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {strFromU8} from 'fflate';
import {loadEvidence} from './validate.mjs';
import {buildSourceBundle,extractDocxParagraphs,extractPdfPages,extractPdfPagesWithOcr,parsePdfPages} from './document-extractors.mjs';
import {extractDocxAssets} from './document-assets.mjs';

const args=process.argv.slice(2),get=(key,fallback)=>{const i=args.indexOf(`--${key}`);return i<0?fallback:args[i+1];};
if(args.includes('--help')){console.log('Usage: node src/import-document.mjs --input source.pdf|source.docx --id E_LOCAL_SOURCE [--pdf-engine auto|pdfjs|poppler] [--ocr tesseract --ocr-lang eng|chi_sim|eng+chi_sim] [--extract-images (DOCX only)] [--label "Source label"] [--evidence existing-ledger.json] [--out-prefix outputs/imports/source]');process.exit(0);}
try{
 const input=path.resolve(get('input','')),id=get('id',''),label=get('label',null),prefix=path.resolve(get('out-prefix','outputs/imported-document')),evidencePath=get('evidence',null),pdfEngine=get('pdf-engine','auto'),ocr=get('ocr',null),ocrLang=get('ocr-lang','eng'),extractImages=args.includes('--extract-images');
 if(!['auto','pdfjs','poppler'].includes(pdfEngine))throw new Error('--pdf-engine must be auto, pdfjs, or poppler');
 if(ocr!==null&&ocr!=='tesseract')throw new Error('--ocr currently supports only the optional local tesseract engine');
 if(!get('input',''))throw new Error('--input is required');
 const bytes=fs.readFileSync(input);if(bytes.length>100*1024*1024)throw new Error('Source exceeds 100 MB limit');
 const ext=path.extname(input).toLowerCase();let format,blocks,extractionMethod=null;
 if(ext==='.docx'){format='docx';blocks=extractDocxParagraphs(bytes);}
 else if(ext==='.pdf'){
  format='pdf';
  if(pdfEngine!=='pdfjs'){
   const result=spawnSync('pdftotext',['-layout',input,'-'],{encoding:'buffer',windowsHide:true,maxBuffer:20*1024*1024});
   if(!result.error&&result.status===0){try{blocks=parsePdfPages(strFromU8(result.stdout));extractionMethod='pdftotext -layout (Poppler), selectable text only';}catch(error){if(!ocr||!error.message.includes('No selectable text'))throw error;}}
   else if(pdfEngine==='poppler')throw new Error(`Poppler pdftotext failed: ${result.error?.message||result.stderr?.toString('utf8').slice(0,1000)}`);
  }
  if(!blocks){try{blocks=await extractPdfPages(bytes);extractionMethod='PDF.js (pdfjs-dist), selectable text only';}catch(error){if(!ocr||!error.message.includes('No selectable text'))throw error;}}
  if(!blocks&&ocr){blocks=await extractPdfPagesWithOcr(input,{language:ocrLang});extractionMethod=`Tesseract.js@7.0.0 (offline local model), Poppler rasterization, language ${ocrLang}; output remains unverified`;}
 }else throw new Error('Supported local formats are .pdf and .docx');
 if(extractImages&&format!=='docx')throw new Error('--extract-images currently supports DOCX only; PDF embedded-image extraction is not implemented');
 const bundle=buildSourceBundle({bytes,filename:path.basename(input),format,blocks,id,label,extractionMethod}),entries=evidencePath?loadEvidence(path.resolve(evidencePath)).entries:[];
 if(entries.some(e=>e.id===id))throw new Error(`Evidence ID ${id} already exists in the supplied ledger`);
 let imageResult=null;if(extractImages){imageResult=extractDocxAssets(bytes,{filename:path.basename(input)});const assetsDir=`${prefix}.assets`;fs.mkdirSync(path.join(assetsDir,'assets'),{recursive:true});for(const asset of imageResult.assets)fs.writeFileSync(path.join(assetsDir,asset.path),asset.bytes,{flag:'wx'});const records=imageResult.assets.map(({bytes,...asset})=>({...asset,path:`${path.basename(assetsDir)}/${asset.path}`}));const assetManifest={schema_version:1,source_file:path.basename(input),source_sha256:imageResult.source_sha256,assets:records};fs.writeFileSync(`${prefix}.assets.json`,JSON.stringify(assetManifest,null,2)+'\n',{flag:'wx'});bundle.manifest.extracted_assets_manifest=`${path.basename(prefix)}.assets.json`;bundle.manifest.extracted_asset_count=records.length;bundle.manifest.unsupported_embedded_parts=imageResult.rejected_unsupported_parts;}
 fs.mkdirSync(path.dirname(prefix),{recursive:true});fs.writeFileSync(`${prefix}.md`,bundle.markdown);fs.writeFileSync(`${prefix}.manifest.json`,JSON.stringify(bundle.manifest,null,2)+'\n');fs.writeFileSync(`${prefix}.evidence.json`,JSON.stringify({entries:[...entries,bundle.entry]},null,2)+'\n');
 console.log(`Imported ${blocks.length} ${format==='pdf'?'PDF page(s)':'DOCX paragraph(s)'} locally; source verification remains pending.`);console.log(`Outputs: ${prefix}.md, ${prefix}.manifest.json, ${prefix}.evidence.json`);
 if(imageResult)console.log(`Extracted ${imageResult.assets.length} image asset(s); manifest: ${prefix}.assets.json; rights and provenance remain pending.`);
}catch(error){console.error(`[ERROR] ${error.message}`);process.exit(1);}
