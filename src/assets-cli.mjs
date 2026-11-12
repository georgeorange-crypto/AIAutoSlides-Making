import {loadAssetManifest,assetManifestReport} from './assets.mjs';
const file=process.argv.slice(2).find(value=>value!=='--');
if(!file||process.argv.includes('--help')){console.log('Usage: node src/assets-cli.mjs <asset-manifest.json>');process.exit(file?0:2);}
const assets=loadAssetManifest(file,{});
console.log(`Asset manifest valid: ${assets.size} local images`);
