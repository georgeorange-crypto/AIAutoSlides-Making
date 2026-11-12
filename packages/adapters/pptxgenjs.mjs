import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {unzipSync} from 'fflate';
import PptxGenJS from 'pptxgenjs';
import {defineToolAdapter} from './protocol.mjs';

const require = createRequire(import.meta.url);
export const pptxgenjsAdapter = defineToolAdapter({
  manifest: {id:'pptxgenjs', version:'4.0.0+', status:'adapter-ready', kind:'deck-backend', invoke:'library', inputs:['json'], outputs:['pptx'], needsNetwork:false, needsAuth:false},
  async doctor() {
    try { let dir=require.resolve('pptxgenjs'); let file; while(dir!==path.dirname(dir)){dir=path.dirname(dir);const candidate=path.join(dir,'package.json');if(fs.existsSync(candidate)){const pkg=JSON.parse(fs.readFileSync(candidate,'utf8'));if(pkg.name==='pptxgenjs'){file=candidate;break;}}} if(!file)throw new Error('package metadata not found'); const pkg=JSON.parse(fs.readFileSync(file,'utf8')); return {ok:true, status:'available', version:pkg.version, warnings:[]}; }
    catch { return {ok:false, status:'blocked', reason:'Install project dependencies with npm ci to enable the existing PptxGenJS backend.', warnings:[]}; }
  },
  async probeCapabilities() { return {nativeEditablePptx:true, nativeCharts:true, legacyCliPreserved:true}; },
  async smokeTest() {
    const dir=await mkdtemp(path.join(os.tmpdir(),'ai4slides-pptxgenjs-'));
    const output=path.join(dir,'smoke.pptx');
    try {
      const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.addSlide().addText('Adapter smoke test',{x:1,y:1,w:5,h:1});
      pptx.addSlide().addChart(pptx.ChartType.bar,[{name:'smoke',labels:['A','B'],values:[1,2]}],{x:1,y:1,w:5,h:3,showLegend:false});
      await pptx.writeFile({fileName:output});
      const bytes=fs.readFileSync(output),parts=unzipSync(new Uint8Array(bytes));
      if(!parts['ppt/slides/slide1.xml']||!parts['ppt/slides/slide2.xml']||!Object.keys(parts).some(k=>/^ppt\/charts\/chart\d+\.xml$/.test(k)))throw new Error('PPTX is missing expected slides or native chart part');
      return {ok:true,artifact_bytes:(await stat(output)).size,native_chart:true,cleaned_up:true};
    } finally {await rm(dir,{recursive:true,force:true});}
  },
  async run() { throw new Error('Use the validated legacy build command; raw IR invocation is not implemented yet.'); }
});
