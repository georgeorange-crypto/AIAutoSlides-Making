import {createHash} from 'node:crypto';

const MAX_BODY_BYTES=2*1024*1024;
const sha256=value=>createHash('sha256').update(value).digest('hex');
const clean=(value,max=1000)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):null;

async function boundedText(response){
 const declared=Number(response.headers?.get('content-length'));
 if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES)throw new Error('Research API response exceeds 2 MiB.');
 const reader=response.body?.getReader();
 if(!reader){const text=await response.text();if(Buffer.byteLength(text)>MAX_BODY_BYTES)throw new Error('Research API response exceeds 2 MiB.');return text;}
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY_BYTES){await reader.cancel();throw new Error('Research API response exceeds 2 MiB.');}chunks.push(Buffer.from(value));}return Buffer.concat(chunks,size).toString('utf8');}
 finally{reader.releaseLock();}
}

function requestOptions(timeoutMs,signal){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});return{controller,timer,signal,abort,init:{method:'GET',headers:{accept:'application/json, application/atom+xml, application/xml','user-agent':'AIAutoSlides/0.1 (opt-in scholarly metadata search)'},signal:controller.signal,redirect:'error'}};}
async function fetchBody(fetchImpl,url,timeoutMs,headers={},signal){
 const {controller,timer,signal:externalSignal,abort,init}=requestOptions(timeoutMs,signal);
 try{init.headers={...init.headers,...headers};const response=await fetchImpl(url,init);if(!response.ok)throw new Error(`Research API returned HTTP ${response.status}.`);return await boundedText(response);}
 catch(error){if(error.name==='AbortError'&&externalSignal?.aborted)throw Object.assign(new Error('Research API request was cancelled.'),{name:'AbortError'});if(error.name==='AbortError')throw new Error(`Research API timed out after ${timeoutMs} ms.`);throw error;}
 finally{clearTimeout(timer);externalSignal?.removeEventListener('abort',abort);}
}

function baseRecord({provider,query,url,retrievedAt,raw,item,index}){
 const key=provider==='openalex'?item.id:provider==='crossref'?item.DOI:item.id;
 const stable=String(key||`${provider}:${index}:${item.title||''}`).toLowerCase();
 const id=`SRC_${provider.toUpperCase()}_${sha256(stable).slice(0,16).toUpperCase()}`;
 return{schema_version:'1.0.0',source_id:id,provider,query,retrieved_at:retrievedAt,record_url:clean(url,2000),record_sha256:sha256(raw),provider_record_id:clean(key,500),title:clean(item.title,2000),authors:[],publication_year:null,doi:null,landing_url:null,verification_status:'unverified',evidence_status:'metadata_candidate_only',limitations:['Search ranking and deposited metadata are not scientific verification.','This search result contains no downloaded full text and no page-level evidence locator.','Review the publisher or repository source and preserve a human-checked page excerpt before using a claim.']};
}

function openAlexRecords(payload,context){
 if(!Array.isArray(payload?.results))throw new Error('OpenAlex response has no results array.');
 return payload.results.map((item,index)=>{const r=baseRecord({...context,item,index});r.authors=(item.authorships||[]).slice(0,100).map(a=>clean(a.author?.display_name,250)).filter(Boolean);r.publication_year=Number.isInteger(item.publication_year)?item.publication_year:null;r.doi=clean(item.doi,500);r.landing_url=clean(item.primary_location?.landing_page_url||item.id,2000);r.open_access_hint=Boolean(item.open_access?.is_oa);return r;});
}
function crossrefRecords(payload,context){
 if(!Array.isArray(payload?.message?.items))throw new Error('Crossref response has no message.items array.');
 return payload.message.items.map((item,index)=>{const r=baseRecord({...context,item,index});r.authors=(item.author||[]).slice(0,100).map(a=>clean([a.given,a.family].filter(Boolean).join(' '),250)).filter(Boolean);r.publication_year=item.published?.['date-parts']?.[0]?.[0]??item['published-print']?.['date-parts']?.[0]?.[0]??null;r.doi=clean(item.DOI,500);r.landing_url=clean(item.URL,2000);r.container_title=clean(item['container-title']?.[0],500);return r;});
}
function xmlDecode(text){return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,entity)=>{if(entity[0]==='#'){const n=entity[1]?.toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return Number.isFinite(n)&&n<=0x10ffff?String.fromCodePoint(n):'�';}return{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity.toLowerCase()];});}
function xmlTag(block,name){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),match=block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`,'i'));return match?clean(xmlDecode(match[1].replace(/<[^>]+>/g,'')),2000):null;}
function arxivRecords(xml,context){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('arXiv response contains a forbidden DTD/entity declaration.');
 const entries=[...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)];
 return entries.map(([rawEntry,body],index)=>{const id=xmlTag(body,'id'),r=baseRecord({...context,item:{id,title:xmlTag(body,'title')},index,raw:rawEntry});r.authors=[...body.matchAll(/<author(?:\s[^>]*)?>[\s\S]*?<\/author>/gi)].slice(0,100).map(([author])=>xmlTag(author,'name')).filter(Boolean);r.publication_year=Number(xmlTag(body,'published')?.slice(0,4))||null;r.landing_url=id;r.arxiv_id=id?.match(/abs\/([^v?#]+)/)?.[1]||null;r.doi=xmlTag(body,'arxiv:doi');return r;});
}

export function createMetadataSearch({fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString()}={}){
 if(typeof fetchImpl!=='function')throw new TypeError('Metadata search requires a Fetch-compatible implementation');
 async function search({provider,query,limit=5,timeoutMs=10000,signal}={}){
  if(!['openalex','crossref','arxiv'].includes(provider))throw new Error('provider must be openalex, crossref, or arxiv');
  if(typeof query!=='string'||query.trim().length<2||query.trim().length>500)throw new Error('query must contain 2-500 characters');
  if(!Number.isInteger(limit)||limit<1||limit>10)throw new Error('limit must be an integer from 1 to 10');
  if(!Number.isInteger(timeoutMs)||timeoutMs<500||timeoutMs>30000)throw new Error('timeoutMs must be an integer from 500 to 30000');
  const q=query.trim(),url=new URL(provider==='openalex'?'https://api.openalex.org/works':provider==='crossref'?'https://api.crossref.org/works':'https://export.arxiv.org/api/query');
  if(provider==='openalex'){url.searchParams.set('search',q);url.searchParams.set('per-page',String(limit));url.searchParams.set('select','id,doi,title,publication_year,authorships,primary_location,open_access');}
  if(provider==='crossref'){url.searchParams.set('query.bibliographic',q);url.searchParams.set('rows',String(limit));url.searchParams.set('select','DOI,title,author,published,published-print,URL,container-title,type');}
  if(provider==='arxiv'){url.searchParams.set('search_query',`all:${q.replace(/[\r\n]/g,' ').slice(0,200)}`);url.searchParams.set('start','0');url.searchParams.set('max_results',String(limit));url.searchParams.set('sortBy','relevance');}
  const retrievedAt=clock(),headers=provider==='openalex'&&process.env.OPENALEX_API_KEY?{authorization:`Bearer ${process.env.OPENALEX_API_KEY}`}:{},raw=await fetchBody(fetchImpl,url.toString(),timeoutMs,headers,signal),context={provider,query:q,url:url.toString(),retrievedAt,raw};let payload,records;
  if(provider==='openalex'){try{payload=JSON.parse(raw);}catch{throw new Error('OpenAlex returned malformed JSON.');}records=openAlexRecords(payload,context);}
  else if(provider==='crossref'){try{payload=JSON.parse(raw);}catch{throw new Error('Crossref returned malformed JSON.');}records=crossrefRecords(payload,context);}
  else records=arxivRecords(raw,context);
  return{schema_version:'1.0.0',provider,query:q,retrieved_at:retrievedAt,request_url:url.toString(),response_sha256:sha256(raw),result_count:records.length,verification_status:'unverified',results:records,warnings:['Metadata search is opt-in and sends the query string to the selected public provider.','Search is separate from downloading; this operation does not fetch PDFs or full text.','Search-result metadata is not evidence that a scientific claim is true.']};
 }
 return Object.freeze({search});
}

export const metadataSearch=createMetadataSearch();
