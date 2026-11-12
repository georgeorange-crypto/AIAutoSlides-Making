#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {metadataSearch} from '../packages/research/metadata-search.mjs';

const argv=process.argv.slice(2),value=name=>{const i=argv.indexOf(`--${name}`);return i<0?null:argv[i+1]??null;};
if(argv.includes('--help')){console.log('Usage: node src/research-search.mjs --provider openalex|crossref|arxiv --query "search terms" --out outputs/research/search.json --allow-network [--limit 1..10]\nMetadata search only. It never downloads papers. Network access is disabled unless --allow-network is present.');process.exit(0);}
try{
 for(const arg of argv.filter(a=>a.startsWith('--'))){if(!['--provider','--query','--out','--limit','--allow-network'].includes(arg))throw new Error(`Unknown option ${arg}`);}
 if(!argv.includes('--allow-network'))throw new Error('Network is disabled by default; add --allow-network to send the query to the selected public metadata API.');
 const provider=value('provider'),query=value('query'),out=value('out');if(!provider||!query||!out)throw new Error('--provider, --query, and --out are required');
 const target=path.resolve(out);
 if(fs.existsSync(target))throw new Error(`Refusing to overwrite existing search results: ${target}`);
 const result=await metadataSearch.search({provider,query,limit:Number(value('limit')||5)});
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(`Saved ${result.result_count} unverified ${provider} metadata candidate(s): ${target}`);console.log('No full text was downloaded. Review candidate records and the primary source before creating evidence excerpts.');
}catch(error){console.error(`[research search] ${error.message}`);process.exitCode=1;}
