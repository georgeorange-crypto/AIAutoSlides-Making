import fs from 'node:fs';
import path from 'node:path';

const [sourceArg,outputArg]=process.argv.slice(2),source=path.resolve(sourceArg||'examples/from-markdown/research-outline.md'),output=path.resolve(outputArg||'outputs/markdown/storyboard.json');
const input=fs.readFileSync(source,'utf8'),parts=input.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/);
if(!parts)throw new Error('Markdown storyboard must start with frontmatter between --- lines');
function scalar(v){return v.trim().replace(/^(["'])(.*)\1$/,'$2');}
const meta={};for(const line of parts[1].split(/\r?\n/)){if(!line.trim())continue;const m=line.match(/^([a-z_]+):\s*(.*)$/);if(!m)throw new Error(`Invalid frontmatter line: ${line}`);meta[m[1]]=scalar(m[2]);}
if(!meta.title||!meta.audience||!meta.goal)throw new Error('Frontmatter requires title, audience, and goal');
for(const k of ['duration_minutes'])if(meta[k]!==undefined)meta[k]=Number(meta[k]);
const sections=parts[2].split(/^##\s+/m).filter(Boolean),slides=[];
for(const section of sections){
 const [head,...lines]=section.split(/\r?\n/),header=head.match(/^(S\d{2,3})\s+(cover|statement|bullets|closing)\s*$/);
 if(!header)throw new Error(`Slide heading must look like "## S01 statement": ${head}`);
 const slide={slide_id:header[1],type:header[2],evidence_ids:[]};let field=null;
 for(const line of lines){const h=line.match(/^###\s+(title|kicker|body|evidence_ids|speaker_notes|assertion_title)\s*$/);if(h){field=h[1];if(field==='body')slide.body=[];continue;}
  if(!field){if(line.trim())throw new Error(`Content outside a slide field in ${header[1]}`);continue;}
  if(field==='body'){if(line.trim().startsWith('- '))slide.body.push(scalar(line.trim().slice(2)));else if(line.trim())throw new Error(`Body entries in ${header[1]} must be Markdown list items`);continue;}
  const value=scalar(line);if(!value)continue;
  if(field==='evidence_ids')slide.evidence_ids.push(...value.split(',').map(x=>x.trim()).filter(Boolean));
  else slide[field]=slide[field]?`${slide[field]}\n${value}`:value;
 }
 if(!slide.title)throw new Error(`${header[1]} is missing ### title`);
 slides.push(slide);
}
const deck={meta:{...meta,theme:meta.theme||'academic-light',status:meta.status||'Markdown storyboard draft'},slides};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(deck,null,2)+'\n');
console.log(`Imported ${slides.length} Markdown slides into ${output}`);
