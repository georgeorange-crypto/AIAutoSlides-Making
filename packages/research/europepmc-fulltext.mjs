import {createHash} from 'node:crypto';

const API='https://www.ebi.ac.uk/europepmc/webservices/rest';
const MAX_BYTES=20*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
const clean=text=>String(text||'').replace(/\s+/g,' ').trim();

function decodeXml(text){return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(whole,entity)=>{if(entity[0]==='#'){const number=entity[1]?.toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return Number.isInteger(number)&&number>=0&&number<=0x10ffff?String.fromCodePoint(number):'�';}return{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity.toLowerCase()]||whole;});}
function tagText(xml){return clean(decodeXml(xml.replace(/<[^>]*>/g,' ')));}
export function extractJatsParagraphs(xml){
 if(typeof xml!=='string'||!xml.trim()||xml.length>MAX_BYTES)throw new Error('JATS XML must be a non-empty document within the 20 MiB limit.');
 if(/<!ENTITY/i.test(xml))throw new Error('JATS XML entity declarations are not accepted.');
 const paragraphs=[];let count=0;
 for(const match of xml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)){
  const content=tagText(match[1]);if(!content)continue;count++;
  const before=xml.slice(0,match.index),titles=[...before.matchAll(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/gi)],section=tagText(titles.at(-1)?.[1]||'');
  paragraphs.push({locator:`${section?`section “${section}”, `:''}paragraph ${count}`,content});
 }
 return paragraphs;
}

async function readBounded(response){
 const length=Number(response.headers?.get('content-length'));if(Number.isFinite(length)&&length>MAX_BYTES)throw new Error('Europe PMC response exceeds the 20 MiB limit.');
 const reader=response.body?.getReader();if(!reader){const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>MAX_BYTES)throw new Error('Europe PMC response exceeds the 20 MiB limit.');return bytes;}
 const chunks=[];let total=0;try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();throw new Error('Europe PMC response exceeds the 20 MiB limit.');}chunks.push(Buffer.from(value));}return Buffer.concat(chunks,total);}finally{reader.releaseLock();}
}
async function get(fetchImpl,url,accept,timeoutMs){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetchImpl(url,{method:'GET',headers:{accept,'user-agent':'AIAutoSlides/0.1 (explicit DOI full-text import)'},redirect:'error',signal:controller.signal});if(!response.ok)throw new Error(`Europe PMC returned HTTP ${response.status}.`);return await readBounded(response);}
 catch(error){if(error.name==='AbortError')throw new Error(`Europe PMC request timed out after ${timeoutMs} ms.`);throw error;}finally{clearTimeout(timer);}
}

export function normalizeDoi(input){
 const value=String(input||'').trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'');
 if(value.length>250||!/^10\.\d{4,9}\/[\-._;()/:A-Z0-9]+$/i.test(value))throw new Error('A DOI such as 10.1000/example is required.');
 return value;
}

export function createEuropePmcFullText({fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString()}={}){
 if(typeof fetchImpl!=='function')throw new TypeError('Europe PMC import requires a Fetch-compatible implementation');
 return Object.freeze({async fetchByDoi(input,{timeoutMs=15000}={}){
  const doi=normalizeDoi(input);if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>30000)throw new Error('timeoutMs must be 500–30000.');
  const search=new URL(`${API}/search`);search.searchParams.set('query',`DOI:${doi}`);search.searchParams.set('format','json');search.searchParams.set('resulttype','core');search.searchParams.set('pageSize','2');
  const metadataBytes=await get(fetchImpl,search.toString(),'application/json',timeoutMs);let payload;try{payload=JSON.parse(metadataBytes.toString('utf8'));}catch{throw new Error('Europe PMC returned malformed JSON metadata.');}
  const matches=payload?.resultList?.result;if(!Array.isArray(matches))throw new Error('Europe PMC response has no resultList.result array.');
  const exact=matches.filter(item=>String(item.doi||'').toLowerCase()===doi.toLowerCase());if(exact.length!==1)throw new Error(exact.length?'DOI resolved to multiple exact records.':'DOI was not found in Europe PMC.');
  const record=exact[0],pmcid=String(record.pmcid||'').toUpperCase();if(record.isOpenAccess!=='Y'||!/^PMC\d+$/.test(pmcid))throw new Error('Europe PMC has no full-text PMC open-access record for this DOI; no download was attempted.');
  const fullTextUrl=`${API}/${pmcid}/fullTextXML`,xmlBytes=await get(fetchImpl,fullTextUrl,'application/xml, text/xml;q=0.9',timeoutMs),xml=xmlBytes.toString('utf8');
  if(!/<article\b/i.test(xml)||/<!ENTITY/i.test(xml))throw new Error('Europe PMC response is not a supported JATS article or contains an entity declaration.');
  const paragraphs=extractJatsParagraphs(xml);if(!paragraphs.length)throw new Error('Full-text XML contained no extractable paragraphs.');
  return{doi,pmcid,title:clean(record.title),authors:clean(record.authorString),journal:clean(record.journalTitle),publication_year:record.pubYear||null,open_access:true,license:record.license||null,retrieved_at:clock(),metadata_url:search.toString(),full_text_url:fullTextUrl,metadata_sha256:hash(metadataBytes),source_sha256:hash(xmlBytes),bytes:xmlBytes.length,xml:xmlBytes,paragraphs,rights_review_status:'needs_human_review',verification_status:'pending_human_review'};
 }});
}

export const europePmcFullText=createEuropePmcFullText();
