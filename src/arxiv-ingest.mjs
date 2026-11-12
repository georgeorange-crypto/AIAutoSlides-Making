#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {ingestArxivPaper} from '../packages/research/arxiv-ingest.mjs';

const args=process.argv.slice(2),command=args[0],opts=args.slice(1),value=name=>{const i=opts.indexOf(`--${name}`);return i<0?null:opts[i+1]??null;},has=name=>opts.includes(`--${name}`);
function usage(){console.log('Usage:\n  node src/arxiv-ingest.mjs download --results SEARCH.json --source-id SRC_ARXIV_... --allow-download --out-dir NEW_DIR\nDownloads one selected arXiv PDF, extracts selectable text locally, and writes unverified page-level evidence candidates.');}
try{
 if(!command||command==='--help'||command==='help'||has('help')){usage();process.exit(command?0:2);}
 if(command!=='download')throw new Error(`Unknown command ${command}`);
 if(!has('allow-download'))throw new Error('This operation requires explicit --allow-download opt-in');
 const resultsFile=value('results'),sourceId=value('source-id'),outDir=value('out-dir');if(!resultsFile||!sourceId||!outDir)throw new Error('--results, --source-id and --out-dir are required');
 const results=JSON.parse(fs.readFileSync(path.resolve(resultsFile),'utf8'));
 const result=await ingestArxivPaper({results,sourceId,outDir});
 console.log(`Downloaded one selected arXiv paper; ${result.manifest.page_count} page(s), ${result.evidence.entries.length} unverified excerpt candidate(s).`);console.log(`Artifacts: ${result.directory}`);
}catch(error){console.error(`[arXiv ingest] ${error.message}`);process.exitCode=1;}
