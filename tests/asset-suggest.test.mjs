import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {loadAssetManifest} from '../src/assets.mjs';
import {suggestAssets} from '../src/asset-suggest.mjs';

const project=process.cwd();
test('asset suggestions explain lexical matches, retain rights warnings, and never apply placements',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-asset-suggest-'));
  try{
    fs.mkdirSync(path.join(dir,'assets'));
    fs.copyFileSync(path.join(project,'examples/multimodal/assets/system-topology.svg'),path.join(dir,'assets/topology.svg'));
    const bytes=fs.readFileSync(path.join(dir,'assets/topology.svg'));
    const manifest={assets:[{asset_id:'A_TOPOLOGY',path:'assets/topology.svg',type:'image/svg+xml',mime_type:'image/svg+xml',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),source:'Synthetic illustration',license:'CC0-1.0',verified:false,rights_review_status:'needs_human_review',description:'scheduler request worker architecture',keywords:['scheduler','architecture']}]};
    const manifestFile=path.join(dir,'assets.json'),deck={slides:[{slide_id:'S01',title:'Scheduler architecture overview',assertion_title:'Requests flow through the scheduler to worker nodes',body:['Synthetic design only'],evidence_ids:[]}]};
    fs.writeFileSync(manifestFile,JSON.stringify(manifest));
    const assets=loadAssetManifest(manifestFile,deck),first=suggestAssets(deck,assets),second=suggestAssets(deck,assets);
    assert.deepEqual(first,second);
    assert.equal(first[0].candidates[0].asset_id,'A_TOPOLOGY');
    assert.ok(first[0].candidates[0].matched_terms.includes('scheduler'));
    assert.ok(first[0].candidates[0].review_flags.includes('provenance_or_permission_not_human_verified'));
    assert.ok(first[0].candidates[0].review_flags.includes('rights_review_pending'));
    assert.ok(first[0].candidates[0].review_flags.includes('license_not_independently_validated'));
    assert.deepEqual(first[0].existing_asset_ids,[]);
    assert.equal(deck.slides[0].visuals,undefined,'suggestion must not mutate the storyboard');
    const out=path.join(dir,'suggestions.json'),run=spawnSync(process.execPath,['src/asset-suggest.mjs','--storyboard',path.join(project,'examples/multimodal/storyboard.json'),'--assets',path.join(project,'examples/multimodal/assets.json'),'--out',out],{cwd:project,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const report=JSON.parse(fs.readFileSync(out,'utf8'));
    assert.equal(report.human_review_required,true);
    assert.match(report.method,/not semantic verification/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
