#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {recordVisualDecision} from './visual-review-state.mjs';

const args=process.argv.slice(2),get=name=>{const i=args.indexOf(`--${name}`);return i<0?null:args[i+1];};
const pptx=path.resolve(get('pptx')||''),reviewer=get('reviewer'),slideId=get('slide'),decision=get('decision'),note=get('note');
if(!get('pptx')||!reviewer||!slideId||!decision||!note){console.error('Usage: node src/visual-review.mjs --pptx <deck.pptx> --reviewer "Name" --slide S01 --decision approve|changes_requested --note "What you checked"');process.exit(2);}
if(!fs.existsSync(pptx))throw new Error(`PPTX not found: ${pptx}`);
const stem=pptx.replace(/\.pptx$/i,''),hash=crypto.createHash('sha256').update(fs.readFileSync(pptx)).digest('hex'),qaPath=`${stem}.qa.json`,previewPath=`${stem}.preview.json`,out=`${stem}.visual-review.json`;
for(const file of [qaPath,previewPath])if(!fs.existsSync(file))throw new Error(`Required visual-review input missing: ${file}`);
const qa=JSON.parse(fs.readFileSync(qaPath,'utf8')),preview=JSON.parse(fs.readFileSync(previewPath,'utf8'));
if(qa.pptx_sha256!==hash||preview.pptx_sha256!==hash||preview.status!=='rendered')throw new Error('QA and current rendered pages must match this exact PPTX SHA-256');
const pages=qa.humanReview?.pages||[];if(!pages.length||preview.pages?.length!==pages.length)throw new Error('Render every slide before recording visual decisions');
for(const page of preview.pages)if(!fs.existsSync(page.path))throw new Error(`Rendered slide image missing: ${page.path}`);
const allowed=pages.map(page=>page.slide_id),current=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{schema_version:1,pptx_sha256:hash,status:'pending',allowed_slide_ids:allowed,slides:[]};
const next=recordVisualDecision(current,{pptx_sha256:hash,slide_id:slideId,decision,reviewer,note});
fs.writeFileSync(out,JSON.stringify(next,null,2)+'\n');
console.log(`Recorded ${slideId}: ${decision}; review ${next.status} (${next.slides.length}/${allowed.length} slides reviewed).`);
