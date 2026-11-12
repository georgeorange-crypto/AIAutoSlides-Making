import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createWikimediaCommons} from '../packages/research/wikimedia-commons.mjs';
import {loadAssetManifest,assetManifestReport} from '../src/assets.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const png=Buffer.from('89504e470d0a1a0a','hex');
test('Commons search returns rights metadata candidates only and records response provenance',async()=>{
 let url;const api=createWikimediaCommons({clock:()=> '2026-11-12T00:00:00Z',fetchImpl:async(input,init)=>{url=new URL(input);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');return new Response(JSON.stringify({query:{pages:[{pageid:42,title:'File:Example.png',imageinfo:[{thumburl:'https://upload.wikimedia.org/thumb/example.jpg',thumbmime:'image/jpeg',mime:'image/png',width:800,height:600,extmetadata:{LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'},UsageTerms:{value:'Creative Commons Attribution-ShareAlike 4.0'},Artist:{value:'<a>Example Author</a>'},Credit:{value:'Example archive'},AttributionRequired:{value:'true'}}}]}]}}),{status:200,headers:{'content-type':'application/json'}});}});
 const result=await api.search({query:'scientific instrument',limit:2});assert.equal(url.hostname,'commons.wikimedia.org');assert.equal(url.searchParams.get('gsrnamespace'),'6');assert.equal(url.searchParams.get('gsrlimit'),'2');assert.equal(result.result_count,1);assert.equal(result.results[0].license_short_name,'CC BY-SA 4.0');assert.equal(result.results[0].artist,'Example Author');assert.equal(result.results[0].rights_review_status,'needs_human_review');assert.equal(result.results[0].verification_status,'unverified');assert.match(result.response_sha256,/^[a-f0-9]{64}$/);
});

test('Commons download accepts one selected upload.wikimedia.org raster and preserves unapproved rights',async()=>{
 const api=createWikimediaCommons({fetchImpl:async(url,init)=>{assert.equal(new URL(url).hostname,'upload.wikimedia.org');assert.equal(init.redirect,'error');return new Response(png,{status:200,headers:{'content-type':'image/png'}});}});
 const candidate={provider:'wikimedia-commons',thumbnail_url:'https://upload.wikimedia.org/wikipedia/commons/example.png',description_page:'https://commons.wikimedia.org/wiki/File:Example',license_short_name:'CC0',license_url:'https://creativecommons.org/publicdomain/zero/1.0/',artist:'Example'};
 const result=await api.download({candidate,assetId:'A_EXAMPLE'});assert.equal(result.bytes.toString('hex'),png.toString('hex'));assert.equal(result.asset.mime_type,'image/png');assert.equal(result.asset.verified,false);assert.equal(result.asset.rights_review_status,'needs_human_review');assert.equal(result.asset.author,'Example');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-commons-manifest-'));try{fs.writeFileSync(path.join(dir,result.asset.path),result.bytes);fs.writeFileSync(path.join(dir,'assets.json'),JSON.stringify({assets:[result.asset]}));const map=loadAssetManifest(path.join(dir,'assets.json'),{}),report=assetManifestReport(map);assert.equal(report[0].sha256,result.asset.sha256);assert.equal(report[0].verified,false);assert.equal(report[0].license,'CC0');}finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('Commons download rejects arbitrary hosts, unsupported IDs, and unrecognized image bytes',async()=>{
 let calls=0;const api=createWikimediaCommons({fetchImpl:async()=>{calls++;return new Response('html',{status:200});}});
 await assert.rejects(api.download({candidate:{provider:'wikimedia-commons',thumbnail_url:'https://example.com/img.png'},assetId:'A_EXAMPLE'}),/Only HTTPS images from Wikimedia upload\/thumbnail hosts/);
 await assert.rejects(api.download({candidate:{provider:'wikimedia-commons',thumbnail_url:'https://upload.wikimedia.org/img.png'},assetId:'bad id'}),/assetId/);
 await assert.rejects(api.download({candidate:{provider:'wikimedia-commons',thumbnail_url:'https://upload.wikimedia.org/img.png'},assetId:'A_EXAMPLE'}),/not a supported PNG or JPEG/);assert.equal(calls,1);
});

test('asset research CLI keeps search and download network access opt-in',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-assets-cli-'));
 try{
  const out=path.join(dir,'results.json'),blockedSearch=spawnSync(process.execPath,[path.join(root,'src/asset-research.mjs'),'search','--query','scientific figure','--out',out],{cwd:root,encoding:'utf8'});
  assert.equal(blockedSearch.status,1);assert.match(blockedSearch.stderr,/Network is disabled by default/);assert.equal(fs.existsSync(out),false);
  const resultFile=path.join(dir,'candidate.json'),outDir=path.join(dir,'asset');fs.writeFileSync(resultFile,JSON.stringify({provider:'wikimedia-commons',results:[]}));
  const blockedDownload=spawnSync(process.execPath,[path.join(root,'src/asset-research.mjs'),'download','--results',resultFile,'--candidate-id','WMC_TEST','--asset-id','A_TEST','--out-dir',outDir],{cwd:root,encoding:'utf8'});
  assert.equal(blockedDownload.status,1);assert.match(blockedDownload.stderr,/disabled unless --allow-download/);assert.equal(fs.existsSync(outDir),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
