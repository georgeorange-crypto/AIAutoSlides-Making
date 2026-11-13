import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateDeck} from '../src/validate.mjs';

const hasIsolatedElk=fs.existsSync('outputs/open-source-bakeoff/elkjs-lab/node_modules/elkjs/lib/elk.bundled.js');
test('isolated ELK.js adapter preserves diagram IDs, evidence lineage, and slide bounds',{skip:!hasIsolatedElk?'Install the optional isolated elkjs@0.12.1 POC dependency to run this integration check':false},()=>{
  const run=spawnSync(process.execPath,['scripts/layout-architecture-elk.mjs'],{encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  const diagram=JSON.parse(fs.readFileSync('outputs/open-source-bakeoff/elkjs/architecture-layout.json','utf8'));
  const source=JSON.parse(fs.readFileSync('examples/open-source-bakeoff/elkjs/architecture.json','utf8'));
  assert.deepEqual(diagram.nodes.map(node=>node.id),source.nodes.map(node=>node.id));
  assert.deepEqual(diagram.edges,source.edges);
  assert.equal(diagram.status,'SYNTHETIC / HYPOTHETICAL');
  const storyboard=JSON.parse(fs.readFileSync('examples/open-source-bakeoff/elkjs/storyboard.json','utf8'));
  storyboard.slides[0].diagram=diagram;
  const evidence=JSON.parse(fs.readFileSync('examples/open-source-bakeoff/elkjs/evidence.json','utf8'));
  const validation=validateDeck(storyboard,evidence);
  assert.deepEqual(validation.errors,[]);
  for(const item of [...diagram.nodes,...diagram.groups]){
    assert.ok(item.x>=0&&item.y>=2.35&&item.w>0&&item.h>0);
    assert.ok(item.x+item.w<=13.333&&item.y+item.h<=6.85);
  }
  for(const node of diagram.nodes)assert.ok(diagram.groups.some(group=>node.x>=group.x&&node.x+node.w<=group.x+group.w),`${node.id} must fit inside a display group`);
});

test('ELK.js adapter refuses non-synthetic input',{skip:!hasIsolatedElk?'Install the optional isolated elkjs@0.12.1 POC dependency to run this integration check':false},()=>{
  const source=JSON.parse(fs.readFileSync('examples/open-source-bakeoff/elkjs/architecture.json','utf8'));
  const input='outputs/open-source-bakeoff/elkjs/non-synthetic-rejection.json';
  fs.mkdirSync('outputs/open-source-bakeoff/elkjs',{recursive:true});
  fs.writeFileSync(input,JSON.stringify({...source,status:'REAL / UNAUTHORIZED'}));
  try{
    const run=spawnSync(process.execPath,['scripts/layout-architecture-elk.mjs','--input',input,'--out','outputs/open-source-bakeoff/elkjs/should-not-exist.json'],{encoding:'utf8'});
    assert.notEqual(run.status,0);
    assert.match(run.stderr,/accepts only explicitly synthetic fixture data/);
  }finally{fs.rmSync(input,{force:true});}
});
