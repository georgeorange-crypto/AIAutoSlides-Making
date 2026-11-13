#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marpAdapter} from '../packages/adapters/marp.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args=process.argv.slice(2);
function option(name,fallback){const index=args.indexOf(`--${name}`);return index<0?fallback:(args[index+1]??null);}
function inside(child,parent){const relative=path.relative(parent,child);return relative===''||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative));}
try{
  const input=path.resolve(root,option('input','examples/open-source-bakeoff/marp-synthetic.md'));
  const outputDir=path.resolve(root,option('out','outputs/marp-synthetic'));
  const formats=(option('formats','html,pptx')||'').split(',').map(value=>value.trim()).filter(Boolean);
  if(!inside(outputDir,path.join(root,'outputs')))throw new Error('--out must stay under repository outputs/.');
  const result=await marpAdapter.run({inputFile:input,outputDir,formats});
  console.log(JSON.stringify({backend:result.backendVersion,artifacts:result.artifacts,warnings:result.warnings},null,2));
}catch(error){console.error(`[marp export] ${error.message}`);process.exitCode=1;}
