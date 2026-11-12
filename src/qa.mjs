import fs from 'node:fs';
import path from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {auditThemeContrast} from './contrast.mjs';

const pptxPath=path.resolve(process.argv[2]||'outputs/research-demo.pptx'), stem=pptxPath.replace(/\.pptx$/i,'');
if(!fs.existsSync(pptxPath))throw new Error(`PPTX not found: ${pptxPath}`);
const files=unzipSync(new Uint8Array(fs.readFileSync(pptxPath)));
const presentationXml=strFromU8(files['ppt/presentation.xml']||new Uint8Array());
const slideSize=presentationXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
if(!slideSize)throw new Error('Cannot read PowerPoint slide dimensions');
const slideWidth=Number(slideSize[1]),slideHeight=Number(slideSize[2]);
const slideNames=Object.keys(files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
const chartNames=Object.keys(files).filter(n=>/^ppt\/charts\/chart\d+\.xml$/.test(n));
const embedded=Object.keys(files).filter(n=>/^ppt\/embeddings\/[^/]+\.xlsx$/i.test(n));
const slides=slideNames.map((name,i)=>{const xml=strFromU8(files[name]);const textBounds=[...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].filter(m=>/<a:t>/.test(m[1])).map(m=>{const off=m[1].match(/<a:off x="(\d+)" y="(\d+)"/),ext=m[1].match(/<a:ext cx="(\d+)" cy="(\d+)"/);if(!off||!ext)return{ok:false,reason:'missing geometry'};const x=Number(off[1]),y=Number(off[2]),w=Number(ext[1]),h=Number(ext[2]);return{ok:x>=0&&y>=0&&x+w<=slideWidth&&y+h<=slideHeight,x,y,w,h};});return{slide:i+1,editableText:(xml.match(/<a:t>/g)||[]).length,charts:(xml.match(/<c:chart\b/g)||[]).length,images:(xml.match(/<p:pic\b/g)||[]).length,textBounds,text:[...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m=>m[1].replaceAll('&amp;','&'))};});
const errors=[],warnings=[];let reviewTheme=null,expectedChartValues=[];
const cliReview=`${stem}.review.json`;
const buildReport=fs.existsSync(cliReview)?JSON.parse(fs.readFileSync(cliReview,'utf8')):null;
const slidePath=buildReport?.source?path.resolve(buildReport.source):null;
const evidencePath=buildReport?.evidence?path.resolve(buildReport.evidence):null;
let deckInput=null,ledgerInput=null;
if(slidePath&&evidencePath&&fs.existsSync(slidePath)&&fs.existsSync(evidencePath)){
 deckInput=JSON.parse(fs.readFileSync(slidePath,'utf8'));ledgerInput=JSON.parse(fs.readFileSync(evidencePath,'utf8'));
 expectedChartValues=deckInput.slides.filter(s=>s.type==='chart').flatMap(s=>s.chart.values);
}
else warnings.push('Build review report or its source inputs are missing; source completeness could not be checked');
if(slides.some(s=>!s.editableText))errors.push('At least one slide has no editable text');
slides.forEach(s=>{const outside=s.textBounds.filter(b=>!b.ok);if(outside.length)errors.push(`Slide ${s.slide} has ${outside.length} text shape(s) outside the slide bounds or with unreadable geometry`);});
if(expectedChartValues.length&&(!chartNames.length||!slides.some(s=>s.charts)))errors.push('Storyboard includes a chart but the PPTX has no native chart object');
if(expectedChartValues.length&&!embedded.length)warnings.push('No embedded chart workbook detected; inspect the chart in PowerPoint');
if(slides.some(s=>s.images>0))warnings.push('One or more slides include raster images; image-only status requires visual review');
if(fs.existsSync(cliReview)){
 const selected=JSON.parse(fs.readFileSync(cliReview,'utf8')).theme, themeFile=path.join('themes',`${selected}.json`);
 if(fs.existsSync(themeFile)){
  const t=JSON.parse(fs.readFileSync(themeFile,'utf8'));
  reviewTheme={name:selected,...auditThemeContrast(t)};
  if(reviewTheme.pairsBelowMinimum.length)errors.push(`Theme ${selected} has ${reviewTheme.pairsBelowMinimum.length} text/color token pairs below 4.5:1`);
 }
}
if(deckInput&&ledgerInput){
 if(slides.length!==deckInput.slides.length)errors.push(`PPTX slide count ${slides.length} does not match storyboard count ${deckInput.slides.length}`);
 const ids=new Set(ledgerInput.entries.map(e=>e.id));
 deckInput.slides.forEach((s,i)=>{if(s.type!=='cover'&&!s.evidence_ids?.length)errors.push(`Slide ${i+1} has no evidence IDs`);for(const id of s.evidence_ids||[])if(!ids.has(id))errors.push(`Slide ${i+1} refers to missing evidence ${id}`);if((s.title||'').length>90)warnings.push(`Slide ${i+1} title exceeds 90 characters; inspect wrapping`);for(const body of s.body||[])if(body.length>190)warnings.push(`Slide ${i+1} body line exceeds 190 characters; inspect wrapping`);});
 ledgerInput.entries.filter(e=>!e.verified).forEach(e=>warnings.push(`Evidence ${e.id} is unverified: ${e.note||e.locator||e.source}`));
}
const chartCacheValues=chartNames.flatMap(name=>[...strFromU8(files[name]).matchAll(/<c:numCache>[\s\S]*?<\/c:numCache>/g)].flatMap(m=>[...m[0].matchAll(/<c:v>(.*?)<\/c:v>/g)].map(v=>Number(v[1]))));
const workbookChartValues=embedded.flatMap(name=>{const book=unzipSync(files[name]);return Object.keys(book).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).flatMap(sheet=>[...strFromU8(book[sheet]).matchAll(/<c r="B(\d+)"[^>]*>([\s\S]*?)<\/c>/g)].filter(m=>Number(m[1])>1).map(m=>Number(m[2].match(/<v>(.*?)<\/v>/)?.[1])).filter(Number.isFinite));});
if(expectedChartValues.length){if(JSON.stringify(chartCacheValues)!==JSON.stringify(expectedChartValues))errors.push('Cached native chart values differ from storyboard data');if(JSON.stringify(workbookChartValues)!==JSON.stringify(expectedChartValues))errors.push('Embedded Excel chart values differ from storyboard data');}
const review={status:errors.length?'fail':warnings.length?'warning':'pass',scope:'PPTX structure, text-shape bounds, theme contrast, chart-value integrity, and source checks; rendered pixel fit requires manual review',pptx:pptxPath,aspectRatio:Number((slideWidth/slideHeight).toFixed(4)),slideCount:slides.length,editableTextSlideCount:slides.filter(s=>s.editableText>0).length,nativeChartCount:chartNames.length,embeddedChartWorkbookCount:embedded.length,chartData:{storyboardValues:expectedChartValues,chartCacheValues,embeddedWorkbookValues:workbookChartValues,exactMatch:JSON.stringify(chartCacheValues)===JSON.stringify(expectedChartValues)&&JSON.stringify(workbookChartValues)===JSON.stringify(expectedChartValues)},theme:reviewTheme||null,slides:slides.map(({text,textBounds,...s})=>({...s,textBoundsCount:textBounds.length,textBoundsPass:textBounds.every(b=>b.ok)})),errors,warnings,visualReview:{status:'unverifiable',reason:'Run npm run preview and inspect every rendered page; automated XML checks do not establish visual fit.'}};
fs.writeFileSync(`${stem}.qa.json`,JSON.stringify(review,null,2)+'\n');
const md=[`# Quality review: ${path.basename(pptxPath)}`,'',`**Status:** ${review.status}`,`**Slides:** ${review.slideCount}`,`**Aspect ratio:** ${review.aspectRatio}`,`**Editable-text slides:** ${review.editableTextSlideCount}`,`**Native chart objects:** ${review.nativeChartCount}`,`**Embedded workbooks:** ${review.embeddedChartWorkbookCount}`,`**Chart values exact match:** ${review.chartData.exactMatch}`,`**Minimum theme contrast:** ${review.theme?.minimumContrastRatio??'unavailable'}:1`,'','## Errors',...(errors.length?errors.map(x=>`- ${x}`):['- None']),'','## Warnings',...(warnings.length?warnings.map(x=>`- ${x}`):['- None']),'','## Visual review','- XML text-shape bounds checked; pixel-level font substitution, overlaps, and clipping still require human inspection of every rendered page.','','## Per-slide object counts',...slides.map(s=>`- Slide ${s.slide}: ${s.editableText} editable text runs, ${s.charts} chart frame(s), ${s.images} raster image(s), text bounds ${s.textBounds.every(b=>b.ok)?'pass':'fail'}`),''].join('\n');
fs.writeFileSync(`${stem}.qa.md`,md);
console.log(`QA ${review.status}: ${slides.length} slides, ${review.editableTextSlideCount} text-editable slides, ${review.nativeChartCount} native chart(s)`);
if(errors.length)process.exitCode=1;
