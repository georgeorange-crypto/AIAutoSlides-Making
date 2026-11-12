import fs from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,stat,writeFile,copyFile,readdir,rm} from 'node:fs/promises';
import {defineToolAdapter} from './protocol.mjs';
import {verifyPptxLineage} from './slidev-ir.mjs';

const execFileAsync=promisify(execFile);
const DEFAULT_BIN=process.env.SLIDEV_CLI?process.execPath:(process.platform==='win32'?'slidev.cmd':'slidev');
const FORMATS=new Set(['pptx-editable','pdf','png']);
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function digestPath(target) {
  const info=await stat(target);
  if(info.isFile()) return sha256(await readFile(target));
  const files=[];
  async function visit(dir) {
    for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      const child=path.join(dir,entry.name);
      if(entry.isDirectory()) await visit(child);
      else if(entry.isFile()) files.push({relative:path.relative(target,child).replaceAll('\\','/'),bytes:await readFile(child)});
    }
  }
  await visit(target);
  const hash=createHash('sha256');
  for(const file of files) hash.update(file.relative).update('\0').update(file.bytes).update('\0');
  return hash.digest('hex');
}

async function invoke(binary,args,options={}) {
  const argv=process.env.SLIDEV_CLI&&binary===process.execPath?[process.env.SLIDEV_CLI,...args]:args;
  const {stdout='',stderr=''}=await execFileAsync(binary,argv,{windowsHide:true,maxBuffer:8*1024*1024,...(binary.toLowerCase().endsWith('.cmd')?{shell:true}:{}),...options});
  return `${stdout}${stderr}`.trim();
}

export function createSlidevAdapter({runCommand=invoke}={}) {
  async function checkCli(binary) {
    try {
      const version=await runCommand(binary,['--version']);
      return {ok:true,status:'available',version,warnings:['PPTX export may rasterize Mermaid, SVG, canvas, and other unsupported elements.']};
    } catch(error) {
      return {ok:false,status:'blocked',reason:`Slidev CLI unavailable (${error.message}). Install @slidev/cli in an isolated environment and set SLIDEV_BIN if needed.`,warnings:[]};
    }
  }
  return defineToolAdapter({
    manifest:{id:'slidev',version:'53.x',status:'adapter-ready',kind:'deck-backend',invoke:'cli',inputs:['slidev-markdown'],outputs:['pptx','pdf','png','source-manifest'],needsNetwork:false,needsAuth:false},
    async doctor({binary=process.env.SLIDEV_BIN||DEFAULT_BIN}={}) {return checkCli(binary);},
    async probeCapabilities() {
      return {formats:['pptx-editable','pdf','png'],editableText:true,editableBasicShapes:true,nativeCharts:false,notes:true,sourceSidecar:true,offlineExport:true,importsExistingDecks:false};
    },
    async smokeTest({binary=process.env.SLIDEV_BIN||DEFAULT_BIN}={}) {
      const result=await checkCli(binary);
      return {ok:result.ok,version:result.version||null,reason:result.reason||null};
    },
    async run({inputFile,outputDir,formats=['pptx-editable'],lineageFile=null,binary=process.env.SLIDEV_BIN||DEFAULT_BIN,chromePath=process.env.SLIDEV_CHROME_PATH,projectDir=process.env.SLIDEV_PROJECT_DIR||null,renderTimeoutMs=60000,waitUntil='networkidle'}={}) {
      if(!inputFile||!outputDir) throw new TypeError('Slidev adapter needs inputFile and outputDir');
      const input=path.resolve(inputFile),out=path.resolve(outputDir);
      const projectRoot=projectDir?path.resolve(projectDir):path.dirname(input);
      if(path.extname(input).toLowerCase()!=='.md'||!fs.existsSync(input)) throw new Error('inputFile must be an existing Slidev Markdown file');
      if(!Array.isArray(formats)||formats.length===0||formats.some(format=>!FORMATS.has(format))) throw new Error(`formats must be a non-empty subset of: ${[...FORMATS].join(', ')}`);
      if(!Number.isInteger(renderTimeoutMs)||renderTimeoutMs<1000||renderTimeoutMs>300000) throw new Error('renderTimeoutMs must be an integer from 1000 to 300000');
      if(!['networkidle','load','domcontentloaded','none'].includes(waitUntil)) throw new Error('waitUntil must be networkidle, load, domcontentloaded, or none');
      const uniqueFormats=[...new Set(formats)];
      await mkdir(out,{recursive:true});
      const version=(await runCommand(binary,['--version'])).trim();
      const artifacts=[];
      let lineageSummary=null,lineageData=null;
      if(lineageFile) {
        const target=path.join(out,'slide-lineage.json');
        await copyFile(path.resolve(lineageFile),target);
        const bytes=await readFile(target);
        lineageData=JSON.parse(bytes.toString('utf8'));
        artifacts.push({kind:'source-manifest',path:target,sha256:sha256(bytes)});
        lineageSummary={slide_count:lineageData.slides?.length||0,sources:(lineageData.sources||[]).map(source=>({source_id:source.source_id,verification_status:source.verification_status||'unknown'}))};
      }
      for(const format of uniqueFormats) {
        const output=format==='png'?path.join(out,'slidev-png'):path.join(out,`presentation.${format==='pptx-editable'?'pptx':format}`);
        if(format==='png') await rm(output,{recursive:true,force:true});
        const args=['export',input,'--format',format,'--output',output];
        if(format==='pptx-editable') args.push('--with-clicks','false');
        args.push('--timeout',String(renderTimeoutMs),'--wait-until',waitUntil);
        if(chromePath) args.push('--executable-path',chromePath);
        await runCommand(binary,args,{cwd:projectRoot});
        const info=await stat(output).catch(()=>null);
        if(!info) throw new Error(`Slidev reported success but did not create ${output}`);
        artifacts.push({kind:format==='pptx-editable'?'pptx':format,path:output,sha256:await digestPath(output)});
        if(format==='pptx-editable'&&lineageData) {
          const validation=verifyPptxLineage(await readFile(output),lineageData);
          const validationPath=path.join(out,'lineage-validation.json');
          await writeFile(validationPath,JSON.stringify(validation,null,2)+'\n');
          artifacts.push({kind:'lineage-validation',path:validationPath,sha256:sha256(await readFile(validationPath))});
        }
      }
      const manifestPath=path.join(out,'slidev-backend-manifest.json');
      const warnings=['Slidev export does not create native PowerPoint chart objects. Complex DOM/SVG content may be rasterized.'];
      for(const source of lineageSummary?.sources||[]) if(['unverified','pending','contradicted'].includes(source.verification_status)) warnings.push(`Source ${source.source_id} remains ${source.verification_status}; export does not upgrade verification status.`);
      const manifest={adapter:'slidev',backend_version:version,render:{project_root:path.basename(projectRoot),timeout_ms:renderTimeoutMs,wait_until:waitUntil},input:{path:path.basename(input),sha256:sha256(await readFile(input))},lineage:lineageSummary,artifacts,warnings};
      await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
      artifacts.push({kind:'source-manifest',path:manifestPath,sha256:sha256(await readFile(manifestPath))});
      return {artifacts,warnings:manifest.warnings,backendVersion:version};
    }
  });
}

export const slidevAdapter=createSlidevAdapter();
