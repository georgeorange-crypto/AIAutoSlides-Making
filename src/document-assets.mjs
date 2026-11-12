import crypto from 'node:crypto';
import path from 'node:path';
import {strFromU8,unzipSync} from 'fflate';

const MAX_DOCUMENT_BYTES=100*1024*1024,MAX_XML_BYTES=10*1024*1024,MAX_IMAGE_BYTES=25*1024*1024,MAX_TOTAL_IMAGE_BYTES=50*1024*1024,MAX_IMAGES=50;
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const decodeXml=value=>value.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const imageMime=new Map([['png','image/png'],['jpg','image/jpeg'],['jpeg','image/jpeg'],['svg','image/svg+xml']]);

function xmlAttributes(tag){const result={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g))result[m[1]]=decodeXml(m[3]);return result;}

/** Extract supported inline image parts referenced by DOCX body/header/footer XML, retaining source-package lineage. */
export function extractDocxAssets(bytes,{filename='source.docx'}={}){
  if(bytes.byteLength>MAX_DOCUMENT_BYTES)throw new Error('DOCX source exceeds 100 MB limit');
  const mediaNames=new Set(),rejected=[];let mediaCount=0,totalMediaBytes=0;
  const files=unzipSync(new Uint8Array(bytes),{filter:file=>{
    if(/^word\/(?:document|header\d*|footer\d*)\.xml$/.test(file.name)||/^word\/_rels\/(?:document|header\d*|footer\d*)\.xml\.rels$/.test(file.name)){
      if(file.originalSize>MAX_XML_BYTES)throw new Error(`DOCX XML part exceeds 10 MB limit: ${file.name}`);
      return true;
    }
    if(!file.name.startsWith('word/media/'))return false;
    const ext=path.posix.extname(file.name).slice(1).toLowerCase();
    if(!imageMime.has(ext)){rejected.push(file.name);return false;}
    mediaCount++;totalMediaBytes+=file.originalSize;
    if(mediaCount>MAX_IMAGES)throw new Error('DOCX image extraction is limited to 50 image parts');
    if(file.originalSize>MAX_IMAGE_BYTES)throw new Error(`DOCX image exceeds 25 MB limit: ${file.name}`);
    if(totalMediaBytes>MAX_TOTAL_IMAGE_BYTES)throw new Error('DOCX extracted images exceed 50 MB total');
    mediaNames.add(file.name);return true;
  }});
  if(!files['word/document.xml'])throw new Error('Invalid DOCX package: expected word/document.xml');
  const used=new Map();
  for(const [xmlPart,documentBytes] of Object.entries(files).filter(([name])=>/^word\/(?:document|header\d*|footer\d*)\.xml$/.test(name))){
    const documentXml=strFromU8(documentBytes),relationshipPath=path.posix.join('word/_rels',`${path.posix.basename(xmlPart)}.rels`),relsXml=files[relationshipPath]?strFromU8(files[relationshipPath]):'',relationships=new Map();
    for(const match of relsXml.matchAll(/<Relationship\b[^>]*\/?\s*>/g)){
      const a=xmlAttributes(match[0]);if(!a.Id||!a.Target||!a.Type?.endsWith('/image')||a.TargetMode==='External')continue;
      const target=a.Target.replaceAll('\\','/');if(target.startsWith('/')||target.includes('?')||target.includes('#'))continue;
      const part=path.posix.normalize(path.posix.join(path.posix.dirname(xmlPart),target));
      if(!part.startsWith('word/media/')||part.split('/').includes('..'))continue;relationships.set(a.Id,part);
    }
    for(const tag of documentXml.matchAll(/<(?:a:blip|v:imagedata)\b[^>]*>/g)){
      const attrs=xmlAttributes(tag[0]),rid=attrs['r:embed']||attrs['r:id'];if(!rid||!relationships.has(rid))continue;
      const part=relationships.get(rid);if(!mediaNames.has(part))continue;
      const altMatch=documentXml.slice(Math.max(0,tag.index-1200),tag.index).match(/<wp:docPr\b[^>]*\/?\s*>/g),alt=altMatch?.length?xmlAttributes(altMatch.at(-1)):{};
      const refs=used.get(part)||[];refs.push({relationship_id:rid,source_part:xmlPart,alt_text:alt.descr||alt.title||null});used.set(part,refs);
    }
  }
  if(!used.size)throw new Error('DOCX body/header/footer contains no referenced PNG, JPEG, or SVG image parts');
  const sourceHash=sha256(bytes),byHash=new Map(),assets=[];
  for(const [part,refs] of used){
    const data=files[part],hash=sha256(data),ext=path.posix.extname(part).slice(1).toLowerCase(),mime=imageMime.get(ext);
    if(!data?.length)continue;
    if(mime==='image/png'&&!(data[0]===0x89&&Buffer.from(data.subarray(1,4)).toString()==='PNG'))throw new Error(`DOCX PNG signature mismatch: ${part}`);
    if(mime==='image/jpeg'&&!(data[0]===0xff&&data[1]===0xd8))throw new Error(`DOCX JPEG signature mismatch: ${part}`);
    if(mime==='image/svg+xml'&&!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(strFromU8(data).slice(0,4096)))throw new Error(`DOCX SVG root element missing: ${part}`);
    const previous=byHash.get(hash);if(previous){previous.source_parts.push({part,relationships:refs});continue;}
    const asset={asset_id:`A_DOCX_${hash.slice(0,16).toUpperCase()}`,path:`assets/${hash.slice(0,20)}.${ext}`,type:mime,mime_type:mime,sha256:hash,source:`Embedded in ${filename} (SHA-256 ${sourceHash}), DOCX part ${part}`,license:'Inherited from source document; not independently reviewed',verified:false,source_file_sha256:sourceHash,source_parts:[{part,relationships:refs}],bytes:data};
    byHash.set(hash,asset);assets.push(asset);
  }
  return{source_sha256:sourceHash,assets,rejected_unsupported_parts:[...new Set(rejected)].sort()};
}
