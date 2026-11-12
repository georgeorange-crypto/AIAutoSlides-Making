import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {unzipSync} from 'fflate';
import {loadAssetManifest} from '../src/assets.mjs';
import {generatePresentation} from '../src/render.mjs';

const fixture=fs.readFileSync('examples/multimodal/assets/system-topology.svg');
const sha256=crypto.createHash('sha256').update(fixture).digest('hex');
function setup(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-assets-'));fs.mkdirSync(path.join(dir,'assets'));fs.writeFileSync(path.join(dir,'assets/topology.svg'),fixture);return dir;}
function manifest(dir,asset={}){const record={asset_id:'A1',path:'assets/topology.svg',type:'image/svg+xml',mime_type:'image/svg+xml',sha256,source:'Original hypothetical illustration',license:'CC0-1.0',verified:false,...asset};const file=path.join(dir,'assets.json');fs.writeFileSync(file,JSON.stringify({assets:[record]}));return file;}
const deck={meta:{title:'Synthetic system demo',subtitle:'Hypothetical',status:'SYNTHETIC'},slides:[{slide_id:'S01',type:'cover',title:'Synthetic systems demo',body:['Hypothetical only'],evidence_ids:[],visuals:[{asset_id:'A1',x:7,y:2,w:5,h:3}]}]};
test('manifest rejects missing files, missing lineage, and duplicate image bytes',()=>{const dir=setup();try{assert.throws(()=>loadAssetManifest(manifest(dir,{path:'assets/missing.svg'}),deck),/Missing asset file/);assert.throws(()=>loadAssetManifest(manifest(dir,{source:''}),deck),/requires source and license/);const data={assets:[{asset_id:'A1',path:'assets/topology.svg',type:'image/svg+xml',mime_type:'image/svg+xml',sha256,source:'x',license:'CC0',verified:false},{asset_id:'A2',path:'assets/topology.svg',type:'image/svg+xml',mime_type:'image/svg+xml',sha256,source:'x',license:'CC0',verified:false}]};const file=path.join(dir,'duplicates.json');fs.writeFileSync(file,JSON.stringify(data));assert.throws(()=>loadAssetManifest(file,deck),/Duplicate asset content/);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('manifest verifies hash and associates the asset with slide ID',()=>{const dir=setup();try{const map=loadAssetManifest(manifest(dir),deck);assert.equal(map.get('A1').slides[0],'S01');assert.equal(map.get('A1').sha256,sha256);assert.throws(()=>loadAssetManifest(manifest(dir,{sha256:'bad'}),deck),/SHA-256/);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('PPTX embeds a slide-referenced SVG as an image object',async()=>{const dir=setup();try{const assets=loadAssetManifest(manifest(dir),deck),theme=JSON.parse(fs.readFileSync('themes/academic-light.json','utf8')),out=path.join(dir,'deck.pptx');await generatePresentation(deck,{entries:[]},theme,out,assets);const files=unzipSync(new Uint8Array(fs.readFileSync(out)));assert.ok(Object.keys(files).some(n=>/^ppt\/media\/.*\.svg$/i.test(n)));assert.ok(Object.keys(files).some(n=>/^ppt\/slides\/slide1\.xml$/.test(n))&&new TextDecoder().decode(files['ppt/slides/slide1.xml']).includes('<p:pic>'));}finally{fs.rmSync(dir,{recursive:true,force:true});}});
