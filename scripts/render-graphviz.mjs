#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {graphvizAdapter} from '../packages/adapters/graphviz.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function parse(args){const config={input:path.join(root,'examples','open-source-bakeoff','graphviz-synthetic.json'),evidence:path.join(root,'examples','open-source-bakeoff','synthetic-evidence.json'),out:path.join(root,'outputs','graphviz-synthetic')};for(let i=0;i<args.length;i++){const key=args[i];if(!['--input','--evidence','--out'].includes(key)||!args[i+1])throw new Error(`Unknown or missing option value: ${key}`);config[{'--input':'input','--evidence':'evidence','--out':'out'}[key]]=args[++i];}return config;}
const config=parse(process.argv.slice(2)),result=await graphvizAdapter.run({inputFile:path.resolve(config.input),evidenceFile:path.resolve(config.evidence),outputDir:path.resolve(config.out)});
console.log(JSON.stringify({output:path.resolve(config.out),source_ids:result.manifest.source_ids,verification_status:result.manifest.verification_status,artifacts:result.artifacts.map(item=>({path:path.relative(path.resolve(config.out),item.path).replaceAll('\\','/'),bytes:item.bytes,sha256:item.sha256})),warnings:result.warnings},null,2));
