import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {definePresentationAdapter} from './protocol.mjs';
import {slidevAdapter} from './slidev.mjs';

const execFileAsync=promisify(execFile);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const hashFile=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const within=(root,file)=>{const relative=path.relative(root,file);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));};

export const slidevPresentationAdapter=definePresentationAdapter({
  manifest:{id:'slidev-ir',version:'53.x',status:'adapter-ready',kind:'deck-backend',capabilities:['presentation-ir-1.0.0','pptx-export','pdf-preview','png-preview','source-lineage'],platforms:['windows','linux','macos'],inputs:['presentation-ir-1.0.0'],outputs:['pptx','lineage-manifest'],locality:'local',needsNetwork:false,needsAuth:false,canEdit:true,canNativeCharts:false,dependencies:['Slidev CLI 53.x'],terms:'MIT project code; verify runtime and transitive dependencies for distribution'},
  async doctor(){return slidevAdapter.doctor();},
  async probe(){const result=await this.doctor();return{status:result.ok?'available':'blocked',version:result.version,reason:result.reason};},
  async probeCapabilities(){return{formats:['pptx'],editableObjects:['text','basic-shapes'],nativeCharts:false,localOnly:true,sourceLineage:true};},
  async capabilities(){return this.probeCapabilities();},
  async render({presentationIR,workspace,outputDir}){
    const result=await slidevAdapter.runIR({presentationIR,inputDir:workspace,outputDir,formats:['pptx-editable']});
    const pptx=result.artifacts.find(item=>item.kind==='pptx');
    const lineage=result.artifacts.find(item=>item.kind==='lineage-validation');
    if(!pptx||!lineage)throw new Error('Slidev export did not produce a PPTX with lineage validation.');
    const validation=JSON.parse(fs.readFileSync(lineage.path,'utf8'));
    if(validation.status!=='passed'||validation.slide_count!==presentationIR.slides.length)throw new Error('Slidev output failed slide lineage validation.');
    const qaPath=pptx.path.replace(/\.pptx$/i,'.qa.json');
    await execFileAsync(process.execPath,[path.join(root,'src','qa.mjs'),pptx.path],{cwd:root,windowsHide:true,timeout:120000,maxBuffer:4*1024*1024});
    const qa=JSON.parse(fs.readFileSync(qaPath,'utf8'));
    if(qa.errors.length||qa.slideCount!==presentationIR.slides.length||qa.editableTextSlideCount===0)throw new Error(`Slidev PPTX failed structural QA: ${qa.errors.join('; ')||'no editable slide text'}`);
    const warnings=[...result.warnings,'Fallback backend: Slidev does not create native PowerPoint charts; some complex objects may be rasterized.'];
    const artifacts=result.artifacts.map(item=>({path:item.path,format:item.kind==='pptx'?'pptx':path.extname(item.path).slice(1),sha256:item.sha256,editable:item.kind==='pptx'?'partial':'not-applicable'}));
    artifacts.push({path:qaPath,format:'json',sha256:hashFile(qaPath),editable:'not-applicable'});
    return{status:'completed',adapter:'slidev-ir',backendVersion:result.backendVersion,slideCount:presentationIR.slides.length,slideEditability:[],qa:{status:'warning',errors:[],warnings,chartValuesExact:false,lineageStatus:'passed',structuralQaPath:qaPath},artifacts,warnings};
  },
  async export({artifacts,workspace,outputDir}){
    const root=path.resolve(workspace),out=path.resolve(outputDir);if(!within(root,out))throw new Error('Slidev export output must stay inside workspace.');await mkdir(out,{recursive:true});
    const copied=[];for(const item of artifacts){const source=path.resolve(item.path);if(!within(root,source)||!fs.existsSync(source)||!fs.statSync(source).isFile())throw new Error('Export source must be a file inside workspace.');const target=path.join(out,path.basename(source));if(fs.existsSync(target))throw new Error(`Refusing to overwrite export '${path.basename(target)}'.`);fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);copied.push({path:target,format:item.format,sha256:hashFile(target),editable:item.editable||'not-applicable'});}return{status:'completed',artifacts:copied};
  }
});
