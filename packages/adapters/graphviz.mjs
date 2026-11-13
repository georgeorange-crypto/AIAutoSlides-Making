import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {defineToolAdapter} from './protocol.mjs';

const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const worker=path.join(root,'workers','graphviz');
const defaultDot=path.join(worker,'.tools','16.1.1','bin',process.platform==='win32'?'dot.exe':'dot');
const dot=process.env.AI4SLIDES_GRAPHVIZ_DOT||defaultDot;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_SPEC_BYTES=256*1024,MAX_EVIDENCE_BYTES=1024*1024,MAX_OUTPUT_BYTES=20*1024*1024;
const NODE_SHAPES=new Set(['box','ellipse','diamond','hexagon','cylinder','note','component','folder']);
const EDGE_STYLES=new Set(['solid','dashed','dotted','bold']);
const ARROWHEADS=new Set(['normal','vee','none','diamond']);
const LAYOUTS=new Set(['dot','neato','fdp','sfdp','circo','twopi']);
const RANKDIRS=new Set(['TB','LR','BT','RL']);

function run(args,{timeout=60000}={}){
 const result=spawnSync(dot,args,{cwd:root,encoding:'utf8',timeout,maxBuffer:2*1024*1024,windowsHide:true});
 if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||result.stdout||`dot exited with ${result.status}`);
 return{stdout:result.stdout||'',stderr:result.stderr||''};
}
function boundedJson(file,maxBytes,label){const resolved=path.resolve(file),info=fs.statSync(resolved);if(!info.isFile()||!info.size||info.size>maxBytes)throw new Error(`${label} must be a regular file from 1 byte to ${maxBytes} bytes.`);const bytes=fs.readFileSync(resolved);return{path:resolved,bytes,value:JSON.parse(bytes.toString('utf8'))};}
function quote(value){return `"${value.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\r',' ').replaceAll('\n','\\n')}"`;}
function color(value,name){if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error(`${name} must be a six-digit hex color.`);return quote(value);}
function validateSpec(spec,knownSources){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))throw new Error('Graphviz figure spec must be a JSON object.');
 const keys=new Set(['schema_version','directed','layout','rankdir','title','nodes','edges','source_ids']);for(const key of Object.keys(spec))if(!keys.has(key))throw new Error(`Unsupported Graphviz spec property: ${key}`);
 if(spec.schema_version!=='1.0.0')throw new Error('Graphviz spec schema_version must be 1.0.0.');
 if(typeof spec.directed!=='boolean')throw new Error('Graphviz spec requires directed=true or false.');
 if(spec.layout!==undefined&&!LAYOUTS.has(spec.layout))throw new Error(`layout must be one of ${[...LAYOUTS].join(', ')}.`);
 if(spec.rankdir!==undefined&&!RANKDIRS.has(spec.rankdir))throw new Error(`rankdir must be one of ${[...RANKDIRS].join(', ')}.`);
 for(const [value,label,max] of [[spec.title||'Synthetic architecture', 'title',160]])if(typeof value!=='string'||value.length>max)throw new Error(`${label} must be a string of at most ${max} characters.`);
 if(!Array.isArray(spec.nodes)||spec.nodes.length<1||spec.nodes.length>200)throw new Error('nodes must contain 1 to 200 entries.');
 if(!Array.isArray(spec.edges)||spec.edges.length>500)throw new Error('edges must contain at most 500 entries.');
 const ids=new Set();for(const node of spec.nodes){if(!node||typeof node!=='object'||Array.isArray(node)||Object.keys(node).some(key=>!['id','label','shape','fill'].includes(key)))throw new Error('Each node may contain only id, label, shape, and fill.');if(typeof node.id!=='string'||!/^[-A-Za-z_][-A-Za-z0-9_]{0,63}$/.test(node.id)||ids.has(node.id))throw new Error(`Invalid or duplicate Graphviz node id: ${node.id}`);ids.add(node.id);if(typeof node.label!=='string'||!node.label.trim()||node.label.length>200)throw new Error(`Node ${node.id} label must contain 1 to 200 characters.`);if(node.shape!==undefined&&!NODE_SHAPES.has(node.shape))throw new Error(`Node ${node.id} uses an unsupported shape.`);if(node.fill!==undefined)color(node.fill,`Node ${node.id} fill`);}
 for(const edge of spec.edges){if(!edge||typeof edge!=='object'||Array.isArray(edge)||Object.keys(edge).some(key=>!['from','to','label','style','arrowhead','color'].includes(key)))throw new Error('Each edge may contain only from, to, label, style, arrowhead, and color.');if(!ids.has(edge.from)||!ids.has(edge.to))throw new Error(`Graphviz edge references unknown node: ${edge.from} -> ${edge.to}`);if(edge.label!==undefined&&(typeof edge.label!=='string'||edge.label.length>200))throw new Error('Edge labels must be strings of at most 200 characters.');if(edge.style!==undefined&&!EDGE_STYLES.has(edge.style))throw new Error('Unsupported Graphviz edge style.');if(edge.arrowhead!==undefined&&!ARROWHEADS.has(edge.arrowhead))throw new Error('Unsupported Graphviz arrowhead.');if(edge.color!==undefined)color(edge.color,'Edge color');}
 if(!Array.isArray(spec.source_ids)||!spec.source_ids.length||spec.source_ids.length>50||spec.source_ids.some(id=>typeof id!=='string'||!knownSources.has(id)))throw new Error(`Unknown or missing Graphviz source IDs: ${(spec.source_ids||[]).filter(id=>!knownSources.has(id)).join(', ')||'(none)'}`);
 if(new Set(spec.source_ids).size!==spec.source_ids.length)throw new Error('Graphviz source_ids must be unique.');
 return{nodeIds:[...ids],layout:spec.layout||'dot',rankdir:spec.rankdir||'LR'};
}
function toDot(spec,{layout,rankdir}){
 const graph=spec.directed?'digraph':'graph',connector=spec.directed?'->':'--',lines=[`${graph} G {`,`  graph [rankdir=${rankdir}, bgcolor="#ffffff", label=${quote(spec.title||'Synthetic architecture')}, labelloc=t];`,'  node [fontname="Arial", style=filled, color="#334155", fontcolor="#0f172a"];','  edge [fontname="Arial", color="#475569", arrowsize=0.7];'];
 for(const node of spec.nodes){const attrs=[`label=${quote(node.label)}`,`shape=${node.shape||'box'}`,`fillcolor=${color(node.fill||'#e2e8f0',`Node ${node.id} fill`)}`];lines.push(`  ${quote(node.id)} [${attrs.join(', ')}];`);}
 for(const edge of spec.edges){const attrs=[];if(edge.label!==undefined)attrs.push(`label=${quote(edge.label)}`);if(edge.style)attrs.push(`style=${edge.style}`);if(edge.arrowhead)attrs.push(`arrowhead=${edge.arrowhead}`);if(edge.color)attrs.push(`color=${color(edge.color,'Edge color')}`);lines.push(`  ${quote(edge.from)} ${connector} ${quote(edge.to)}${attrs.length?` [${attrs.join(', ')}]`:''};`);}
 lines.push('}');return`${lines.join('\n')}\n`;
}
function ledgerSources(ledger){if(Array.isArray(ledger?.entries))return new Map(ledger.entries.filter(x=>typeof x?.id==='string').map(x=>[x.id,x]));if(Array.isArray(ledger?.sources))return new Map(ledger.sources.filter(x=>typeof x?.source_id==='string').map(x=>[x.source_id,{...x,id:x.source_id,verified:x.verification_status==='verified'}]));return new Map();}

export function createGraphvizAdapter({runCommand=run}={}){
 return defineToolAdapter({
  manifest:{id:'graphviz',version:'16.1.1',status:'adapter-ready',kind:'diagram',invoke:'isolated Graphviz dot CLI',inputs:['validated-graph-json','evidence-ledger'],outputs:['dot-source','svg','png','diagram-manifest'],needsNetwork:false,needsAuth:false},
  async doctor(){if(!fs.existsSync(dot))return{ok:false,status:'blocked',reason:'Graphviz dot is not installed. On Windows run npm run deps:graphviz; otherwise install Graphviz and set AI4SLIDES_GRAPHVIZ_DOT.',warnings:[]};try{const result=runCommand(['-V'],{timeout:60000});const version=`${result.stdout}${result.stderr}`.trim();if(!version.includes('16.1.1'))throw new Error(`Expected Graphviz 16.1.1, found ${version}`);return{ok:true,status:'available',version:'16.1.1',executable:dot,warnings:['SVG/PNG exports are images in PPTX, not native editable PowerPoint shapes.']};}catch(error){return{ok:false,status:'blocked',reason:`Graphviz dot unavailable: ${error.message}`,warnings:[]};}},
  async probeCapabilities(){return{formats:['svg','png'],sourceFormat:'validated JSON → generated DOT',editableSource:true,nativePowerPointShapes:false,sourceIds:true,network:false,maxNodes:200,maxEdges:500};},
  async smokeTest(){const doctor=await this.doctor();if(!doctor.ok)return{ok:false,reason:doctor.reason};const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-graphviz-smoke-'));try{const input=path.join(root,'examples','open-source-bakeoff','graphviz-synthetic.json'),ledger=path.join(root,'examples','open-source-bakeoff','synthetic-evidence.json'),result=await this.run({inputFile:input,evidenceFile:ledger,outputDir:dir});const svg=fs.readFileSync(path.join(dir,'graphviz-synthetic.svg'),'utf8'),png=fs.readFileSync(path.join(dir,'graphviz-synthetic.png'));if(!svg.includes('<svg')||!svg.includes('Gateway')||!svg.includes('Worker')||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Graphviz fixture did not render the expected SVG graph and PNG.');return{ok:true,version:doctor.version,nodes:result.manifest.node_count,edges:result.manifest.edge_count,source_ids:result.manifest.source_ids,verification_status:result.manifest.verification_status,formats:['svg','png'],network:'local-only',editable:'DOT source retained; rendered images are not native PowerPoint shapes'};}finally{fs.rmSync(dir,{recursive:true,force:true});}},
  async run({inputFile,evidenceFile,outputDir,timeoutMs=60000}={}){
   if(!inputFile||!evidenceFile||!outputDir)throw new TypeError('Graphviz run() requires inputFile, evidenceFile, and outputDir.');
   if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw new Error('timeoutMs must be an integer from 1000 to 120000.');
   const specFile=boundedJson(inputFile,MAX_SPEC_BYTES,'Graphviz spec'),evidenceFileRecord=boundedJson(evidenceFile,MAX_EVIDENCE_BYTES,'Evidence ledger'),sources=ledgerSources(evidenceFileRecord.value),validated=validateSpec(specFile.value,new Set(sources.keys()));
   const doctor=await this.doctor();if(!doctor.ok)throw new Error(doctor.reason);
   const out=path.resolve(outputDir);if(fs.existsSync(out)&&(!fs.statSync(out).isDirectory()||fs.readdirSync(out).length))throw new Error('Graphviz output must be absent or an empty directory; refusing to overwrite.');
   const stem=path.basename(specFile.path,path.extname(specFile.path)),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-graphviz-')),dotFile=path.join(temp,`${stem}.dot`),dotText=toDot(specFile.value,validated),artifacts=[];
   const expected=[path.join(out,`${stem}.dot`),path.join(out,`${stem}.svg`),path.join(out,`${stem}.png`),path.join(out,`${stem}.diagram.json`)];if(expected.some(file=>fs.existsSync(file)))throw new Error('Graphviz output already exists; refusing to overwrite.');
   try{
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(dotFile,dotText);const dotBytes=Buffer.from(dotText,'utf8'),dotOut=expected[0];fs.writeFileSync(dotOut,dotBytes);artifacts.push({path:dotOut,media_type:'text/vnd.graphviz',bytes:dotBytes.length,sha256:sha256(dotBytes)});
    for(const [format,target] of [['svg',expected[1]],['png',expected[2]]]){runCommand([`-K${validated.layout}`,`-T${format}`,dotFile,'-o',target],{timeout:timeoutMs});const info=fs.statSync(target);if(!info.isFile()||!info.size||info.size>MAX_OUTPUT_BYTES)throw new Error(`Graphviz ${format} output must be from 1 byte to ${MAX_OUTPUT_BYTES} bytes.`);const bytes=fs.readFileSync(target);if(format==='svg'){const svg=bytes.toString('utf8');if(!/<svg\b/i.test(svg)||/<script\b|(?:href|src)\s*=\s*["']\s*(?:https?:|file:|data:|\/\/)/i.test(svg))throw new Error('Graphviz SVG is malformed or contains an external/active reference.');}else if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){throw new Error('Graphviz did not return a PNG image.');}artifacts.push({path:target,media_type:format==='svg'?'image/svg+xml':'image/png',bytes:bytes.length,sha256:sha256(bytes)});}
    const sourceIds=specFile.value.source_ids,verificationStatus=sourceIds.every(id=>sources.get(id)?.verified===true)?'verified':'unverified';
    const manifest={schema_version:'1.0.0',tool:{id:'graphviz',version:doctor.version,layout:validated.layout},input:{path:path.basename(specFile.path),sha256:sha256(specFile.bytes),bytes:specFile.bytes.length},generated_dot:{path:path.basename(dotOut),sha256:sha256(dotBytes)},evidence:{path:path.basename(evidenceFileRecord.path),sha256:sha256(evidenceFileRecord.bytes)},source_ids:sourceIds,verification_status:verificationStatus,node_count:specFile.value.nodes.length,edge_count:specFile.value.edges.length,formats:['svg','png'],artifacts,warnings:['Diagram labels and structure are source material; evidence IDs remain subject to human verification.','SVG/PNG output is not native editable PowerPoint geometry.']};
    const manifestBytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(expected[3],manifestBytes,{flag:'wx'});artifacts.push({path:expected[3],media_type:'application/json',bytes:manifestBytes.length,sha256:sha256(manifestBytes)});return{ok:true,manifest,artifacts,warnings:manifest.warnings};
   }catch(error){for(const file of expected)if(fs.existsSync(file))fs.rmSync(file,{force:true});throw error;}finally{fs.rmSync(temp,{recursive:true,force:true});}
  }
 });
}

export const graphvizAdapter=createGraphvizAdapter();
