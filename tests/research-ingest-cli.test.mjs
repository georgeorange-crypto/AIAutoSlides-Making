import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),cli=path.join(root,'src/research-ingest.mjs'),assetCli=path.join(root,'src/asset-research.mjs');
test('crawl and image search require explicit network and site authorization; private URLs are rejected',()=>{
 const out=path.join(os.tmpdir(),`aiautoslides-private-crawl-${process.pid}`),base=[cli,'crawl','--url','https://127.0.0.1','--out-dir',out];
 try{const noConsent=spawnSync(process.execPath,base,{cwd:root,encoding:'utf8'});assert.equal(noConsent.status,1);assert.match(noConsent.stderr,/explicit --allow-network/);assert.equal(fs.existsSync(out),false);
  const privateUrl=spawnSync(process.execPath,[...base,'--allow-network','--site-authorized'],{cwd:root,encoding:'utf8'});assert.equal(privateUrl.status,1);assert.match(privateUrl.stderr,/Only HTTPS URLs|non-public address/);assert.equal(fs.existsSync(out),false);
  const imageSearch=spawnSync(process.execPath,[assetCli,'search','--query','fixture','--out',path.join(os.tmpdir(),`aiautoslides-image-${process.pid}.json`)],{cwd:root,encoding:'utf8'});assert.equal(imageSearch.status,1);assert.match(imageSearch.stderr,/Network is disabled by default/);
 }finally{if(fs.existsSync(out))fs.rmSync(out,{recursive:true,force:true});}
});

test('paper downloading requires explicit opt-in and a provider result file',()=>{
 const blocked=spawnSync(process.execPath,[cli,'download-arxiv','--results','missing.json','--source-id','SRC_ARXIV_FIXTURE','--out-dir',path.join(os.tmpdir(),`aiautoslides-download-${process.pid}`)],{cwd:root,encoding:'utf8'});assert.equal(blocked.status,1);assert.match(blocked.stderr,/explicit --allow-download/);
});
