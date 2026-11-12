#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {wikimediaCommons} from '../packages/research/wikimedia-commons.mjs';

const args=process.argv.slice(2),command=args[0],opts=args.slice(1),value=name=>{const i=opts.indexOf(`--${name}`);return i<0?null:opts[i+1]??null;},has=name=>opts.includes(`--${name}`);
function newFile(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data,{flag:'wx'});}
function newDir(dir){const target=path.resolve(dir||'');if(!dir)throw new Error('--out-dir is required');if(fs.existsSync(target))throw new Error(`Refusing to overwrite ${target}`);fs.mkdirSync(target,{recursive:true});return target;}
function help(){console.log('Usage:\n  node src/asset-research.mjs search --query "topic" --out NEW.json --allow-network [--limit 1..10]\n  node src/asset-research.mjs download --results SEARCH.json --candidate-id WMC_... --asset-id A_NAME --out-dir NEW_DIR --allow-download\nWikimedia Commons only. Search and single-item download are separate; downloaded rights remain unverified.');}
try{
 if(!command||command==='help'||command==='--help'||has('help')){help();process.exit(!command?2:0);}
 if(command==='search'){
  if(!has('allow-network'))throw new Error('Network is disabled by default; add --allow-network to send the query to Wikimedia Commons.');const query=value('query'),out=value('out');if(!query||!out)throw new Error('--query and --out are required');const result=await wikimediaCommons.search({query,limit:Number(value('limit')||5)});newFile(path.resolve(out),JSON.stringify(result,null,2)+'\n');console.log(`Saved ${result.result_count} Commons asset candidate(s); no image was downloaded.`);
 }else if(command==='download'){
  if(!has('allow-download'))throw new Error('Image download is disabled unless --allow-download is explicitly supplied.');const file=value('results'),candidateId=value('candidate-id'),assetId=value('asset-id');if(!file||!candidateId||!assetId)throw new Error('--results, --candidate-id, and --asset-id are required');const data=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));if(data.provider!=='wikimedia-commons'||!Array.isArray(data.results))throw new Error('results file is not a Wikimedia Commons search result');const candidate=data.results.find(item=>item.source_id===candidateId);if(!candidate)throw new Error('candidate-id was not found in the search results');const dir=newDir(value('out-dir')),download=await wikimediaCommons.download({candidate,assetId});newFile(path.join(dir,download.asset.path),download.bytes);newFile(path.join(dir,'assets.json'),JSON.stringify({schema_version:1,assets:[download.asset]},null,2)+'\n');console.log(`Saved one image (${download.asset.mime_type}, ${download.asset.sha256}). Rights remain needs_human_review; verify attribution and license before slide use.`);
 }else throw new Error(`Unknown command ${command}`);
}catch(error){console.error(`[asset research] ${error.message}`);process.exitCode=1;}
