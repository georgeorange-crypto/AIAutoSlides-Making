import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {downloadArxivPdf} from './arxiv-download.mjs';
import {extractPdfPages} from '../../src/document-extractors.mjs';

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const excerpt=text=>String(text||'').replace(/\s+/g,' ').trim().slice(0,320);

export function createArxivIngest({download=downloadArxivPdf,extract=extractPdfPages,clock=()=>new Date().toISOString()}={}){
 return async function ingest({results,outDir,sourceId,signal,onStage=()=>{}}={}){
  if(!results||results.provider!=='arxiv'||!Array.isArray(results.results))throw new Error('results must be an arXiv metadata-search result file');
  if(typeof sourceId!=='string'||!sourceId)throw new Error('sourceId must select one arXiv candidate');
  const candidate=results.results.find(row=>row.source_id===sourceId);
  if(!candidate||!candidate.arxiv_id)throw new Error('sourceId was not found in the arXiv results or has no arXiv identifier');
  if(typeof outDir!=='string'||!outDir.trim())throw new Error('outDir is required');
  const directory=path.resolve(outDir);if(fs.existsSync(directory))throw new Error(`Refusing to overwrite existing output directory: ${directory}`);
  onStage('download','running',{source_id:sourceId,arxiv_id:candidate.arxiv_id});const {url,bytes}=await download(candidate.arxiv_id,{signal});if(signal?.aborted)throw Object.assign(new Error('arXiv ingestion was cancelled.'),{name:'AbortError'});onStage('download','completed',{bytes:bytes.length,url});
  onStage('pdf-extraction','running',{engine:'pdfjs-dist'});const pages=await extract(bytes);if(signal?.aborted)throw Object.assign(new Error('arXiv ingestion was cancelled.'),{name:'AbortError'});onStage('pdf-extraction','completed',{page_count:pages.length});
  if(!Array.isArray(pages)||!pages.length)throw new Error('PDF extractor returned no pages');
  const sourceHash=sha256(bytes),evidenceId=`E:ARXIV:${sha256(Buffer.from(candidate.arxiv_id)).slice(0,16).toUpperCase()}`;
  const evidenceEntries=pages.filter(page=>page.content?.trim()).map((page,index)=>({
   id:`${evidenceId}:P${String(index+1).padStart(4,'0')}`,
   label:`${candidate.title||candidate.arxiv_id} — ${page.locator}`,
   source:url,uri:candidate.landing_url||null,locator:page.locator,excerpt:excerpt(page.content),
   source_sha256:sourceHash,verified:false,verification_status:'pending_human_review',
   note:'Machine-extracted excerpt candidate. Compare against the original PDF and review paper-specific reuse rights before use.'
  }));
  if(!evidenceEntries.length)throw new Error('PDF contains no selectable text; scanned PDFs require a separately reviewed OCR workflow');
  const markdown=[`# Extracted paper: ${candidate.title||candidate.arxiv_id}`,'',`- arXiv ID: ${candidate.arxiv_id}`,`- Download URL: ${url}`,`- Source SHA-256: ${sourceHash}`,'- Verification: pending human review','',...pages.flatMap((page,index)=>[`## Page ${String(index+1).padStart(4,'0')} — ${page.locator}`,'',page.content||'[No selectable text on this page]',''])].join('\n');
  const manifest={schema_version:'1.0.0',source_id:evidenceId,provider_source_id:sourceId,provider:'arxiv',arxiv_id:candidate.arxiv_id,title:candidate.title,landing_url:candidate.landing_url||null,download_url:url,retrieved_at:clock(),source_file:'source.pdf',source_sha256:sourceHash,bytes:bytes.length,page_count:pages.length,extraction_engine:'pdfjs-dist',excerpts:evidenceEntries.map(({id,locator,excerpt,source_sha256})=>({id,locator,excerpt,source_sha256})),verification_status:'pending_human_review',reuse_rights:'needs_review',warnings:['arXiv availability does not establish a paper-specific reuse license. Review rights before redistributing text or figures.','Extracted text and excerpts require human comparison against original PDF pages.']};
  const parent=path.dirname(directory);fs.mkdirSync(parent,{recursive:true});fs.mkdirSync(directory);
  for(const [name,data] of [['source.pdf',bytes],['extracted.md',Buffer.from(markdown)],['source.manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')],['evidence.json',Buffer.from(JSON.stringify({entries:evidenceEntries},null,2)+'\n')]])fs.writeFileSync(path.join(directory,name),data,{flag:'wx'});
  onStage('persist-ingestion','completed',{directory,page_count:pages.length,evidence_count:evidenceEntries.length});
  return{directory,manifest,evidence:{entries:evidenceEntries}};
 };
}

export const ingestArxivPaper=createArxivIngest();
