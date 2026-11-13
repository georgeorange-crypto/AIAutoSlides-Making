import crypto from 'node:crypto';
import {assertPublicHttps,validateSameHostRedirect} from './crawl-policy.mjs';
import {runResearchWorkerAsync} from './python-sidecar.mjs';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const excerpt=text=>String(text||'').replace(/\s+/g,' ').trim().slice(0,320);
function blocks(markdown){return markdown.split(/\n\s*\n/).map(value=>value.replace(/^\s*#+\s*/,'').trim()).filter(Boolean).slice(0,500);}

export async function crawlAuthorizedPage({url,timeoutSeconds=30,signal,onStage=()=>{},runWorker=runResearchWorkerAsync,checkUrl=assertPublicHttps,clock=()=>new Date().toISOString()}={}){
 const requestedCheck=await checkUrl(url),requested=requestedCheck.url;
 onStage('crawl','running',{url:requested.toString(),provider:'crawl4ai'});
 const result=await runWorker({action:'crawl',url:requested.toString(),timeout_seconds:Math.min(45,Math.max(10,Number(timeoutSeconds)||30))},{timeoutMs:60000,maxBuffer:12*1024*1024,signal});
 if(signal?.aborted)throw Object.assign(new Error('Authorized page crawl was cancelled.'),{name:'AbortError'});
 const finalCheck=await checkUrl(result.final_url||requested.toString()),finalUrl=validateSameHostRedirect(requested,finalCheck.url),markdown=String(result.markdown||''),bytes=Buffer.from(markdown,'utf8');
 if(!bytes.length||bytes.length>10*1024*1024)throw new Error('Crawled Markdown must be between 1 byte and 10 MiB');
 if(result.robots_checked!==true)throw new Error('Crawl4AI did not confirm its robots-policy check');
 const sourceHash=sha256(bytes),sourceKey=sha256(Buffer.from(`${url}:${sourceHash}`)).slice(0,16).toUpperCase(),evidenceEntries=blocks(markdown).map((text,index)=>({evidence_id:`E:WEB:${sourceKey}:B${String(index+1).padStart(4,'0')}`,excerpt:excerpt(text),locator:`web page excerpt ${index+1}`,source_sha256:sourceHash,verification_status:'pending',review_status:'pending_human_review'})).filter(item=>item.excerpt),manifest={schema_version:'1.0.0',provider:'crawl4ai',requested_url:requested.toString(),final_url:finalUrl.toString(),title:String(result.title||'').slice(0,500),retrieved_at:clock(),robots_checked:true,egress_gateway_mapping:requestedCheck.mappedEgress||finalCheck.mappedEgress,markdown_sha256:sourceHash,byte_count:bytes.length,block_count:evidenceEntries.length,verification_status:'pending_human_review',reuse_rights:'needs_review',warnings:['Single page only; no link traversal or bulk media download.','Crawled content is untrusted. Confirm excerpts against the live page and review site terms and reuse rights before use.']};
 onStage('crawl','completed',{source_sha256:sourceHash,excerpt_count:evidenceEntries.length,final_url:finalUrl.toString()});
 return{manifest,markdown,sourceHash,evidenceEntries};
}
