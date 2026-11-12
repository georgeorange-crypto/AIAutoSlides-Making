import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(process.argv[2] ?? path.join(here, 'official-template-catalog.json'));
const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
const problems = [];
const ids = new Set();
const statuses = new Set([
  'verified_official', 'official_but_license_unclear',
  'third_party_reference_only', 'unverified', 'unavailable',
]);

if (!Array.isArray(doc.templates)) problems.push('templates must be an array');
for (const [i, item] of (doc.templates ?? []).entries()) {
  const at = `templates[${i}] (${item.template_id ?? 'missing id'})`;
  for (const key of ['template_id', 'institution', 'official_url', 'format', 'license_summary', 'official_status', 'trial_state']) {
    if (typeof item[key] !== 'string' || item[key].length === 0) problems.push(`${at}: ${key} must be a nonempty string`);
  }
  if (ids.has(item.template_id)) problems.push(`${at}: duplicate template_id`);
  ids.add(item.template_id);
  if (typeof item.official_url === 'string' && !/^https:\/\//i.test(item.official_url)) problems.push(`${at}: official_url must use HTTPS`);
  if (!statuses.has(item.official_status)) problems.push(`${at}: unsupported official_status ${item.official_status}`);
  if (item.quality_score !== null && !(Number.isFinite(item.quality_score) && item.quality_score >= 1 && item.quality_score <= 5)) {
    problems.push(`${at}: quality_score must be null or between 1 and 5`);
  }
  if (item.official_status === 'official_but_license_unclear' && item.integration_recommendation === 'eligible_distributable_brand_template') {
    problems.push(`${at}: unclear license cannot be distributable`);
  }
  if (item.download_url && item.download_url !== 'unknown' && !/^https:\/\//i.test(item.download_url)) problems.push(`${at}: download_url must be HTTPS or unknown`);
}
if (Number.isInteger(doc.metadata?.entries) && doc.metadata.entries !== ids.size) {
  problems.push(`metadata.entries=${doc.metadata.entries} but found ${ids.size} templates`);
}

if (problems.length) {
  console.error(`Catalog validation failed (${problems.length} issue(s)):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`OK: ${ids.size} catalog entries; metadata and permission guardrails passed (offline structural check only).`);
}
