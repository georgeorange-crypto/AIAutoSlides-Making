import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(projectRoot, 'docs/template/official-template-catalog.json');
const assetRoot = path.join(projectRoot, 'docs/template/local-assets');
const maxBytes = 100 * 1024 * 1024;
const timeoutMs = 45_000;
const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const confirmLocal = args.has('--local-evaluation');
const force = args.has('--force');

function usage() {
  console.log([
    'Download catalog-listed public template files to the ignored local-assets directory.',
    '',
    'Usage:',
    '  npm run templates:download -- --dry-run',
    '  npm run templates:download -- --local-evaluation',
    '  npm run templates:download -- --local-evaluation --force',
    '',
  'Only direct HTTPS download_url / download_assets values are fetched. The script does not crawl pages,',
    'authenticate, extract archives, execute content, or grant reuse/redistribution rights.',
  ].join('\n'));
}

if (args.has('--help') || args.has('-h')) {
  usage();
  process.exit(0);
}
for (const arg of args) {
  if (!['--dry-run', '--local-evaluation', '--force'].includes(arg)) {
    console.error(`Unknown option: ${arg}`);
    usage();
    process.exit(2);
  }
}
if (!dryRun && !confirmLocal) {
  console.error('Refusing to download without --local-evaluation. Files are stored for local evaluation only.');
  usage();
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const records = catalog.templates ?? [];
const downloadTargets = records.flatMap(item => {
  if (typeof item.download_policy === 'string' && item.download_policy.startsWith('skip_')) return [];
  if (Array.isArray(item.download_assets)) {
    return item.download_assets
      .filter(asset => typeof asset.url === 'string' && asset.url !== 'unknown')
      .map(asset => ({ ...item, ...asset, download_url: asset.url, asset_label: asset.label ?? asset.filename ?? item.resource_name }));
  }
  return typeof item.download_url === 'string' && item.download_url !== 'unknown' && item.download_url.trim() !== ''
    ? [{ ...item, asset_label: item.resource_name }]
    : [];
});

function safeFileName(item, response, url) {
  const disposition = response.headers.get('content-disposition') ?? '';
  const extended = disposition.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i)?.[1];
  const plain = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const queryName = url.searchParams.get('filename');
  let name = item.filename || (extended ? decodeURIComponent(extended.trim()) : plain || queryName || path.posix.basename(url.pathname));
  try { name = decodeURIComponent(name); } catch { /* Keep the raw server-provided name. */ }
  name = path.basename(name.replaceAll('\\', '/')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
  if (!name || name === '.' || name === '..') name = `${item.template_id}.download`;
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = `_${name}`;
  return name.slice(0, 180);
}

function assertPublicHttps(url) {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('only_public_https_urls_without_credentials_are_allowed');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) throw new Error('local_redirect_host_blocked');
  if (isIP(host) === 4) {
    const octets = host.split('.').map(Number);
    const [a, b] = octets;
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      throw new Error('private_redirect_ip_blocked');
    }
  }
  if (isIP(host) === 6 && (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:'))) {
    throw new Error('private_redirect_ip_blocked');
  }
}

async function fetchPublicHttps(startUrl, signal) {
  let current = new URL(startUrl);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    assertPublicHttps(current);
    const response = await fetch(current, {
      redirect: 'manual',
      signal,
      headers: { 'user-agent': 'AIAutoSlides-template-fetcher/1.0 (catalog-listed public resources)' },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error('redirect_missing_location');
    if (redirects === 5) throw new Error('too_many_redirects');
    current = new URL(location, current);
  }
  throw new Error('too_many_redirects');
}

async function fetchOne(item) {
  let url;
  try { url = new URL(item.download_url); }
  catch { return { template_id: item.template_id, status: 'failed', reason: 'invalid_download_url' }; }
  try { assertPublicHttps(url); }
  catch (error) { return { template_id: item.template_id, status: 'failed', reason: error.message }; }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let tempPath;
  try {
    const response = await fetchPublicHttps(url, controller.signal);
    if (!response.ok) {
      await response.body?.cancel();
      return { template_id: item.template_id, status: 'failed', http_status: response.status, reason: 'http_error' };
    }
    const finalUrl = new URL(response.url);
    assertPublicHttps(finalUrl);
    const contentType = (response.headers.get('content-type') ?? 'unknown').split(';')[0].trim().toLowerCase();
    if (contentType === 'text/html' || contentType === 'application/xhtml+xml') {
      await response.body?.cancel();
      return { template_id: item.template_id, status: 'failed', reason: 'received_html_instead_of_a_template_file', content_type: contentType };
    }
    const advertisedLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(advertisedLength) && advertisedLength > maxBytes) {
      await response.body?.cancel();
      return { template_id: item.template_id, status: 'failed', reason: 'file_exceeds_100_mib_limit', bytes: advertisedLength };
    }
    if (!response.body) return { template_id: item.template_id, status: 'failed', reason: 'empty_response_body' };

    const filename = safeFileName(item, response, finalUrl);
    const targetDir = path.join(assetRoot, item.template_id);
    const targetPath = path.join(targetDir, filename);
    fs.mkdirSync(targetDir, { recursive: true });
    if (fs.existsSync(targetPath) && !force) {
      await response.body.cancel();
      const existingHash = crypto.createHash('sha256').update(fs.readFileSync(targetPath)).digest('hex');
      return { template_id: item.template_id, status: 'skipped', reason: 'file_exists_use_force_to_replace', file: path.relative(projectRoot, targetPath).replaceAll('\\', '/'), sha256: existingHash };
    }
    tempPath = `${targetPath}.${crypto.randomUUID()}.part`;
    let bytes = 0;
    const hash = crypto.createHash('sha256');
    const prefix = [];
    let prefixBytes = 0;
    const meter = new Transform({
      transform(chunk, encoding, callback) {
        bytes += chunk.length;
        if (bytes > maxBytes) return callback(new Error('file_exceeds_100_mib_limit'));
        if (prefixBytes < 16) {
          const sample = chunk.subarray(0, 16 - prefixBytes);
          prefix.push(sample);
          prefixBytes += sample.length;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(response.body),
      meter,
      fs.createWriteStream(tempPath, { flags: 'wx' }),
    );
    const signature = Buffer.concat(prefix);
    if (signature.length < 4 || signature[0] !== 0x50 || signature[1] !== 0x4b) {
      throw new Error('content_is_not_a_pptx_or_zip_archive');
    }
    const digest = hash.digest('hex');
    if (fs.existsSync(targetPath) && !force) {
      fs.rmSync(tempPath, { force: true });
      return { template_id: item.template_id, status: 'skipped', reason: 'file_exists_use_force_to_replace', file: path.relative(projectRoot, targetPath).replaceAll('\\', '/') };
    }
    fs.renameSync(tempPath, targetPath);
    tempPath = undefined;
    return {
      template_id: item.template_id,
      status: 'downloaded',
      file: path.relative(projectRoot, targetPath).replaceAll('\\', '/'),
      bytes,
      sha256: digest,
      content_type: contentType,
      final_url: `${finalUrl.origin}${finalUrl.pathname}`,
      license_status: item.license_summary === 'unknown' ? 'unclear_review_required' : 'review_source_license_before_use',
    };
  } catch (error) {
    if (tempPath) fs.rmSync(tempPath, { force: true });
    return { template_id: item.template_id, status: 'failed', reason: error.name === 'AbortError' ? 'timeout' : error.message, cause_code: error.cause?.code ?? null };
  } finally {
    clearTimeout(timer);
  }
}

if (dryRun) {
  console.log(`Catalog entries: ${records.length}; direct HTTPS files to fetch: ${downloadTargets.length}; no files will be fetched.`);
  for (const item of downloadTargets) {
    const url = new URL(item.download_url);
    console.log(`- ${item.template_id} / ${item.asset_label} [${item.download_access}] ${url.origin}${url.pathname}`);
  }
  const linkedIds = new Set(downloadTargets.map(item => item.template_id));
  console.log(`Catalog entries without a direct download URL (not crawled): ${records.filter(item => !linkedIds.has(item.template_id)).length}`);
  console.log('Some candidates have unclear licenses or restricted intended audiences. Downloading does not grant permission to use or redistribute them.');
  process.exit(0);
}

fs.mkdirSync(assetRoot, { recursive: true });
const results = [];
for (const item of downloadTargets) {
  console.log(`Fetching ${item.template_id} ...`);
  const result = await fetchOne(item);
  result.asset_label = item.asset_label;
  result.source_url = item.download_url;
  results.push(result);
}
const attemptedIds = new Set(downloadTargets.map(item => item.template_id));
for (const item of records) {
  if (!attemptedIds.has(item.template_id)) results.push({ template_id: item.template_id, status: 'skipped', reason: 'no_direct_download_url_catalog_not_crawled' });
}
const report = {
  schema_version: 1,
  created_at: new Date().toISOString(),
  catalog: path.relative(projectRoot, catalogPath).replaceAll('\\', '/'),
  destination: path.relative(projectRoot, assetRoot).replaceAll('\\', '/'),
  mode: 'local_evaluation_only',
  note: 'Download success does not establish license, brand permission, editability, or redistribution rights. Archives were not extracted and content was not executed.',
  summary: Object.fromEntries(['downloaded', 'skipped', 'failed'].map(status => [status, results.filter(result => result.status === status).length])),
  results,
};
const reportPath = path.join(assetRoot, 'download-report.json');
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Download report: ${path.relative(projectRoot, reportPath).replaceAll('\\', '/')}`);
console.log(`Summary: ${JSON.stringify(report.summary)}`);
if (report.summary.failed > 0) process.exitCode = 1;
