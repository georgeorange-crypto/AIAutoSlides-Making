#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {loadEvidence} from './validate.mjs';
import {compileApprovedStoryboard} from './compile-approved-storyboard.mjs';

const args=process.argv.slice(2),arg=name=>{const index=args.indexOf(`--${name}`);return index<0?null:args[index+1];};
if(args.includes('--help')||args.includes('-h')){
  console.log('Usage: node src/storyboard-to-ir.mjs --input approved-storyboard.json --evidence sources/evidence.json --out outputs/presentation-ir.json\nCompiles only a content-hash-bound approved AI storyboard. Harness PPT tasks still require an approved deck plan and representative-slide review.');
  process.exit(0);
}
const input=arg('input'),evidencePath=arg('evidence')||'sources/evidence.json',output=arg('out');
if(!input||!output){console.error('Usage: node src/storyboard-to-ir.mjs --input approved-storyboard.json --evidence sources/evidence.json --out outputs/presentation-ir.json');process.exit(2);}
try{
  const inputPath=path.resolve(input),ledgerPath=path.resolve(evidencePath),outPath=path.resolve(output);
  const storyboard=JSON.parse(fs.readFileSync(inputPath,'utf8')),evidence=loadEvidence(ledgerPath);
  const ir=compileApprovedStoryboard(storyboard,evidence,{sourcePath:inputPath,evidencePath:ledgerPath});
  fs.mkdirSync(path.dirname(outPath),{recursive:true});fs.writeFileSync(outPath,`${JSON.stringify(ir,null,2)}\n`);
  console.log(`Compiled ${ir.slides.length} reviewed storyboard slides into Presentation IR: ${outPath}`);
  console.log('Source verification states were preserved. Formal Harness PPT execution still requires an approved deck plan and representative-slide review.');
}catch(error){console.error(`[ERROR] ${error.message}`);process.exitCode=1;}
