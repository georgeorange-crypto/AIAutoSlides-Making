#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';

const input=path.resolve(process.argv[2]||'outputs/research-demo.pptx'),output=path.resolve(process.argv[3]||'outputs/title-overflow-stress.pptx');
const targetSlide='ppt/slides/slide4.xml',originalTitle='The editable chart preserves the input values.',stressTitle='A long synthetic headline is deliberately prevented from wrapping so its rendered words spill beyond the authored title box and demonstrate the formal text fit gate.';
if(!fs.existsSync(input))throw new Error(`Synthetic source PPTX not found: ${input}`);
if(input===output)throw new Error('Stress output must be a separate PPTX; the source file is never modified.');
if(fs.existsSync(output))throw new Error(`Refusing to overwrite existing output: ${output}`);
const files=unzipSync(new Uint8Array(fs.readFileSync(input))),slideXml=strFromU8(files[targetSlide]);let changed=0;
files[targetSlide]=strToU8(slideXml.replace(/<p:sp>([\s\S]*?)<\/p:sp>/g,(shape,body)=>{
  const text=[...body.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>match[1]).join('');
  if(text!==originalTitle)return shape;
  const updated=body.replace(originalTitle,stressTitle).replace(/<a:bodyPr\b([^>]*)>/,(_match,attributes)=>`<a:bodyPr${attributes.replace(/\bwrap="[^"]*"/,'')} wrap="none">`);
  if(updated===body)throw new Error('The target title was found but no body properties could be changed.');
  changed++;return`<p:sp>${updated}</p:sp>`;
}));
if(changed!==1)throw new Error(`Expected one target title in ${targetSlide}; changed ${changed}.`);
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,zipSync(files));
console.log(`Created title overflow stress fixture: ${output}`);
console.log(`Changed one synthetic title and disabled wrapping on ${targetSlide}.`);
console.log('The source PPTX was not modified. Run structural QA and page preview, then compare OCR title word boxes with the QA title geometry.');
