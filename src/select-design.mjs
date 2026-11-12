#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createDesignProfile} from './design-profile.mjs';

const argv=process.argv.slice(2),arg=name=>{const i=argv.indexOf(`--${name}`);return i<0?null:argv[i+1];};
const galleryPath=arg('gallery'),theme=arg('theme'),reviewer=arg('reviewer'),out=arg('out'),confirm=arg('confirm');
if(!galleryPath||!theme||!reviewer||!out||confirm!=='yes'){console.log('Usage: node src/select-design.mjs --gallery outputs/theme-gallery/gallery.json --theme academic-light|tech-dark|keynote-minimal --reviewer "Name" --confirm yes --out docs/design.md');process.exit(process.argv.includes('--help')?0:2);}
try{
 const gallery=JSON.parse(fs.readFileSync(path.resolve(galleryPath),'utf8')),profile=createDesignProfile(gallery,theme,reviewer),target=path.resolve(out),tokenPath=target.replace(/\.md$/i,'-tokens.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(tokenPath,JSON.stringify(profile,null,2)+'\n');
 const coverPreview=path.relative(path.dirname(target),path.resolve(profile.preview.cover)).replaceAll('\\','/'),chartPreview=path.relative(path.dirname(target),path.resolve(profile.preview.chart)).replaceAll('\\','/');
 const md=[`# ${profile.name}`,'',`- Theme: **${theme}**`,`- Confirmed by: ${profile.confirmed_by}`,`- Confirmed at: ${profile.confirmed_at}`,`- Cover preview: \`${coverPreview}\``,`- Chart preview: \`${chartPreview}\``,`- Source storyboard SHA-256: \`${profile.source_storyboard_sha256}\``,'','## Confirmed design tokens','','```json',JSON.stringify(profile.tokens,null,2),'```','','## Layout principles','',...profile.layout_principles.map(x=>`- ${x}`),'','Edit the storyboard `meta.theme` to apply this profile. Reconfirm after changing visual direction.',''].join('\n');fs.writeFileSync(target,md);console.log(`Saved confirmed design profile -> ${target} and ${tokenPath}`);
}catch(error){console.error(`[ERROR] ${error.message}`);process.exit(1);}
