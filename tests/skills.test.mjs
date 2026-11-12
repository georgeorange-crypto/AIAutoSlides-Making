import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const copies=['skills/aiautoslides/SKILL.md','.agents/skills/aiautoslides/SKILL.md','.claude/skills/aiautoslides/SKILL.md'];

test('Codex and Claude project skills stay identical to the documented source skill',()=>{
  const content=copies.map(file=>fs.readFileSync(file,'utf8'));
  assert.equal(new Set(content).size,1,'all host-specific paths must match the canonical skill');
  const skill=content[0];
  assert.match(skill,/^---\nname: aiautoslides\ndescription: .+\n---\n/m);
  for(const requirement of ['evidence ledger','verified, unverified, synthetic, and hypothetical','external API request','SHA-256','node src/cli.mjs validate','node src/qa.mjs','Inspect every rendered slide image','human scientific and visual review pending','Obtain user approval'])assert.ok(skill.includes(requirement),`missing skill requirement: ${requirement}`);
});
