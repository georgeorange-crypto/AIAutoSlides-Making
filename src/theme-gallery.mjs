#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadEvidence,validateDeck} from './validate.mjs';

const argv=process.argv.slice(2),arg=(name,fallback)=>{const i=argv.indexOf(`--${name}`);return i<0?fallback:argv[i+1];};
const input=arg('input',null),evidencePath=arg('evidence','sources/evidence.json'),outDir=arg('out','outputs/theme-gallery'),themes=['academic-light','tech-dark','keynote-minimal'];
if(!input){console.log('Usage: node src/theme-gallery.mjs --input storyboard.json [--evidence evidence.json] [--out outputs/theme-gallery]');process.exit(process.argv.includes('--help')?0:2);}
const run=args=>{const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error(`${args.join(' ')} failed (${r.status}): ${r.stderr||r.stdout}`);return r.stdout.trim();};
try{
 const raw=JSON.parse(fs.readFileSync(path.resolve(input),'utf8')),ledger=loadEvidence(path.resolve(evidencePath)),checked=validateDeck(raw,ledger);if(checked.errors.length)throw new Error(`Input storyboard invalid: ${checked.errors.join('; ')}`);
 const chart=checked.deck.slides.find(s=>s.type==='chart'),cover=checked.deck.slides.find(s=>s.type==='cover'),representative=cover&&chart?[cover,chart]:[checked.deck.slides[0],checked.deck.slides.find(s=>s!==checked.deck.slides[0])].filter(Boolean),previewDeck={...checked.deck,meta:{...checked.deck.meta,title:`Theme preview · ${checked.deck.meta.title}`},slides:representative};
 const dir=path.resolve(outDir);fs.mkdirSync(dir,{recursive:true});const inputHash=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(input))).digest('hex'),results=[];
 for(const theme of themes){const prefix=path.join(dir,theme),jsonPath=`${prefix}.storyboard.json`,pptx=`${prefix}.pptx`;fs.writeFileSync(jsonPath,JSON.stringify(previewDeck,null,2)+'\n');run(['src/cli.mjs','build','--input',jsonPath,'--evidence',path.resolve(evidencePath),'--theme',theme,'--out',pptx]);run(['scripts/preview.mjs',pptx]);results.push({id:theme,tokens:JSON.parse(fs.readFileSync(path.join('themes',`${theme}.json`),'utf8')),pptx:path.relative(process.cwd(),pptx).replaceAll('\\','/'),preview:path.relative(process.cwd(),`${prefix}-page-1.png`).replaceAll('\\','/'),chart_preview:path.relative(process.cwd(),`${prefix}-page-2.png`).replaceAll('\\','/'),rendered:fs.existsSync(`${prefix}-page-1.png`)&&fs.existsSync(`${prefix}-page-2.png`)});}
 const report={schema_version:1,generated_at:new Date().toISOString(),source_storyboard:path.relative(process.cwd(),path.resolve(input)).replaceAll('\\','/'),source_storyboard_sha256:inputHash,themes:results,selection_status:'awaiting explicit human selection'};fs.writeFileSync(path.join(dir,'gallery.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(dir,'gallery.md'),['# Theme preview gallery','',`Source storyboard SHA-256: \`${inputHash}\``,'','Review both the cover and chart thumbnails, then select one explicitly with `src/select-design.mjs`. The tool does not mark a theme as user-confirmed.','',...results.map(t=>`## ${t.id}\n\nCover: ![${t.id} cover preview](${path.basename(t.preview)})\n\nChart: ![${t.id} chart preview](${path.basename(t.chart_preview)})\n`),''].join('\n'));console.log(`Rendered ${results.length} theme previews; awaiting explicit selection: ${dir}`);
}catch(error){console.error(`[ERROR] ${error.message}`);process.exit(1);}
