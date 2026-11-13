#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {europePmcFullText} from '../packages/research/europepmc-fulltext.mjs';
import {createEuropePmcBundle} from '../packages/research/europepmc-bundle.mjs';

const args=process.argv.slice(2),value=name=>{const i=args.indexOf(`--${name}`);return i<0?null:args[i+1]??null;},has=name=>args.includes(name.startsWith('--')?name:'--'+name);
function usage(){console.log('Usage: node src/europepmc-ingest.mjs --doi 10.xxxx/yyy --allow-network --allow-download --out-dir NEW_DIR\nImports one exact DOI match only when Europe PMC reports an open-access PMC record. Stores JATS XML and unverified paragraph evidence locally; rights still need human review.');}
function writeNew(file,data){fs.writeFileSync(file,data,{flag:'wx'});}
try{
 if(has('--help'))usage();
 else{
  if(!has('--allow-network'))throw new Error('Network is disabled by default; add --allow-network to send the DOI to Europe PMC.');
  if(!has('--allow-download'))throw new Error('Full-text download requires explicit --allow-download opt-in.');
  const doi=value('doi'),out=value('out-dir');if(!doi||!out)throw new Error('--doi and --out-dir are required');
  const dir=path.resolve(out);if(fs.existsSync(dir))throw new Error(`Refusing to overwrite existing output directory: ${dir}`);
  const result=await europePmcFullText.fetchByDoi(doi),bundle=createEuropePmcBundle(result);
  fs.mkdirSync(dir,{recursive:true});
  writeNew(path.join(dir,'source.xml'),result.xml);writeNew(path.join(dir,'extracted.md'),bundle.markdown);writeNew(path.join(dir,'source.manifest.json'),JSON.stringify(bundle.manifest,null,2)+'\n');writeNew(path.join(dir,'evidence.json'),JSON.stringify(bundle.evidence,null,2)+'\n');
  console.log(`Imported one Europe PMC open-access full text (${result.pmcid}); ${bundle.evidence.entries.length} paragraph evidence candidate(s) remain unverified.`);console.log(`Artifacts: ${dir}`);
 }
}catch(error){console.error(`[Europe PMC import] ${error.message}`);process.exitCode=1;}
