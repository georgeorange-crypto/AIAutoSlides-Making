import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';

const MAX_ARCHIVE_BYTES=100*1024*1024;
const MAX_UNCOMPRESSED_BYTES=250*1024*1024;
const MAX_ENTRY_BYTES=50*1024*1024;
const MAX_ENTRIES=10000;
const TYPES={
  '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
  '.potx':'application/vnd.openxmlformats-officedocument.presentationml.template.main+xml'
};

function fail(message){throw new Error(message);}
function hash(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}

function inspectZipDirectory(bytes){
  const min=Math.max(0,bytes.length-22-0xffff);let eocd=-1;
  for(let i=bytes.length-22;i>=min;i--)if(bytes.readUInt32LE(i)===0x06054b50){eocd=i;break;}
  if(eocd<0)fail('Input is not a supported ZIP/OOXML package (EOCD missing).');
  if(bytes.readUInt16LE(eocd+4)!==0||bytes.readUInt16LE(eocd+6)!==0)fail('Multi-disk ZIP archives are not supported.');
  const count=bytes.readUInt16LE(eocd+10),centralBytes=bytes.readUInt32LE(eocd+12),centralOffset=bytes.readUInt32LE(eocd+16);
  if(count===0xffff||centralBytes===0xffffffff||centralOffset===0xffffffff)fail('ZIP64 packages are not supported by this local template inspector.');
  if(count>MAX_ENTRIES||centralOffset+centralBytes>eocd)fail('ZIP central directory is invalid or exceeds supported limits.');
  const entries=[];let cursor=centralOffset,total=0;
  for(let i=0;i<count;i++){
    if(cursor+46>eocd||bytes.readUInt32LE(cursor)!==0x02014b50)fail('ZIP central directory entry is malformed.');
    const flags=bytes.readUInt16LE(cursor+8),compressed=bytes.readUInt32LE(cursor+20),uncompressed=bytes.readUInt32LE(cursor+24),nameLength=bytes.readUInt16LE(cursor+28),extraLength=bytes.readUInt16LE(cursor+30),commentLength=bytes.readUInt16LE(cursor+32),localOffset=bytes.readUInt32LE(cursor+42);
    if(flags&1)fail('Encrypted ZIP entries are not supported.');
    if(compressed===0xffffffff||uncompressed===0xffffffff||localOffset===0xffffffff)fail('ZIP64 entries are not supported.');
    if(uncompressed>MAX_ENTRY_BYTES)fail(`ZIP entry exceeds ${MAX_ENTRY_BYTES} byte limit.`);
    total+=uncompressed;if(total>MAX_UNCOMPRESSED_BYTES)fail('Expanded ZIP contents exceed the 250 MiB safety limit.');
    const nameBytes=bytes.subarray(cursor+46,cursor+46+nameLength);if(cursor+46+nameLength+extraLength+commentLength>eocd)fail('ZIP directory record exceeds archive bounds.');
    let name;try{name=new TextDecoder('utf-8',{fatal:true}).decode(nameBytes);}catch{fail('ZIP entry name is not valid UTF-8.');}
    if(!name||name.includes('\0')||name.includes('\\')||name.startsWith('/')||/^[a-zA-Z]:/.test(name)||name.split('/').includes('..'))fail('ZIP contains an unsafe entry path.');
    entries.push({name,compressed,uncompressed,localOffset});cursor+=46+nameLength+extraLength+commentLength;
  }
  return entries;
}

function xmlText(xml){return new TextDecoder('utf-8',{fatal:true}).decode(xml);}
function countMatches(text,regex){return [...text.matchAll(regex)].length;}

export function inspectPresentationTemplate(inputPath,{registeredAt=new Date().toISOString()}={}){
  const resolved=path.resolve(inputPath),extension=path.extname(resolved).toLowerCase();
  if(!Object.hasOwn(TYPES,extension))fail('Only .pptx and .potx template files are supported.');
  const stat=fs.statSync(resolved);if(!stat.isFile()||!stat.size||stat.size>MAX_ARCHIVE_BYTES)fail(`Template must be a regular file from 1 byte to ${MAX_ARCHIVE_BYTES} bytes.`);
  const bytes=fs.readFileSync(resolved);const directory=inspectZipDirectory(bytes);
  const archive=unzipSync(bytes);const names=Object.keys(archive);
  if(directory.length!==names.length)fail('ZIP entry listing is inconsistent.');
  const types=archive['[Content_Types].xml'];const presentation=archive['ppt/presentation.xml'];
  if(!types||!presentation)fail('OOXML package is missing presentation metadata.');
  const typesXml=xmlText(types);const presentationOverride=[...typesXml.matchAll(/<Override\b([^>]*)\/?\s*>/g)].map(match=>match[1]).find(attributes=>/\bPartName=["']\/ppt\/presentation\.xml["']/.test(attributes));
  const mainType=presentationOverride?.match(/\bContentType=["']([^"']+)["']/)?.[1];
  if(mainType!==TYPES[extension])fail(`File extension ${extension} does not match its OOXML main content type.`);
  const presentationXml=xmlText(presentation);const sizeAttrs=presentationXml.match(/<p:sldSz\b([^>]*)/)?.[1]??'';
  const width=sizeAttrs.match(/\bcx="(\d+)"/)?.[1],height=sizeAttrs.match(/\bcy="(\d+)"/)?.[1];
  const slidePaths=names.filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
  const layouts=names.filter(name=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).length;
  const masters=names.filter(name=>/^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(name)).length;
  const media=names.filter(name=>/^ppt\/media\//.test(name)&&!name.endsWith('/'));
  const fonts=new Set();let externalRelationshipCount=0;
  for(const name of names){
    if(/^ppt\/.*\.xml$/.test(name)){
      const text=xmlText(archive[name]);for(const match of text.matchAll(/<a:latin\b[^>]*\btypeface="([^"]+)"/g))fonts.add(match[1]);
    }
    if(name.endsWith('.rels'))externalRelationshipCount+=countMatches(xmlText(archive[name]),/TargetMode="External"/g);
  }
  return {
    schema_version:'1.0.0',template_id:`local-${hash(bytes).slice(0,16)}`,origin:'user-supplied-local-file',
    file:{name:path.basename(resolved),extension,bytes:stat.size,sha256:hash(bytes)},
    package:{format:extension==='.potx'?'PowerPoint template':'PowerPoint presentation',slide_count:slidePaths.length,slide_size_emu:width&&height?{width:Number(width),height:Number(height)}:null,slide_master_count:masters,slide_layout_count:layouts,media_count:media.length,media_types:[...new Set(media.map(file=>path.extname(file).slice(1).toLowerCase()).filter(Boolean))].sort(),fonts:[...fonts].sort(),external_relationship_count:externalRelationshipCount,has_macros:names.some(name=>/^ppt\/vbaProject\.bin$/i.test(name))},
    rights:{state:'unknown',redistribution:'not-approved',commercial_use:'unknown',reviewer:null,reviewed_at:null},
    availability:{state:'registered-metadata-only',usable_for_generation:false,reason:'Rights and local template rendering/editability QA have not been reviewed.'},
    limitations:['This command records metadata and hashes only; it does not copy, extract, render, or execute the source file.','Template application and preservation fidelity are not implemented by this registry entry.','Review rights, branding, fonts, macros, external relationships, and rendered pages before use.'],
    registered_at:registeredAt
  };
}

export function registerPresentationTemplate(inputPath,outputPath){
  const output=path.resolve(outputPath);if(fs.existsSync(output))fail('Registry output already exists; refusing to overwrite.');
  const record=inspectPresentationTemplate(inputPath);fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,`${JSON.stringify(record,null,2)}\n`,{flag:'wx'});return record;
}
