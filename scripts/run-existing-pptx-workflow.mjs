import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),args=process.argv.slice(2),get=name=>{const i=args.indexOf(`--${name}`);return i<0?null:args[i+1];};
if(args.includes('--help')||!get('input')||!get('request')||!get('out')){console.log('Usage: node scripts/run-existing-pptx-workflow.mjs --input source.pptx --request edits.json --out revised.pptx [--skip-preview]');process.exitCode=args.includes('--help')?0:2;}
else try{
 const input=path.resolve(get('input')),requestFile=path.resolve(get('request')),out=path.resolve(get('out')),skip=args.includes('--skip-preview');
 if(input===out)throw new Error('Output must be distinct from the immutable input.');
 const run=(script,...extra)=>{const r=spawnSync(process.execPath,[script,...extra],{cwd:root,encoding:'utf8',timeout:180000,windowsHide:true,maxBuffer:8*1024*1024});if(r.error||r.status!==0)throw new Error(`${path.basename(script)} failed: ${r.error?.message||r.stderr||r.stdout}`);return r.stdout.trim();};
 const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const editReport=out.replace(/\.pptx$/i,'.edit-report.json');
 run(path.join(root,'src/qa.mjs'),input);if(!skip)run(path.join(root,'scripts/preview.mjs'),input);
 run(path.join(root,'src/edit-existing-pptx.mjs'),'--input',input,'--request',requestFile,'--out',out);
 run(path.join(root,'src/qa.mjs'),out);if(!skip)run(path.join(root,'scripts/preview.mjs'),out);
 const report=JSON.parse(fs.readFileSync(editReport,'utf8'));
 if(!skip){
  const before=JSON.parse(fs.readFileSync(input.replace(/\.pptx$/i,'.preview.json'),'utf8')),
   after=JSON.parse(fs.readFileSync(out.replace(/\.pptx$/i,'.preview.json'),'utf8')),
   untouched=Array.from({length:report.slide_count},(_,i)=>i+1).filter(n=>!report.edited_slides.includes(n)),comparisons=untouched.map(slide=>{
    const a=before.pages.find(p=>p.slide===slide),b=after.pages.find(p=>p.slide===slide);
    return{slide,before_sha256:a?.sha256??null,after_sha256:b?.sha256??null,identical:Boolean(a&&b&&a.sha256===b.sha256)};
   });
  if(before.pages.length!==report.slide_count||after.pages.length!==report.slide_count)throw new Error(`Preview page count mismatch: expected ${report.slide_count} before and after.`);
  report.visual_comparison={before_renderer:before.renderer_used,before_renderer_version:before.renderer_version,after_renderer:after.renderer_used,after_renderer_version:after.renderer_version,untouched_pages:comparisons,all_untouched_pages_identical:comparisons.every(x=>x.identical)};
  if(!report.visual_comparison.all_untouched_pages_identical)throw new Error('An untouched slide rendered differently; inspect the before/after PNGs.');
 }
 report.qa={before_status:JSON.parse(fs.readFileSync(input.replace(/\.pptx$/i,'.qa.json'),'utf8')).status,after_status:JSON.parse(fs.readFileSync(out.replace(/\.pptx$/i,'.qa.json'),'utf8')).status};
 fs.writeFileSync(editReport,JSON.stringify(report,null,2)+'\n');
 console.log(`Existing-deck workflow complete; edited slides ${report.edited_slides.join(', ')}; source hash unchanged: ${digest(input)===report.source.sha256}.`);
 console.log(`PPTX: ${out}`);console.log(`Edit report: ${editReport}`);if(skip)console.log('Previews skipped; use without --skip-preview for before/after visual comparison.');
}catch(error){console.error(`[existing PPTX workflow failed] ${error.message}`);process.exitCode=1;}
