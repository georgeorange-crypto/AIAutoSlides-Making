#!/usr/bin/env node
const [current = '0.1.0', ...labels] = process.argv.slice(2);
const allowed = ['release:patch', 'release:minor', 'release:major'];
const selected = labels.filter(label => allowed.includes(label));
if (selected.length !== 1 || labels.some(label => label.startsWith('release:') && !allowed.includes(label))) {
  console.error(`Expected exactly one valid release label (${allowed.join(', ')})`);
  process.exit(2);
}
const match = current.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
if (!match) { console.error(`Invalid SemVer tag: ${current}`); process.exit(2); }
let [, major, minor, patch] = match.map((part, index) => index ? BigInt(part) : part);
if (selected[0] === 'release:major') { major++; minor = 0; patch = 0; }
if (selected[0] === 'release:minor') { minor++; patch = 0; }
if (selected[0] === 'release:patch') patch++;
console.log(`v${major}.${minor}.${patch}`);
