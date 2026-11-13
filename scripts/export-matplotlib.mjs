#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import PptxGenJS from 'pptxgenjs';
import {matplotlibAdapter} from '../packages/adapters/matplotlib.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2);
function option(name,fallback){const index=args.indexOf(`--${name}`);return index<0?fallback:(args[index+1]??null);}
function inside(child,parent){const relative=path.relative(parent,child);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));}
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
  const input=path.resolve(root,option('input','examples/open-source-bakeoff/matplotlib-synthetic.json'));
  const evidence=path.resolve(root,option('evidence','examples/open-source-bakeoff/synthetic-evidence.json'));
  const outputDir=path.resolve(root,option('out','outputs/matplotlib-synthetic'));
  if(!inside(outputDir,path.join(root,'outputs')))throw new Error('--out must remain under repository outputs/.');
  if(fs.existsSync(path.join(outputDir,'matplotlib-synthetic.pptx')))throw new Error('PPTX output already exists; refusing to overwrite.');
  const rendered=await matplotlibAdapter.run({inputFile:input,evidenceFile:evidence,outputDir});
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='AIAutoSlides local Matplotlib adapter';pptx.subject='Synthetic Matplotlib figure backend smoke test';pptx.title='Synthetic Matplotlib Figure';pptx.company='AIAutoSlides';pptx.lang='en-US';
  const slide=pptx.addSlide();slide.background={color:'F8FAFC'};
  slide.addText('SYNTHETIC FIXTURE · NOT MEASURED PERFORMANCE',{x:0.68,y:0.44,w:12,h:0.25,fontFace:'Aptos',fontSize:10,bold:true,color:'B91C1C',margin:0,charSpacing:1.2});
  slide.addImage({path:path.join(outputDir,'figure.svg'),x:0.55,y:0.82,w:12.2,h:6.1,altText:'Matplotlib vector figure using the exact synthetic values in the fixture JSON.'});
  slide.addText(`Evidence: ${rendered.manifest.source_ids.join(', ')} · verification: ${rendered.manifest.verification_status}`,{x:0.68,y:7.12,w:12,h:0.18,fontFace:'Aptos',fontSize:8,color:'475569',margin:0});
  slide.addNotes(`Synthetic fixture only; do not report as a measured result.\nSource IDs: ${rendered.manifest.source_ids.join(', ')}\nEvidence file: ${rendered.manifest.lineage.evidence_file}\nInput SHA-256: ${rendered.manifest.input.sha256}\nMatplotlib figure SHA-256: ${rendered.manifest.artifacts.find(item=>item.path==='figure.svg').sha256}\nValues were plotted without a data transformation.`);
  const deckPath=path.join(outputDir,'matplotlib-synthetic.pptx');await pptx.writeFile({fileName:deckPath});
  const deckBytes=fs.readFileSync(deckPath);
  const report={schema_version:'1.0.0',tool:'matplotlib',figure_id:rendered.manifest.figure_id,source_ids:rendered.manifest.source_ids,verification_status:rendered.manifest.verification_status,figure_manifest:'figure-manifest.json',pptx:{path:path.basename(deckPath),sha256:sha256(deckBytes),bytes:deckBytes.length,editability:'title and status text are native text; figure is an SVG picture object, not a native PowerPoint chart'},warnings:rendered.warnings};
  fs.writeFileSync(path.join(outputDir,'matplotlib-presentation-manifest.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({figure_artifacts:rendered.artifacts,deck:{path:deckPath,sha256:report.pptx.sha256,bytes:report.pptx.bytes},warnings:report.warnings},null,2));
}catch(error){console.error(`[matplotlib export] ${error.message}`);process.exitCode=1;}
