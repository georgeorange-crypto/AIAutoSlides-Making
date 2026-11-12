import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const types=new Set(['image/png','image/jpeg','image/svg+xml']);
const mimeFor=file=>({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file).toLowerCase()];
export function loadAssetManifest(file,deck){
  if(!file)return new Map();
  const manifestPath=path.resolve(file),data=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(!Array.isArray(data.assets))throw new Error('Asset manifest must contain assets[]');
  const base=path.dirname(manifestPath),map=new Map(),hashes=new Map();
  for(const [i,a] of data.assets.entries()){
    if(!a||typeof a.asset_id!=='string'||!a.asset_id.trim()||typeof a.path!=='string'||!a.path.trim())throw new Error(`Invalid asset entry ${i}: asset_id and path required`);
    if(map.has(a.asset_id))throw new Error(`Duplicate asset ID ${a.asset_id}`);
    const resolved=path.resolve(base,a.path);
    if(!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())throw new Error(`Missing asset file ${a.path} (${a.asset_id})`);
    const mime=mimeFor(resolved);if(!types.has(mime)||a.mime_type!==mime)throw new Error(`Unsupported or mismatched image type for ${a.asset_id}; expected PNG, JPEG, or SVG with matching mime_type`);
    const bytes=fs.readFileSync(resolved),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    if(typeof a.sha256!=='string'||a.sha256!==sha256)throw new Error(`Asset SHA-256 missing or mismatched for ${a.asset_id}`);
    if(mime==='image/svg+xml'){
      const svg=bytes.toString('utf8');
      if(!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg)||/<!DOCTYPE|<!ENTITY|<(?:script|foreignObject)\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/|file:|javascript:|data:)|url\(\s*["']?\s*(?:https?:|\/\/|file:|javascript:|data:)/i.test(svg))throw new Error(`Unsafe or unsupported SVG content for ${a.asset_id}; active content and external references are not allowed`);
    }
    if(a.type!==mime)throw new Error(`Asset type mismatch for ${a.asset_id}; type must be ${mime}`);
    if(hashes.has(sha256))throw new Error(`Duplicate asset content: ${a.asset_id} duplicates ${hashes.get(sha256)}`);
    hashes.set(sha256,a.asset_id);
    if(typeof a.source!=='string'||!a.source.trim()||typeof a.license!=='string'||!a.license.trim())throw new Error(`Asset ${a.asset_id} requires source and license; use an explicit value such as "Original demo illustration" and "CC0"`);
    if(typeof a.verified!=='boolean')throw new Error(`Asset ${a.asset_id} requires verified:boolean`);
    map.set(a.asset_id,{...a,mime_type:mime,sha256,resolved_path:resolved,slides:[]});
  }
  for(const slide of deck.slides||[])for(const v of slide.visuals||[]){const a=map.get(v.asset_id);if(!a)throw new Error(`Slide ${slide.slide_id||slide.title} refers to missing asset ${v.asset_id}`);a.slides.push(slide.slide_id||null);}
  if(deck?.slides)for(const a of map.values())if(!a.slides.length)console.warn(`[WARN] Asset ${a.asset_id} is not used by any slide`);
  return map;
}
export function assetManifestReport(map){return [...map.values()].map(({resolved_path,...a})=>a);}
