import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {findReleaseTagForPullRequest} from '../scripts/find-release-tag.mjs';

const run = (...args) => spawnSync(process.execPath, ['scripts/release-version.mjs', ...args], {encoding:'utf8'});
test('SemVer release labels increment patch, minor and major', () => {
  assert.equal(run('v1.2.3','release:patch').stdout.trim(), 'v1.2.4');
  assert.equal(run('1.2.3','release:minor').stdout.trim(), 'v1.3.0');
  assert.equal(run('1.2.3','release:major').stdout.trim(), 'v2.0.0');
});
test('first release starts from the 0.1.0 package seed', () => assert.equal(run('0.1.0','release:patch').stdout.trim(), 'v0.1.1'));
test('missing, duplicate and invalid release labels fail closed', () => {
  for (const args of [['1.0.0'],['1.0.0','release:patch','release:minor'],['1.0.0','release:next']]) assert.notEqual(run(...args).status, 0);
});
test('invalid SemVer fails closed', () => assert.notEqual(run('v1.0','release:patch').status, 0));
test('release reruns find the tag created for the same merged PR only', () => {
  const tags = [{tag:'v0.1.1',subject:'Release v0.1.1 for PR #41'},{tag:'v0.1.2',subject:'Release v0.1.2 for PR #42'}];
  assert.equal(findReleaseTagForPullRequest(tags,'41'),'v0.1.1');
  assert.equal(findReleaseTagForPullRequest(tags,'99'),null);
});
