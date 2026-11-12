#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pptxgenjsIRAdapter} from '../packages/adapters/pptxgenjs-ir.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function parse(args){
  const result={};
  for(let i=0;i<args.length;i++){
    const flag=args[i],value=args[++i];
    if(!['--input','--out'].includes(flag)||!value||value.startsWith('--'))throw new Error('Usage: node src/render-ir.mjs --input <presentation-ir.json> --out <output-directory>');
    result[flag.slice(2)]=path.resolve(value);
  }
  if(!result.input||!result.out)throw new Error('Usage: node src/render-ir.mjs --input <presentation-ir.json> --out <output-directory>');
  return result;
}
try{
  const {input,out}=parse(process.argv.slice(2)),relative=path.relative(root,out);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))throw new Error('--out must resolve inside this repository workspace');
  const realRoot=fs.realpathSync(root);
  let existing=out;while(!fs.existsSync(existing)){const parent=path.dirname(existing);if(parent===existing)throw new Error('Cannot resolve output directory');existing=parent;}
  const realExisting=fs.realpathSync(existing),realRelative=path.relative(realRoot,realExisting);
  if(realRelative==='..'||realRelative.startsWith(`..${path.sep}`)||path.isAbsolute(realRelative))throw new Error('--out must not traverse a symlink outside this repository workspace');
  const inputBytes=fs.readFileSync(input),presentationIR=JSON.parse(inputBytes.toString('utf8'));
  const inputHash=(await import('node:crypto')).createHash('sha256').update(inputBytes).digest('hex');
  const result=await pptxgenjsIRAdapter.render({presentationIR,workspace:out,outputDir:out,inputHash,inputPath:input});
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}catch(error){process.stderr.write(`IR render failed: ${error.message}\n`);process.exitCode=1;}
