#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';

const input=path.resolve(process.argv[2]||'outputs/research-demo.pptx'),output=path.resolve(process.argv[3]||'outputs/chart-collision-stress.pptx');
if(!fs.existsSync(input))throw new Error(`Synthetic source PPTX not found: ${input}`);
if(input===output)throw new Error('Stress output must be a separate PPTX; the source file is never modified.');
if(fs.existsSync(output))throw new Error(`Refusing to overwrite existing output: ${output}`);
const files=unzipSync(new Uint8Array(fs.readFileSync(input)));let changedStyles=0;
for(const name of Object.keys(files).filter(item=>/^ppt\/charts\/chart\d+\.xml$/.test(item))){
  const xml=strFromU8(files[name]),updated=xml.replace(/<c:txPr\b[^>]*>[\s\S]*?<\/c:txPr>/g,style=>style.replace(/\bsz="1400"/g,()=>{changedStyles++;return'sz="7200"';}));
  files[name]=strToU8(updated);
}
if(!changedStyles)throw new Error('No explicit 14 pt chart text styles were found; the source was not changed.');
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,zipSync(files));
console.log(`Created chart typography stress fixture: ${output}`);
console.log(`Mutated chart text styles: ${changedStyles} (14 pt to 72 pt)`);
console.log('Synthetic source deck is unchanged. Render this separate file and inspect every page.');
