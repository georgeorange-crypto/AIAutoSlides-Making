#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pymupdfAdapter} from '../packages/adapters/pymupdf.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function options(args){const result={input:path.join(root,'examples','research-workflow','fixtures','synthetic-paper.pdf'),out:path.join(root,'outputs','pymupdf-synthetic'),evidenceId:'E_PYMUPDF_LOCAL',previewPages:'0'};for(let i=0;i<args.length;i++){const key=args[i];if(!['--input','--out','--evidence-id','--preview-pages'].includes(key)||!args[i+1])throw new Error(`Unknown or missing option value: ${key}`);const name={'--input':'input','--out':'out','--evidence-id':'evidenceId','--preview-pages':'previewPages'}[key];result[name]=args[++i];}return result;}
const config=options(process.argv.slice(2)),input=path.resolve(config.input),out=path.resolve(config.out),previewPages=config.previewPages?config.previewPages.split(',').map(Number):[];
if(!fs.existsSync(input))throw new Error(`Input PDF does not exist: ${input}`);
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'ai4slides-pymupdf-task-'));
try{const taskFile=path.join(temporary,'task.json');fs.writeFileSync(taskFile,JSON.stringify({input:path.basename(input),evidenceId:config.evidenceId,label:`Local PyMuPDF extraction: ${path.basename(input)}`,previewPages}));const result=await pymupdfAdapter.run({inputDir:path.dirname(input),outputDir:out,taskFile});console.log(JSON.stringify({output:out,verification_status:result.manifest.verification_status,source_ids:result.manifest.source_ids,artifacts:result.artifacts.map(item=>({path:path.relative(out,item.path).replaceAll('\\','/'),bytes:item.bytes,sha256:item.sha256})),warnings:result.warnings},null,2));}
finally{fs.rmSync(temporary,{recursive:true,force:true});}
