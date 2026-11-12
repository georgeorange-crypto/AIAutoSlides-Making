import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';

function hash(data){return crypto.createHash('sha256').update(data).digest('hex');}
function xmlText(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');}
function usage(){console.log('Usage: node src/edit-existing-pptx.mjs --input source.pptx --request edits.json --out revised.pptx');}

const args=process.argv.slice(2),value=name=>{const i=args.indexOf(`--${name}`);return i<0?null:args[i+1];};
if(args.includes('--help')){usage();process.exit(0);}
const input=value('input'),requestFile=value('request'),output=value('out');
if(!input||!requestFile||!output){usage();process.exitCode=2;}
else try{
 const source=path.resolve(input),requestPath=path.resolve(requestFile),out=path.resolve(output);
 if(!/\.pptx$/i.test(source)||!/\.pptx$/i.test(out))throw new Error('Input and output must use the .pptx extension.');
 const samePath=process.platform==='win32'?source.toLowerCase()===out.toLowerCase():source===out;
 if(samePath)throw new Error('Output must be a new path; the source PPTX is immutable.');
 if(fs.existsSync(out))throw new Error(`Output already exists; refusing to overwrite: ${out}`);
 if(!fs.existsSync(source)||!fs.existsSync(requestPath))throw new Error('Input PPTX and edit request must both exist.');
 const inputBytes=fs.readFileSync(source);
 if(inputBytes.length>250*1024*1024)throw new Error('PPTX exceeds the 250 MiB local edit limit.');
 const request=JSON.parse(fs.readFileSync(requestPath,'utf8'));
 if(!Array.isArray(request.edits)||request.edits.length<1||request.edits.length>20)throw new Error('Request must contain 1–20 exact text edits.');
 const files=unzipSync(new Uint8Array(inputBytes)),presentation=strFromU8(files['ppt/presentation.xml']||new Uint8Array()),rels=strFromU8(files['ppt/_rels/presentation.xml.rels']||new Uint8Array());
 const targets=new Map([...rels.matchAll(/<Relationship\b(?=[^>]*\bId="([^"]+)")(?=[^>]*\bTarget="([^"]+)")[^>]*\/?\s*>/g)].map(m=>[m[1],path.posix.normalize(path.posix.join('ppt',m[2]))]));
 const slideFiles=[...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"[^>]*\/?\s*>/g)].map(m=>targets.get(m[1]));
 if(!slideFiles.length||slideFiles.some(name=>!name||!files[name])||new Set(slideFiles).size!==slideFiles.length)throw new Error('PPTX slide order or presentation relationships are invalid.');
 if(!slideFiles.length)throw new Error('PPTX contains no slide XML parts.');
 const beforeHashes=Object.fromEntries(slideFiles.map(name=>[name,hash(files[name])]));
 const editedSlides=new Set(),edits=[];
 for(const edit of request.edits){
  const slide=Number(edit.slide),find=String(edit.find??''),replace=String(edit.replace??'');
  if(!Number.isInteger(slide)||slide<1||slide>slideFiles.length)throw new Error(`Invalid slide number: ${edit.slide}`);
  if(!find||!replace||find===replace)throw new Error(`Slide ${slide}: find and replace must be non-empty and different.`);
  if(find.length>300||replace.length>300)throw new Error(`Slide ${slide}: edit text is limited to 300 characters.`);
  const part=slideFiles[slide-1],xml=strFromU8(files[part]),needle=xmlText(find),occurrences=xml.split(needle).length-1;
  if(occurrences!==1)throw new Error(`Slide ${slide}: exact text must occur once in a single editable text run; found ${occurrences}.`);
  files[part]=strToU8(xml.replace(needle,xmlText(replace)));editedSlides.add(slide);
  edits.push({slide,part,find,replace});
 }
 const afterHashes=Object.fromEntries(slideFiles.map(name=>[name,hash(files[name])]));
 for(const name of slideFiles){const n=Number(name.match(/slide(\d+)/)[1]);if(!editedSlides.has(n)&&beforeHashes[name]!==afterHashes[name])throw new Error(`Unexpected change to untouched slide ${n}.`);}
 for(const name of slideFiles){const n=Number(name.match(/slide(\d+)/)[1]);if(editedSlides.has(n)&&beforeHashes[name]===afterHashes[name])throw new Error(`Requested slide ${n} did not change.`);}
 fs.mkdirSync(path.dirname(out),{recursive:true});
 const outputBytes=zipSync(files,{level:6});fs.writeFileSync(out,outputBytes);
 const report={schema_version:'1.0.0',source:{path:source,sha256:hash(inputBytes)},output:{path:out,sha256:hash(outputBytes)},slide_count:slideFiles.length,edited_slides:[...editedSlides].sort((a,b)=>a-b),edits,slide_xml_sha256_before:beforeHashes,slide_xml_sha256_after:afterHashes,untouched_slides_identical_xml:slideFiles.every(name=>{const n=Number(name.match(/slide(\d+)/)[1]);return editedSlides.has(n)||beforeHashes[name]===afterHashes[name];}),limitations:['Exact replacement is restricted to a single existing editable text run.','Text box geometry and font sizing are not changed; render and inspect edited pages for overflow.','Charts, images, masters, notes, animations, and relationships are preserved as package parts but are not semantically edited or fully round-trip validated.']};
 fs.writeFileSync(out.replace(/\.pptx$/i,'.edit-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(`Edited ${edits.length} text run(s) on ${editedSlides.size} slide(s); source preserved.`);console.log(`PPTX: ${out}`);console.log(`Report: ${out.replace(/\.pptx$/i,'.edit-report.json')}`);
}catch(error){console.error(`[PPTX edit failed] ${error.message}`);process.exitCode=1;}
