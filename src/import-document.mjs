#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {strFromU8} from 'fflate';
import {loadEvidence} from './validate.mjs';
import {buildSourceBundle,extractDocxParagraphs,parsePdfPages} from './document-extractors.mjs';

const args=process.argv.slice(2),get=(key,fallback)=>{const i=args.indexOf(`--${key}`);return i<0?fallback:args[i+1];};
if(args.includes('--help')){console.log('Usage: node src/import-document.mjs --input source.pdf|source.docx --id E_LOCAL_SOURCE [--label "Source label"] [--evidence existing-ledger.json] [--out-prefix outputs/imports/source]');process.exit(0);}
try{
 const input=path.resolve(get('input','')),id=get('id',''),label=get('label',null),prefix=path.resolve(get('out-prefix','outputs/imported-document')),evidencePath=get('evidence',null);
 if(!get('input',''))throw new Error('--input is required');
 const bytes=fs.readFileSync(input);if(bytes.length>100*1024*1024)throw new Error('Source exceeds 100 MB limit');
 const ext=path.extname(input).toLowerCase();let format,blocks;
 if(ext==='.docx'){format='docx';blocks=extractDocxParagraphs(bytes);}
 else if(ext==='.pdf'){
  format='pdf';const result=spawnSync('pdftotext',['-layout',input,'-'],{encoding:'buffer',windowsHide:true,maxBuffer:20*1024*1024});
  if(result.error)throw new Error(`Cannot extract PDF text: ${result.error.message}. Install Poppler (pdftotext) locally; scanned PDFs are not OCRed.`);
  if(result.status!==0)throw new Error(`pdftotext failed (${result.status}): ${result.stderr?.toString('utf8').slice(0,1000)}`);
  blocks=parsePdfPages(strFromU8(result.stdout));
 }else throw new Error('Supported local formats are .pdf and .docx');
 const bundle=buildSourceBundle({bytes,filename:path.basename(input),format,blocks,id,label}),entries=evidencePath?loadEvidence(path.resolve(evidencePath)).entries:[];
 if(entries.some(e=>e.id===id))throw new Error(`Evidence ID ${id} already exists in the supplied ledger`);
 fs.mkdirSync(path.dirname(prefix),{recursive:true});fs.writeFileSync(`${prefix}.md`,bundle.markdown);fs.writeFileSync(`${prefix}.manifest.json`,JSON.stringify(bundle.manifest,null,2)+'\n');fs.writeFileSync(`${prefix}.evidence.json`,JSON.stringify({entries:[...entries,bundle.entry]},null,2)+'\n');
 console.log(`Imported ${blocks.length} ${format==='pdf'?'PDF page(s)':'DOCX paragraph(s)'} locally; source verification remains pending.`);console.log(`Outputs: ${prefix}.md, ${prefix}.manifest.json, ${prefix}.evidence.json`);
}catch(error){console.error(`[ERROR] ${error.message}`);process.exit(1);}
