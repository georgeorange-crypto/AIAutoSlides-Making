import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {defineToolAdapter} from './protocol.mjs';

const root=path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const defaultBinary=path.join(root,'workers','d2','.tools','0.9.0','bin',process.platform==='win32'?'d2.exe':'d2');
const binary=process.env.AI4SLIDES_D2_BIN||defaultBinary;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const MAX_SPEC_BYTES=1024*1024,MAX_EVIDENCE_BYTES=1024*1024,MAX_OUTPUT_BYTES=20*1024*1024;

function run(args,{cwd=root,timeout=60000}={}){const result=spawnSync(binary,args,{cwd,encoding:'utf8',timeout,maxBuffer:4*1024*1024,windowsHide:true});if(result.error||result.status!==0)throw new Error(result.error?.message||result.stderr||result.stdout||`d2 exited ${result.status}`);return{stdout:result.stdout||'',stderr:result.stderr||''};}
function readJson(file,maxBytes,label){const resolved=path.resolve(file),stat=fs.statSync(resolved);if(!stat.isFile()||!stat.size||stat.size>maxBytes)throw new Error(`${label} must be a regular file from 1 byte to ${maxBytes} bytes.`);const bytes=fs.readFileSync(resolved);return{path:resolved,bytes,value:JSON.parse(bytes.toString('utf8'))};}
function sourceMap(ledger){if(Array.isArray(ledger?.entries))return new Map(ledger.entries.filter(item=>typeof item?.id==='string').map(item=>[item.id,item]));if(Array.isArray(ledger?.sources))return new Map(ledger.sources.filter(item=>typeof item?.source_id==='string').map(item=>[item.source_id,{...item,id:item.source_id,verified:item.verification_status==='verified'}]));return new Map();}
function validate(spec,sources){
 if(!spec||typeof spec!=='object'||Array.isArray(spec))throw new Error('D2 figure spec must be a JSON object.');
 const keys=new Set(['schema_version','title','dsl','source_ids']);for(const key of Object.keys(spec))if(!keys.has(key))throw new Error(`Unsupported D2 spec property: ${key}`);
 if(spec.schema_version!=='1.0.0'||typeof spec.title!=='string'||!spec.title.trim()||spec.title.length>160)throw new Error('D2 spec requires schema_version 1.0.0 and a 1–160 character title.');
 if(typeof spec.dsl!=='string'||!spec.dsl.trim()||Buffer.byteLength(spec.dsl)>512*1024||spec.dsl.split(/\r?\n/).length>1000)throw new Error('D2 DSL must contain 1–512 KiB and at most 1000 lines.');
 if(/(?:https?:\/\/|file:\/\/|data:(?:image|text)\/)/i.test(spec.dsl))throw new Error('D2 external and data URI references are not allowed.');
 if(/(?:^|\s)\.\.\.(?:\s|$)|\b(?:icon|image)\s*:/im.test(spec.dsl))throw new Error('D2 imports and external image/icon directives are not allowed.');
 if(!Array.isArray(spec.source_ids)||spec.source_ids.length<1||spec.source_ids.length>50||spec.source_ids.some(id=>typeof id!=='string'||!sources.has(id)))throw new Error(`Unknown or missing D2 source IDs: ${(spec.source_ids||[]).filter(id=>!sources.has(id)).join(', ')||'(none)'}`);
 if(new Set(spec.source_ids).size!==spec.source_ids.length)throw new Error('D2 source_ids must be unique.');
 return{verification_status:spec.source_ids.every(id=>sources.get(id)?.verified===true)?'verified':'unverified'};
}

export function createD2Adapter({runCommand=run}={}){return defineToolAdapter({
 manifest:{id:'d2',version:'0.9.0',status:'adapter-ready',kind:'diagram',invoke:'isolated D2 CLI',inputs:['bounded-d2-json','evidence-ledger'],outputs:['d2-source','svg','png','diagram-manifest'],needsNetwork:false,needsAuth:false},
 async doctor(){if(!fs.existsSync(binary))return{ok:false,status:'blocked',reason:'D2 is not installed. On Windows run npm run deps:d2; elsewhere install D2 and set AI4SLIDES_D2_BIN.',warnings:[]};try{const result=runCommand(['version'],{timeout:20000});const version=`${result.stdout}${result.stderr}`.trim();if(!version.includes('0.9.0'))throw new Error(`Expected D2 0.9.0, found ${version}`);return{ok:true,status:'available',version:'0.9.0',executable:binary,warnings:['SVG/PNG exports are images in PPTX, not native editable PowerPoint shapes.']};}catch(error){return{ok:false,status:'blocked',reason:`D2 unavailable: ${error.message}`,warnings:[]};}},
 async probeCapabilities(){return{formats:['svg','png'],sourceFormat:'bounded JSON → D2 DSL',editableSource:true,nativePowerPointShapes:false,sourceIds:true,network:false,maxSourceBytes:512*1024,maxLines:1000};},
 async smokeTest(){const doctor=await this.doctor();if(!doctor.ok)return{ok:false,reason:doctor.reason};const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-d2-smoke-'));try{const result=await this.run({inputFile:path.join(root,'examples','open-source-bakeoff','d2-synthetic.json'),evidenceFile:path.join(root,'examples','open-source-bakeoff','synthetic-evidence.json'),outputDir:dir});const svg=fs.readFileSync(path.join(dir,'d2-synthetic.svg'),'utf8'),png=fs.readFileSync(path.join(dir,'d2-synthetic.png'));if(!/<svg\b/i.test(svg)||!['API gateway','Request scheduler','Worker pool','request','dispatch'].every(label=>svg.includes(label))||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('D2 fixture did not render the expected labeled SVG graph and PNG.');return{ok:true,version:doctor.version,source_ids:result.manifest.source_ids,verification_status:result.manifest.verification_status,formats:['svg','png'],network:'local-only',editable:'D2 source retained; rendered images are not native PowerPoint shapes'};}finally{fs.rmSync(dir,{recursive:true,force:true});}},
 async run({inputFile,evidenceFile,outputDir,timeoutMs=60000}={}){
  if(!inputFile||!evidenceFile||!outputDir)throw new TypeError('D2 run() requires inputFile, evidenceFile, and outputDir.');if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw new Error('timeoutMs must be an integer from 1000 to 120000.');
  const input=readJson(inputFile,MAX_SPEC_BYTES,'D2 spec'),ledger=readJson(evidenceFile,MAX_EVIDENCE_BYTES,'Evidence ledger'),sources=sourceMap(ledger.value),state=validate(input.value,sources),doctor=await this.doctor();if(!doctor.ok)throw new Error(doctor.reason);
  const out=path.resolve(outputDir);if(fs.existsSync(out)&&(!fs.statSync(out).isDirectory()||fs.readdirSync(out).length))throw new Error('D2 output must be absent or an empty directory; refusing to overwrite.');
  const stem=path.basename(input.path,path.extname(input.path)),expected=['d2','svg','png','diagram.json'].map(ext=>path.join(out,`${stem}.${ext}`));if(expected.some(file=>fs.existsSync(file)))throw new Error('D2 output already exists; refusing to overwrite.');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-d2-'));try{const dslPath=path.join(temp,`${stem}.d2`);fs.writeFileSync(dslPath,input.value.dsl);fs.mkdirSync(out,{recursive:true});const dslBytes=fs.readFileSync(dslPath);fs.writeFileSync(expected[0],dslBytes,{flag:'wx'});
   for(const [format,target] of [['svg',expected[1]],['png',expected[2]]]){runCommand([dslPath,target],{cwd:temp,timeout:timeoutMs});const stat=fs.statSync(target);if(!stat.isFile()||!stat.size||stat.size>MAX_OUTPUT_BYTES)throw new Error(`D2 ${format} output must be from 1 byte to ${MAX_OUTPUT_BYTES} bytes.`);const bytes=fs.readFileSync(target);if(format==='svg'){const svg=bytes.toString('utf8');if(!/<svg\b/i.test(svg)||/<script\b|(?:href|src)\s*=\s*["']\s*(?:https?:|file:|data:|\/\/)/i.test(svg))throw new Error('D2 SVG is malformed or contains an active/external reference.');}else if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('D2 did not return a PNG image.');}
   const artifacts=expected.slice(0,3).map((file,index)=>{const bytes=fs.readFileSync(file);return{path:file,media_type:['text/vnd.d2','image/svg+xml','image/png'][index],bytes:bytes.length,sha256:sha256(bytes)};});const manifest={schema_version:'1.0.0',tool:{id:'d2',version:doctor.version},input:{path:path.basename(input.path),sha256:sha256(input.bytes),bytes:input.bytes.length},evidence:{path:path.basename(ledger.path),sha256:sha256(ledger.bytes)},source_ids:input.value.source_ids,verification_status:state.verification_status,formats:['svg','png'],artifacts,warnings:['D2 labels and structure remain source material; evidence IDs require human verification.','SVG/PNG output is not native editable PowerPoint geometry.']};const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(expected[3],bytes,{flag:'wx'});artifacts.push({path:expected[3],media_type:'application/json',bytes:bytes.length,sha256:sha256(bytes)});return{ok:true,manifest,artifacts,warnings:manifest.warnings};
  }catch(error){for(const file of expected)if(fs.existsSync(file))fs.rmSync(file,{force:true});throw error;}finally{fs.rmSync(temp,{recursive:true,force:true});}
 }
});}

export const d2Adapter=createD2Adapter();
