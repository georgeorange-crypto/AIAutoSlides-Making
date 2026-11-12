import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRunManifest,diffRunManifests,parseRunCsv} from '../src/run-audit.mjs';

const csv=(rows)=>['run_id,run_timestamp,observation_id,latency_ms','run-a,2026-11-01T12:00:00Z,obs-1,10','run-a,2026-11-01T12:00:00Z,obs-2,12',...rows].join('\n');

test('run audit assigns stable identities and hashes source rows',()=>{
  const manifest=buildRunManifest(csv([]),'fixture.csv');
  assert.equal(manifest.runs[0].run_id,'run-a');
  assert.equal(manifest.runs[0].observation_count,2);
  assert.equal(manifest.observations[0].source_row,2);
  assert.match(manifest.source.sha256,/^[a-f0-9]{64}$/);
});

test('run diff reports additions, changed values, and removed observations',()=>{
  const before=buildRunManifest(csv([]));
  const after=buildRunManifest(['run_id,run_timestamp,observation_id,latency_ms','run-a,2026-11-01T12:00:00Z,obs-1,11','run-a,2026-11-01T12:00:00Z,obs-3,14'].join('\n'));
  const diff=diffRunManifests(before,after);
  assert.equal(diff.source_changed,true);
  assert.deepEqual(diff.added.map(x=>x.observation_id),['obs-3']);
  assert.deepEqual(diff.changed.map(x=>x.observation_id),['obs-1']);
  assert.deepEqual(diff.removed.map(x=>x.observation_id),['obs-2']);
});

test('run audit rejects duplicate IDs, inconsistent timestamps, and absent required columns',()=>{
  assert.throws(()=>buildRunManifest(csv(['run-a,2026-11-01T12:00:00Z,obs-1,10'])),/Duplicate observation_id/);
  assert.throws(()=>buildRunManifest(['run_id,run_timestamp,observation_id,value','r,2026-11-01T12:00:00Z,o1,1','r,2026-11-02T12:00:00Z,o2,2'].join('\n')),/inconsistent run_timestamp/);
  assert.throws(()=>parseRunCsv('run_id,observation_id\nr,o'),/requires columns/);
});
