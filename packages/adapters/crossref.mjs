import {createHash} from 'node:crypto';
import {defineToolAdapter} from './protocol.mjs';

const API='https://api.crossref.org/works/';
const DOI=/^10\.\d{4,9}\/\S+$/i;
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const MAX_RESPONSE_BYTES=2*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
const clean=(value,max=1000)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):null;
function normalizeDoi(value){
 if(typeof value!=='string'||!value.trim())throw new TypeError('doi must be a non-empty string');
 let doi=value.trim().replace(/^doi:\s*/i,'');
 doi=doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'');
 try{doi=decodeURIComponent(doi);}catch{throw new Error('doi contains invalid percent-encoding');}
 if(!DOI.test(doi)||/[?#\s]/.test(doi))throw new Error('doi must be a DOI name such as 10.1000/example');
 return doi;
}
function dateParts(value){
 const parts=value?.['date-parts'];
 if(!Array.isArray(parts)||!Array.isArray(parts[0])||!parts[0].every(Number.isInteger))return null;
 return parts[0].slice(0,3);
}
async function readBoundedBody(response){
 const declaredBytes=Number(response.headers?.get('content-length'));
 if(Number.isFinite(declaredBytes)&&declaredBytes>MAX_RESPONSE_BYTES)throw new Error('Crossref response exceeds the 2 MiB safety limit.');
 const reader=response.body?.getReader();
 if(!reader){const body=await response.text();if(Buffer.byteLength(body,'utf8')>MAX_RESPONSE_BYTES)throw new Error('Crossref response exceeds the 2 MiB safety limit.');return body;}
 const chunks=[];let bytes=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_RESPONSE_BYTES){await reader.cancel();throw new Error('Crossref response exceeds the 2 MiB safety limit.');}chunks.push(Buffer.from(value));}
  return Buffer.concat(chunks,bytes).toString('utf8');
 }finally{reader.releaseLock();}
}
function selectMetadata(item,doi,sourceId,rawHash,retrievedAt){
 const authors=(Array.isArray(item.author)?item.author:[]).slice(0,100).map(author=>({given:clean(author.given,150),family:clean(author.family,150),name:clean(author.name,250),orcid:clean(author.ORCID,250),affiliations:(Array.isArray(author.affiliation)?author.affiliation:[]).slice(0,10).map(value=>clean(value?.name,250)).filter(Boolean)}));
 const updates=(Array.isArray(item['update-to'])?item['update-to']:[]).slice(0,50).map(update=>({type:clean(update.type,100),doi:clean(update.DOI,250),label:clean(update.label,250)}));
 return{
  schema_version:'1.0.0',source_id:sourceId,type:'crossref-bibliographic-metadata',uri:`https://doi.org/${doi}`,doi,
  title:clean(Array.isArray(item.title)?item.title[0]:item.title,2000),authors,publisher:clean(item.publisher,500),
  container_title:clean(Array.isArray(item['container-title'])?item['container-title'][0]:item['container-title'],500),
  published_date_parts:dateParts(item['published-print'])||dateParts(item['published-online'])||dateParts(item.issued),
  deposited_date_parts:dateParts(item.deposited),type:clean(item.type,120),volume:clean(item.volume,100),issue:clean(item.issue,100),page:clean(item.page,100),
  license:(Array.isArray(item.license)?item.license:[]).slice(0,20).map(value=>({url:clean(value.URL,1000),start_date:dateParts(value.start)})),
  subjects:(Array.isArray(item.subject)?item.subject:[]).slice(0,100).map(value=>clean(value,300)).filter(Boolean),updates,
  record_sha256:rawHash,retrieved_at:retrievedAt,verification_status:'unverified',
  limitations:['Crossref metadata is deposited by members and may be incomplete or stale.','This adapter does not fetch full text or abstracts, create evidence excerpts, or verify scientific claims.','Crossref license metadata describes deposited records and is not an asset reuse approval.']
 };
}

export function createCrossrefAdapter({fetchImpl=globalThis.fetch,minIntervalMs=250,cacheTtlMs=30000,clock=()=>Date.now()}={}){
 if(typeof fetchImpl!=='function')throw new TypeError('Crossref adapter requires a Fetch-compatible implementation');
 if(!Number.isFinite(minIntervalMs)||minIntervalMs<0||minIntervalMs>10000)throw new TypeError('minIntervalMs must be from 0 to 10000');
 if(!Number.isFinite(cacheTtlMs)||cacheTtlMs<0)throw new TypeError('cacheTtlMs must be non-negative');
 const cache=new Map();let queue=Promise.resolve(),lastRequestAt=0;
 async function request(url,init){
  let release;const previous=queue;queue=new Promise(resolve=>{release=resolve;});await previous;
  try{
   const delay=Math.max(0,minIntervalMs-(clock()-lastRequestAt));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   lastRequestAt=clock();return await fetchImpl(url,init);
  }finally{release();}
 }
 return defineToolAdapter({
  manifest:{id:'crossref',version:'REST API v1',status:'adapter-ready',kind:'research-metadata',invoke:'HTTPS GET',inputs:['doi'],outputs:['source-metadata-1.0.0'],needsNetwork:true,needsAuth:false},
  async doctor(){return typeof fetchImpl==='function'?{ok:true,status:'available',version:'native fetch',warnings:[]}:{ok:false,status:'blocked',reason:'Node fetch is unavailable.',warnings:[]};},
  async probeCapabilities(){return{formats:['source-metadata-1.0.0'],doiLookup:true,fullText:false,abstracts:false,createsEvidence:false,verifiesClaims:false,network:'public Crossref REST API; GET only'};},
  async smokeTest(){
   const mock=createCrossrefAdapter({minIntervalMs:0,cacheTtlMs:0,fetchImpl:async()=>new Response(JSON.stringify({status:'ok',message:{DOI:'10.5555/12345678',title:['Synthetic smoke fixture'],type:'journal-article',abstract:'Must not be retained.'}}),{status:200,headers:{'content-type':'application/json'}})});
   try{const result=await mock.run({doi:'10.5555/12345678'});return{ok:result.metadata.title==='Synthetic smoke fixture'&&!('abstract' in result.metadata),doi:result.metadata.doi,network:'mock-only',record_sha256:result.metadata.record_sha256};}catch(error){return{ok:false,reason:error.message};}
  },
  async run({doi,sourceId,timeoutMs=10000,mailTo=process.env.CROSSREF_MAILTO}={}){
   const normalized=normalizeDoi(doi),id=sourceId||`CR_${hash(normalized.toLowerCase()).slice(0,16)}`;
   if(!ID.test(id))throw new Error('sourceId must be a stable letters/digits/dot/underscore/colon/hyphen ID');
   if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>30000)throw new Error('timeoutMs must be an integer from 500 to 30000');
   if(mailTo!==undefined&&mailTo!==''&&(typeof mailTo!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailTo)))throw new Error('mailTo must be a valid email address when supplied');
   const key=normalized.toLowerCase(),cached=cache.get(key),now=clock();if(cached&&now-cached.at<cacheTtlMs)return{...cached.value,cache_hit:true};
   const url=new URL(encodeURIComponent(normalized),API);if(mailTo)url.searchParams.set('mailto',mailTo);
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
   try{
    const response=await request(url.toString(),{method:'GET',headers:{accept:'application/json','user-agent':'AIAutoSlides/0.1 (Crossref bibliographic metadata lookup)'},signal:controller.signal,redirect:'error'});
    if(response.status===404)throw new Error(`Crossref has no record for DOI '${normalized}'.`);
    if(response.status===429)throw new Error('Crossref rate limit reached; retry later and reduce request concurrency.');
    if(response.status===403)throw new Error('Crossref denied the request; check the public API status and request rate.');
    if(!response.ok)throw new Error(`Crossref request failed with HTTP ${response.status}.`);
    const body=await readBoundedBody(response);
    let payload;try{payload=JSON.parse(body);}catch{throw new Error('Crossref returned malformed JSON.');}
    const item=payload?.message;if(!item||typeof item!=='object'||Array.isArray(item)||typeof item.DOI!=='string')throw new Error('Crossref response does not contain a work metadata record.');
    if(item.DOI.toLowerCase()!==normalized.toLowerCase())throw new Error('Crossref returned a record for a different DOI.');
    const result={status:'completed',provider:'crossref',metadata:selectMetadata(item,normalized,id,hash(body),new Date(clock()).toISOString()),cache_hit:false,warnings:['Bibliographic metadata is unverified input. Human review and source-document inspection remain required.']};
    cache.set(key,{at:clock(),value:result});return result;
   }catch(error){if(error.name==='AbortError')throw new Error(`Crossref request timed out after ${timeoutMs} ms.`);throw error;}finally{clearTimeout(timer);}
  }
 });
}

export const crossrefAdapter=createCrossrefAdapter();
