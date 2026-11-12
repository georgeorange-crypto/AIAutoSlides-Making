#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {markitdownAdapter} from '../packages/adapters/markitdown.mjs';

const argv=process.argv.slice(2),value=name=>{const i=argv.indexOf(`--${name}`);return i<0?null:argv[i+1]??null;};
if(argv.includes('--help')){console.log('Usage: npm run import:markitdown -- --input <local-file> --allowed-root <authorized-directory> --out <new-json-file>\nLocal-only text conversion; MarkItDown plugins are disabled. Existing output files are never overwritten.');process.exit(0);}
try{
 for(const arg of argv.filter(a=>a.startsWith('--'))){if(!['--input','--allowed-root','--out','--help'].includes(arg))throw new Error(`Unknown option ${arg}`);}
 const inputFile=value('input'),allowedRoot=value('allowed-root'),out=value('out');if(!inputFile||!allowedRoot||!out)throw new Error('--input, --allowed-root, and --out are required');
 const target=path.resolve(out);if(fs.existsSync(target))throw new Error(`Refusing to overwrite existing output: ${target}`);
 const record=await markitdownAdapter.run({inputFile,allowedRoot});fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
 console.log(`Saved unverified MarkItDown source record: ${target}`);console.log(`Source SHA-256: ${record.source.sha256}; ${record.content.text.length} Markdown characters.`);console.log('This text conversion is not page-layout preserving or factual verification.');
}catch(error){console.error(`[MarkItDown import] ${error.message}`);process.exitCode=1;}
