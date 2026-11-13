#!/usr/bin/env node
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const required = ['examples/research-demo.json', 'sources/brief.md', 'sources/evidence.json'];
const forbidden = [/Qwen3-32B/i, /BitPack4/i, /67\.792/, /72\.7%/, /0\.369/, /0\.353/, /527.?587/];
const errors = [];
for (const file of required) {
  const text = fs.readFileSync(file, 'utf8');
  if (!/synthetic/i.test(text)) errors.push(`${file} must explicitly identify the CI fixture as synthetic`);
  for (const pattern of forbidden) if (pattern.test(text)) errors.push(`${file} contains disallowed research-specific content (${pattern})`);
}
if (process.argv.includes('--release-archive')) {
  const tracked = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
  const excludedCandidates = tracked.filter(file => /^(artifacts|outputs|workspace|models|checkpoints)\//i.test(file) || /^content\/ai-storyboard\.json$/i.test(file) || /^docs\/demo-(contact-sheet|cover)\.png$/i.test(file) || /^examples\/existing-pptx\/fixtures\/template\.pptx$/i.test(file));
  if (excludedCandidates.length) {
    const attributes = execFileSync('git', ['check-attr', '--cached', '-z', 'export-ignore', '--', ...excludedCandidates], {encoding:'utf8'}).split('\0').filter(Boolean);
    for (let i=0; i<attributes.length; i+=3) if (attributes[i+2] !== 'set') errors.push(`Release source archive must omit generated/private path: ${attributes[i]}`);
  }
} else if (process.argv.includes('--docker-context')) {
  const dockerignore = fs.readFileSync('.dockerignore', 'utf8');
  for (const token of ['sources', 'outputs', 'workspace', '.env', '*.pptx', '*.pdf', '*.png']) if (!dockerignore.includes(token)) errors.push(`.dockerignore must exclude ${token}`);
} else {
  const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  const artifactSection = workflow.split('name: synthetic-presentation-preview')[1]?.split('retention-days:')[0] || '';
  for (const line of artifactSection.split(/\r?\n/).filter(line => line.trim().startsWith('outputs/'))) {
    if (!/^\s*outputs\/research-demo(?:\.pptx|\.review\.json|\.evidence-manifest\.json|\.qa\.json|\.qa\.md|\.pdf|\-page-\*\.png)$/.test(line)) errors.push(`CI artifact is outside the synthetic preview allowlist: ${line.trim()}`);
  }
  for (const unsafe of ['artifacts', 'outputs', 'workspace', 'content', 'models', 'checkpoints', '.env', '*.safetensors', '*.gguf', '*.pptx', '*.pdf', '*.png']) {
    if (!fs.readFileSync('.dockerignore', 'utf8').includes(unsafe)) errors.push(`.dockerignore must exclude ${unsafe}`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Synthetic inputs and protected-path checks passed.');
