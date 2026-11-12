#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {slidevAdapter} from '../packages/adapters/slidev.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function parse(args){
  const options={};
  for(let index=0;index<args.length;index++){
    const flag=args[index],value=args[++index];
    if(!['--input','--input-dir','--out','--formats'].includes(flag)||!value||value.startsWith('--'))throw new Error('Usage: npm run render:slidev-ir -- --input <presentation-ir.json> --out <directory> [--input-dir <asset-root>] [--formats pdf,png|pptx-editable]');
    options[flag.slice(2)]=value;
  }
  if(!options.input||!options.out)throw new Error('Usage: npm run render:slidev-ir -- --input <presentation-ir.json> --out <directory> [--input-dir <asset-root>] [--formats pdf,png|pptx-editable]');
  return options;
}
function assertInsideRoot(target,label,base=root){const relative=path.relative(base,target);if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error(`${label} must resolve inside the repository workspace`);}
try{
  const options=parse(process.argv.slice(2)),input=path.resolve(options.input),inputDir=path.resolve(options['input-dir']||path.dirname(input)),out=path.resolve(options.out);
  assertInsideRoot(out,'--out');
  fs.mkdirSync(out,{recursive:true});
  const realRoot=fs.realpathSync(root),realOutput=fs.realpathSync(out);assertInsideRoot(realOutput,'--out (symlink-resolved)',realRoot);
  const bytes=fs.readFileSync(input),presentationIR=JSON.parse(bytes.toString('utf8'));
  const result=await slidevAdapter.runIR({presentationIR,inputDir,outputDir:out,formats:options.formats?options.formats.split(',').map(value=>value.trim()).filter(Boolean):['pdf','png']});
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}catch(error){process.stderr.write(`Slidev IR export failed: ${error.message}\n`);process.exitCode=1;}
