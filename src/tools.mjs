#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {pptxgenjsAdapter} from '../packages/adapters/pptxgenjs.mjs';
import {pptxgenjsIRAdapter} from '../packages/adapters/pptxgenjs-ir.mjs';
import {pdfjsAdapter} from '../packages/adapters/pdfjs.mjs';
import {ooxmlTextAdapter} from '../packages/adapters/ooxml-text.mjs';
import {mermaidAdapter} from '../packages/adapters/mermaid.mjs';
import {crossrefAdapter} from '../packages/adapters/crossref.mjs';
import {slidevAdapter} from '../packages/adapters/slidev.mjs';
import {createGoogleOAuthServer,loadOAuthClient} from './google-oauth.mjs';
import {createCanvaOAuthServer} from './canva-oauth.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalogDir=path.join(root,'registry','catalog');
function loadCatalog(){return fs.readdirSync(catalogDir).filter(f=>f.endsWith('.yaml')).sort().map(f=>JSON.parse(fs.readFileSync(path.join(catalogDir,f),'utf8')));}
const adapters=new Map([[pptxgenjsAdapter.manifest.id,pptxgenjsAdapter],[pptxgenjsIRAdapter.manifest.id,pptxgenjsIRAdapter],[pdfjsAdapter.manifest.id,pdfjsAdapter],[ooxmlTextAdapter.manifest.id,ooxmlTextAdapter],[mermaidAdapter.manifest.id,mermaidAdapter],[crossrefAdapter.manifest.id,crossrefAdapter],[slidevAdapter.manifest.id,slidevAdapter]]);
function executable(name){const r=spawnSync(name,['--version'],{encoding:'utf8',timeout:4000,windowsHide:true});return r.error?null:(r.stdout||r.stderr||'available').trim().split(/\r?\n/)[0];}
function line(t){console.log(`${t.id.padEnd(23)} ${(t.status||'catalogued').padEnd(16)} ${t.name}`);}
async function main(){
 const [, , group, command, id]=process.argv;
 if(group!=='tools'||!['list','doctor','test','recommend','auth-status','connect-google','connect-canva'].includes(command)){console.log('Usage: node src/tools.mjs tools <list|doctor|test [tool-id]|recommend <workflow>|auth-status|connect-google|connect-canva>');process.exitCode=2;return;}
 const all=loadCatalog();
 if(command==='auth-status'){let state='not configured; set GOOGLE_OAUTH_CLIENT_FILE';if(process.env.GOOGLE_OAUTH_CLIENT_FILE){try{loadOAuthClient(process.env.GOOGLE_OAUTH_CLIENT_FILE);state='configured (local consent test available)';}catch(e){state=`configuration error: ${e.message}`;process.exitCode=1;}}console.log(`google-slides: ${state}`);return;}
 if(command==='recommend'){
  const workflow=id, specs={
   research:[['academic metadata',['crossref']],['document extraction',['pdfjs-dist','tesseract-js','pymupdf','docling','markitdown']],['evidence review',['fact-review','deterministic-planner']],['editable deck',['pptxgenjs','python-pptx','slidev']],['diagrams',['mermaid','d2','graphviz']]],
   pitch:[['editable deck',['pptxgenjs','presenton','gamma','canva','slidev']],['visual assets',['lucide','wikimedia-commons','pexels']]],
   modify:[['PPTX inspection and modification',['pptx-automizer','ooxml-inspector','powerpoint-com']]],
   update:[['data-bound deck',['pptxgenjs','python-pptx']],['charts',['vega-lite','matplotlib','echarts']]],
   web:[['HTML presentation',['slidev','marp','quarto','pptxgenjs']]],
   multiengine:[['independent deck backends',['pptxgenjs','slidev','presenton-service','marp']]]
  };
  if(!workflow||!specs[workflow]){console.error(`Choose workflow: ${Object.keys(specs).join(', ')}`);process.exitCode=2;return;}
  const byId=new Map(all.map(t=>[t.id,t]));const notes={
   'pdfjs-dist':['Integrated: local selectable-text extraction with page locators is used by document import.','Image-only scans need the separate local OCR route; PDF.js extraction itself does not verify claim truth.'],
   crossref:['Optional DOI lookup for bibliographic metadata; requests are read-only and require no account.','Returned records are unverified metadata only. The adapter does not retrieve abstracts or full text, create evidence excerpts, or confirm scientific claims.'],
   'tesseract-js':['Integrated: bundled Tesseract.js 7 engine plus local eng and chi_sim traineddata performs offline OCR after Poppler rasterizes each scanned PDF page.','OCR confidence is not scientific verification; page images and extracted text still require human comparison.'],
   pymupdf:['Python library with broad PDF extraction and rendering; useful as an alternate parser after a local adapter exists.','Not installed or wired into this Node project; Python environment and license/dependency review required.'],
   docling:['Local Python pipeline can preserve richer layout/table structure; consider for complex papers.','Heavier model/runtime and not installed here; extracted claims still require evidence review.'],
   markitdown:['Text-first Office/PDF-to-Markdown fallback with a broad format set.','Not installed/wired here; layout/table fidelity differs from Docling and must be fixture-tested.'],
   'fact-review':['Use the project review gate and deterministic critic for source links, flags, and human approval.','Automated checks do not verify scientific truth or replace human fact checking.'],
   'deterministic-planner':['Local rule-based planner provides reproducible fallback.','Less flexible narrative than an optional AI draft; all generated claims still need evidence IDs.'],
   pptxgenjs:['Current MVP backend; emits native editable text, shapes, tables and chart objects through the validated Presentation IR adapter.','Supports the declared IR mapping; incremental editing is not available and Mermaid source is retained as text.'],
   'python-pptx':['Python API can inspect/edit OOXML objects and offers a separate implementation option.','Not integrated here; unsupported PowerPoint parts may not round-trip, so preservation tests are required.'],
   slidev:['Integrated local Presentation IR adapter: PDF/PNG preview and lineage-preserving asset staging.','PPTX export may rasterize complex content and is rejected when editable-text QA fails; no native chart objects.'],
   mermaid:['Compact text DSL for common flowcharts; keep editable source alongside SVG preview.','SVG embedded in PPTX is an image object, not editable native PowerPoint shapes.'],
   d2:['Alternative diagram DSL and layout engine for architecture/flow diagrams.','Separate executable not installed; rendered SVG is not native editable PPTX shapes.'],
   graphviz:['Mature graph layout option for node-edge diagrams.','Separate executable not installed; SVG is not native editable PPTX shapes.'],
   'pptx-automizer':['Candidate for targeted edits to existing PPTX files while retaining untouched objects.','No adapter/preservation suite yet; never overwrite source deck.'],
   'ooxml-inspector':['Useful for structural inspection and before/after package diffs.','Inspection does not itself provide a safe visual editor or prove render fidelity.'],
   'presenton-service':['Self-hosted service candidate for alternative generation/export workflows.','Requires separate service setup; provider/model configuration may add network use or cost; no AIAuto lineage bridge.'],
   gamma:['Hosted design workflow can be a visual alternative when user accepts provider processing.','Requires account/network and terms/cost review; no integration or data upload is enabled.'],
   canva:['Hosted editor is useful for human finishing and brand workflows.','Requires account/network and explicit data sharing; no API integration or upload is enabled.'],
   'vega-lite':['Declarative chart specification enables reproducible figure previews.','Image rendering is not a native PowerPoint chart; a mapping adapter is still needed.'],
   matplotlib:['Python scientific plotting option for specialized figures.','Raster/vector image embed is less editable than a native chart; no adapter is integrated.'],
   echarts:['Browser chart renderer offers interactive visual options.','Rendered charts may become images in PPTX; no native-chart bridge is integrated.'],
   marp:['Simple Markdown-to-slides alternative for lightweight technical talks.','Editable PPTX export has fidelity caveats; not wired into current evidence lineage path.'],
   quarto:['Research document and citation workflows can feed presentation formats.',"Requires separate CLI/format setup and a metadata bridge to retain this project's evidence IDs."]
  };
  const stages=specs[workflow].map(([stage,ids])=>{const options=ids.map((toolId,index)=>{const t=byId.get(toolId);if(!t)return null;let status=adapters.has(t.id)?'local adapter available':t.probe?.command?'candidate; local executable probe available':'catalogue candidate; no runnable adapter';if(['pdfjs-dist','tesseract-js'].includes(t.id))status='integrated in local document importer';if(['pptxgenjs','pptxgenjs-ir'].includes(t.id))status='validated Presentation IR → editable PPTX adapter available';if(t.id==='fact-review')status='project review functions available; no standalone tool adapter';const n=notes[t.id];return {rank:index+1,id:t.id,name:t.name,implementation:status,requires:{network:t.needs_network,auth:t.needs_auth,cost:t.expected_cost,editable:t.editable},why:n?.[0]||`${t.kind}; ${t.needs_network?'network required':'local/offline capable'}${t.needs_auth?'; account authorization required':''}.`,tradeoff:n?.[1]||'Candidate only. Check upstream version, license, dependencies, and format fidelity before adoption.',license_state:t.license?.review_status||'unknown',selection:index===0?'recommended default':'alternative; choose when its stated trade-off fits',execution:'not run by recommendation'};}).filter(Boolean);return {stage,primary:options[0],alternatives:options.slice(1)};});
  console.log(JSON.stringify({workflow,policy:'local-first suggestions; network/auth/cost tools are never invoked here; select explicitly before execution',stages},null,2));return;
 }
 if(command==='connect-google'){
  const app=createGoogleOAuthServer();const address=await app.listen();const url=`http://127.0.0.1:${address.port}`;console.log(`Google OAuth test listening at ${url}`);console.log(process.env.GOOGLE_OAUTH_CLIENT_FILE?'OAuth client loaded. Open the URL in your browser.':'Configure GOOGLE_OAUTH_CLIENT_FILE, then restart. The local UI shows setup status.');console.log('Press Ctrl+C to stop. No presentation is created or uploaded.');return;
 }
 if(command==='connect-canva'){
  const app=createCanvaOAuthServer();const address=await app.listen();const url=`http://127.0.0.1:${address.port}`;console.log(`Canva login test listening at ${url}`);console.log(process.env.CANVA_CLIENT_ID&&process.env.CANVA_CLIENT_SECRET?'OAuth client configured. Open the URL in your browser.':'Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET, then restart.');console.log('In the Canva Developer Portal register http://127.0.0.1:53682/callback and allow profile:read.');console.log('Press Ctrl+C to stop. No design is created or uploaded.');return;
 }
 if(command==='list'){for(const t of all)line(t);console.log(`\n${all.length} catalog entries. Status records implementation evidence, not vendor claims.`);return;}
 const selected=id?all.filter(t=>t.id===id):all;
 if(id&&!selected.length){console.error(`Unknown tool id: ${id}`);process.exitCode=2;return;}
 let failures=0;
 for(const tool of selected){
  const adapter=adapters.get(tool.id);
  let result;
  if(adapter){result=await adapter.doctor();}
  else if(tool.id==='google-slides'){try{loadOAuthClient(process.env.GOOGLE_OAUTH_CLIENT_FILE||'');result={ok:true,status:'configured',reason:'Local consent test is ready; run npm run connect:google to begin user-controlled authorization.',warnings:[]};}catch{result={ok:false,status:'blocked',reason:'Set GOOGLE_OAUTH_CLIENT_FILE to your local Google Desktop OAuth client JSON, then run npm run connect:google.',warnings:[]};}}
  else if(tool.probe?.command){const version=executable(tool.probe.command);result=version?{ok:true,status:'available',version,warnings:[]}:{ok:false,status:'blocked',reason:`Executable '${tool.probe.command}' not found; install/configure it to use ${tool.name}.`,warnings:[]};}
  else result={ok:false,status:'blocked',reason:tool.needsAuth?'Requires an explicitly configured account, credentials, and user-approved permissions.':'No executable adapter is implemented yet; catalog entry only.',warnings:[]};
  if(command==='test'){
   if(!adapter){result={ok:false,status:'blocked',reason:'No adapter smoke test is implemented. Catalog metadata is not an integration test.',warnings:[]};}
   else if(result.ok){const smoke=await adapter.smokeTest?.();result=smoke?.ok?{...result,status:'smoke-tested',smoke}:{ok:false,status:'blocked',reason:'Adapter has no runnable artifact smoke test.',warnings:[]};}
  }
  console.log(`${tool.id}: ${result.status|| (result.ok?'available':'blocked')}${result.version?` (${result.version})`:''}`);
  if(result.smoke)console.log(`  smoke: ${JSON.stringify(result.smoke)}`);
  if(result.reason)console.log(`  ${result.reason}`);
  for(const w of result.warnings||[])console.log(`  warning: ${w}`);
  if(!result.ok)failures++;
 }
 if(failures)process.exitCode=1;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});