import crypto from 'node:crypto';
const API='https://commons.wikimedia.org/w/api.php';
const MAX_JSON=4*1024*1024,MAX_IMAGE=25*1024*1024,MAX_BATCH_ITEMS=5,MAX_BATCH_TOTAL=50*1024*1024;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function plain(value,max=1000){return typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#039;/g,"'").replace(/\s+/g,' ').trim().slice(0,max):null;}
async function bytes(response,max){const n=Number(response.headers.get('content-length'));if(Number.isFinite(n)&&n>max)throw new Error(`Response exceeds ${max} byte limit`);const reader=response.body?.getReader();if(!reader){const b=Buffer.from(await response.arrayBuffer());if(b.length>max)throw new Error('Response exceeds size limit');return b;}const parts=[];let total=0;try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new Error('Response exceeds size limit');}parts.push(Buffer.from(value));}return Buffer.concat(parts,total);}finally{reader.releaseLock();}}
async function get(fetchImpl,url,accept,max){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const response=await fetchImpl(url,{method:'GET',headers:{accept,'user-agent':'AIAutoSlides/0.1 (single-item Wikimedia Commons rights-aware asset search)'},redirect:'error',signal:controller.signal});if(!response.ok)throw new Error(`Wikimedia Commons returned HTTP ${response.status}`);const body=await bytes(response,max);return{body,hash:hash(body)};}catch(e){if(e.name==='AbortError')throw new Error('Wikimedia Commons request timed out');throw e;}finally{clearTimeout(timer);}}
export function createWikimediaCommons({fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString()}={}){
 async function search({query,limit=5}={}){
  if(typeof query!=='string'||query.trim().length<2||query.trim().length>300)throw new Error('query must contain 2-300 characters');if(!Number.isInteger(limit)||limit<1||limit>10)throw new Error('limit must be 1 to 10');
  const url=new URL(API);for(const [k,v] of Object.entries({action:'query',format:'json',formatversion:'2',generator:'search',gsrsearch:`filetype:bitmap ${query.trim()}`,gsrnamespace:'6',gsrlimit:String(limit),prop:'imageinfo',iiprop:'url|size|mime|extmetadata',iiurlwidth:'1600'}))url.searchParams.set(k,v);
  const {body,hash:responseHash}=await get(fetchImpl,url.toString(),'application/json',MAX_JSON);let payload;try{payload=JSON.parse(body.toString('utf8'));}catch{throw new Error('Wikimedia Commons returned malformed JSON');}
  const pages=payload?.query?.pages;if(!Array.isArray(pages))throw new Error('Wikimedia Commons response did not contain image pages');
  const results=pages.map(page=>{const info=page.imageinfo?.[0],meta=info?.extmetadata||{};return{schema_version:'1.0.0',source_id:`WMC_${hash(Buffer.from(String(page.pageid))).slice(0,16).toUpperCase()}`,provider:'wikimedia-commons',title:plain(page.title,500),description_page:`https://commons.wikimedia.org/wiki/${encodeURIComponent(String(page.title||'').replaceAll(' ','_'))}`,thumbnail_url:info?.thumburl||null,thumbnail_mime:info?.thumbmime||info?.mime||null,original_mime:info?.mime||null,license_short_name:plain(meta.LicenseShortName?.value,200),license_url:plain(meta.LicenseUrl?.value,1000),usage_terms:plain(meta.UsageTerms?.value,500),artist:plain(meta.Artist?.value,1000),credit:plain(meta.Credit?.value,1000),attribution_required:/true/i.test(meta.AttributionRequired?.value||''),width:info?.width||null,height:info?.height||null,metadata_sha256:responseHash,retrieved_at:clock(),rights_review_status:'needs_human_review',verification_status:'unverified',limitations:['Commons search metadata and license declarations require checking on the file description page.','Public availability does not automatically authorize use in every context.','Search never downloads images; a separate single-item download step is required.']};});
  return{schema_version:'1.0.0',provider:'wikimedia-commons',query:query.trim(),retrieved_at:clock(),request_url:url.toString(),response_sha256:responseHash,result_count:results.length,results,warnings:['Downloads require explicit selection and a separate opt-in command.','Batch download is limited to at most five selected images and 50 MiB total.']};
 }
 async function download({candidate,assetId,fetchImpl:override=fetchImpl}={}){
  if(!candidate||candidate.provider!=='wikimedia-commons'||!candidate.thumbnail_url)throw new Error('candidate must be a Wikimedia Commons search result with a thumbnail URL');if(typeof assetId!=='string'||!/^A_[A-Z0-9][A-Z0-9_-]{1,50}$/.test(assetId))throw new Error('assetId must match A_UPPERCASE format');
  const url=new URL(candidate.thumbnail_url);if(url.protocol!=='https:'||!new Set(['upload.wikimedia.org','thumb.wikimedia.org']).has(url.hostname)||url.username||url.password)throw new Error('Only HTTPS images from Wikimedia upload/thumbnail hosts are downloadable');
  const {body}=await get(override,url.toString(),'image/jpeg, image/png',MAX_IMAGE),mime=body.subarray(0,8).toString('hex').startsWith('89504e470d0a1a0a')?'image/png':body.subarray(0,3).toString('hex')==='ffd8ff'?'image/jpeg':null;if(!mime)throw new Error('Downloaded media is not a supported PNG or JPEG; it was not saved');
  return{bytes:body,asset:{asset_id:assetId,path:`${assetId}.${mime==='image/png'?'png':'jpg'}`,type:mime,mime_type:mime,sha256:hash(body),source:candidate.description_page,license:candidate.license_short_name||'unknown; human review required',verified:false,author:candidate.artist,credit:candidate.credit,license_url:candidate.license_url,attribution_required:candidate.attribution_required,rights_review_status:'needs_human_review',source_metadata_sha256:candidate.metadata_sha256,download_url:url.toString(),retrieved_at:clock()}};
 }
 async function downloadBatch({candidates,selections}={}){
  if(!Array.isArray(candidates)||!Array.isArray(selections)||selections.length<1||selections.length>MAX_BATCH_ITEMS)throw new Error('selections must contain 1 to '+MAX_BATCH_ITEMS+' explicitly selected items');
  const sourceIds=new Set(),assetIds=new Set();
  for(const [index,selection] of selections.entries()){
   if(!selection||typeof selection.source_id!=='string'||!/^WMC_[A-F0-9]{16}$/.test(selection.source_id))throw new Error('selection '+index+' must have a valid Wikimedia source_id');
   if(sourceIds.has(selection.source_id))throw new Error('Duplicate selected source_id '+selection.source_id);sourceIds.add(selection.source_id);
   if(typeof selection.asset_id!=='string'||!/^A_[A-Z0-9][A-Z0-9_-]{1,50}$/.test(selection.asset_id))throw new Error('selection '+index+' must have an A_UPPERCASE asset_id');
   if(assetIds.has(selection.asset_id))throw new Error('Duplicate selected asset_id '+selection.asset_id);assetIds.add(selection.asset_id);
   if(!candidates.some(candidate=>candidate&&candidate.source_id===selection.source_id))throw new Error('Selected source_id '+selection.source_id+' is absent from the search result file');
  }
  const items=[],hashes=new Set();let total=0;
  for(const selection of selections){
   const candidate=candidates.find(item=>item.source_id===selection.source_id),downloaded=await download({candidate,assetId:selection.asset_id});if(hashes.has(downloaded.asset.sha256))throw new Error(`Duplicate downloaded image bytes for ${selection.asset_id}`);hashes.add(downloaded.asset.sha256);total+=downloaded.bytes.length;
   if(total>MAX_BATCH_TOTAL)throw new Error('Selected media exceed the '+MAX_BATCH_TOTAL+' byte aggregate batch limit');
   items.push({source_id:selection.source_id,...downloaded});
  }
  return{items,total_bytes:total,limits:{max_items:MAX_BATCH_ITEMS,max_total_bytes:MAX_BATCH_TOTAL}};
 }
 return Object.freeze({search,download,downloadBatch});
}
export const wikimediaCommons=createWikimediaCommons();
