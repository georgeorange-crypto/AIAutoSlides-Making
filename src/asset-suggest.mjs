import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadAssetManifest} from './assets.mjs';

const stopWords=new Set(['about','after','also','from','into','that','their','there','these','this','with','would','should','using','used','over','under','for','and','the','are','was','were','will','can','has','have','not','but','our','your','its','than','then','through','between','across','within']);
function terms(value){return [...new Set(String(value||'').toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[])].filter(term=>!stopWords.has(term));}
function slideText(slide){return [slide.title,slide.assertion_title,slide.kicker,...(slide.body||[]),slide.speaker_notes].filter(Boolean).join(' ');}

export function suggestAssets(storyboard,assets){
  const records=[...assets.values()];
  return (storyboard.slides||[]).map(slide=>{
    const claimTerms=new Set(terms(slideText(slide)));
    const candidates=records.map(asset=>{
      const searchable=[asset.asset_id,asset.description,asset.alt_text,asset.title,...(Array.isArray(asset.keywords)?asset.keywords:[])].filter(Boolean).join(' ');
      const matchedTerms=terms(searchable).filter(term=>claimTerms.has(term));
      const flags=[];
      if(!asset.source?.trim())flags.push('missing_source');
      if(!asset.license?.trim())flags.push('missing_license');
      else flags.push('license_not_independently_validated');
      if(asset.verified!==true)flags.push('provenance_or_permission_not_human_verified');
      if(asset.rights_review_status&& !['approved','verified','cleared'].includes(String(asset.rights_review_status).toLowerCase()))flags.push('rights_review_pending');
      return {asset_id:asset.asset_id,score:matchedTerms.length,matched_terms:matchedTerms,source:asset.source||null,license:asset.license||null,rights_review_status:asset.rights_review_status||'not_recorded',verified:asset.verified===true,review_flags:flags};
    }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.asset_id.localeCompare(b.asset_id));
    return {slide_id:slide.slide_id||null,assertion:slide.assertion_title||slide.title||'',existing_asset_ids:(slide.visuals||[]).map(item=>item.asset_id),candidates,status:'suggestions_only_requires_human_review'};
  });
}

function usage(){console.log('Usage: node src/asset-suggest.mjs --storyboard <storyboard.json> --assets <manifest.json> --out <new-report.json>');}
const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const storyboardFile=value('--storyboard'),assetsFile=value('--assets'),out=value('--out');
  if(args.includes('--help'))usage();
  else if(!storyboardFile||!assetsFile||!out){usage();process.exitCode=2;}
  else{
    const deck=JSON.parse(fs.readFileSync(path.resolve(storyboardFile),'utf8'));
    const assets=loadAssetManifest(assetsFile,deck);
    const report={schema_version:1,method:'deterministic lexical overlap over assertion and optional asset description/alt_text/keywords; not semantic verification',generated_at:new Date().toISOString(),human_review_required:true,slides:suggestAssets(deck,assets)};
    const destination=path.resolve(out);if(fs.existsSync(destination))throw new Error(`Refusing to overwrite existing report: ${destination}`);
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    console.log(`Wrote ${report.slides.length} slide asset review(s) to ${destination}; suggestions are not applied and rights remain subject to human review.`);
  }
}
