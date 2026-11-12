import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {assertValidPresentationIR} from '../core/validate-presentation.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const text=value=>typeof value==='string'?value:(typeof value==='number'?String(value):null);
const xmlText=value=>value.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&apos;',"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const html=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const mdCell=value=>text(value)!==null?html(text(value)).replaceAll('|','\\|').replace(/[\r\n]+/g,' '):'';
const noteSafe=value=>String(value||'').replaceAll('-->','--&gt;').replaceAll('<!','&lt;!');

function requireText(value,label) {
  if(typeof value!=='string'||!value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}
function oneLine(value,label) {return requireText(value,label).replace(/[\r\n]+/g,' ');}
function safeMarkdown(value) {
  return String(value).replaceAll('<','&lt;').replaceAll('>','&gt;').replace(/^([ \t]*)(---+|#{1,6}\s|```|<!--)/gm,'$1\\$2');
}

function renderElement(element,slideId,assetById) {
  const where=`${slideId}/${element.element_id}`;
  switch(element.kind) {
    case 'text': {
      const value=text(element.text??element.value);
      if(value===null) throw new Error(`${where}: text element requires text or string/number value`);
      return safeMarkdown(value);
    }
    case 'bullets': {
      if(!Array.isArray(element.items)||!element.items.length||element.items.some(item=>text(item)===null)) throw new Error(`${where}: bullets require a non-empty string/number items[]`);
      return element.items.map(item=>`- ${safeMarkdown(text(item).replace(/[\r\n]+/g,' '))}`).join('\n');
    }
    case 'table': {
      if(!Array.isArray(element.headers)||element.headers.length<2||!Array.isArray(element.rows)||!element.rows.length) throw new Error(`${where}: table requires headers[] and rows[]`);
      if(element.rows.some(row=>!Array.isArray(row)||row.length!==element.headers.length)) throw new Error(`${where}: every table row must match the header count`);
      return [`| ${element.headers.map(mdCell).join(' | ')} |`,`| ${element.headers.map(()=> '---').join(' | ')} |`,...element.rows.map(row=>`| ${row.map(mdCell).join(' | ')} |`)].join('\n');
    }
    case 'cards': {
      if(!Array.isArray(element.items)||element.items.length<2||element.items.length>4) throw new Error(`${where}: cards require 2–4 items`);
      for(const card of element.items) {requireText(card?.title,`${where} card title`);requireText(card?.body,`${where} card body`);}
      const cards=element.items.map(card=>`<div class="p-5 rounded border"><b>${html(card.title)}</b><br>${html(card.body)}</div>`).join('\n');
      return `<div class="grid grid-cols-${element.items.length} gap-4 mt-6">\n${cards}\n</div>`;
    }
    case 'callout': {
      const value=requireText(element.text??element.value,`${where} callout`);
      return `> **${html(value)}**`;
    }
    case 'image': {
      const asset=assetById.get(element.asset_id),uri=asset?.uri;
      if(!asset||typeof uri!=='string'||!uri.trim())throw new Error(`${where}: image requires an asset with a project-relative uri`);
      if(/^(?:https?:|data:|file:|\/|[a-z]:\\)/i.test(uri)||uri.replaceAll('\\','/').split('/').includes('..'))throw new Error(`${where}: Slidev image uri must be relative to the local project; remote and parent paths are not allowed`);
      if(asset.rights_status==='restricted')throw new Error(`${where}: restricted asset '${asset.asset_id}' cannot be embedded`);
      if(!['image/png','image/jpeg','image/svg+xml'].includes(asset.media_type))throw new Error(`${where}: unsupported image media_type '${asset.media_type}'`);
      const publicUri=uri.startsWith('public/')?`/${uri.slice('public/'.length)}`:uri;
      const left=(element.x/13.333*100).toFixed(3),top=(element.y/7.5*100).toFixed(3),width=(element.w/13.333*100).toFixed(3),height=(element.h/7.5*100).toFixed(3);
      return `<img src="${html(publicUri)}" alt="${html(element.alt)}" style="position:absolute;left:${left}%;top:${top}%;width:${width}%;height:${height}%;object-fit:contain" />`;
    }
    case 'process': {
      const steps=element.steps??element.items;
      if(!Array.isArray(steps)||steps.length<2||steps.length>6)throw new Error(`${where}: process requires 2–6 steps`);
      const cards=steps.map((step,index)=>{const title=typeof step==='string'?step:step?.title,detail=typeof step==='object'?step.detail:'';return `<div class="p-4 rounded border"><b>${String(index+1).padStart(2,'0')} · ${html(requireText(title,`${where} step title`))}</b>${detail?`<br>${html(detail)}`:''}</div>`;}).join('\n');
      return `<div class="grid grid-cols-${steps.length} gap-3 mt-6">\n${cards}\n</div>`;
    }
    case 'chart': {
      const kind=element.chart_kind,series=element.series;
      if(!['bar','line','scatter','cdf'].includes(kind))throw new Error(`${where}: chart_kind must be bar, line, scatter, or cdf`);
      if(!Array.isArray(series)||!series.length||!Array.isArray(element.x_values)||element.x_values.length<2||!element.x_axis_label||!element.y_axis_label)throw new Error(`${where}: chart requires x_values[], series[], and both axis labels`);
      if(series.some(s=>!s.name||!Array.isArray(s.values)||s.values.length!==element.x_values.length||s.values.some(v=>!Number.isFinite(v))))throw new Error(`${where}: every named series must align with x_values and contain finite numeric values`);
      const xs=element.x_values.map(Number);if(xs.some(v=>!Number.isFinite(v)))throw new Error(`${where}: x_values must be finite numbers`);
      if(kind==='cdf'&&xs.some((v,i)=>i&&v<xs[i-1]))throw new Error(`${where}: CDF x_values must be sorted`);
      if(kind==='cdf'&&series.some(s=>s.values.some((v,i)=>v<0||v>1||(i&&v<s.values[i-1]))))throw new Error(`${where}: CDF probabilities must be bounded in [0,1] and nondecreasing`);
      const width=1200,height=300,pad={l:102,r:28,t:38,b:48},x0=pad.l,x1=width-pad.r,y0=height-pad.b,y1=pad.t;
      const allY=series.flatMap(s=>s.values),minY=Math.min(0,...allY),maxY=Math.max(0,...allY),range=maxY-minY||1;
      const px=i=>x0+(xs.length===1?0:i*(x1-x0)/(xs.length-1)),py=v=>y0-(v-minY)*(y0-y1)/range,palette=['#2457C5','#D65A31','#16866B','#8556A3'];
      const marks=series.map((s,si)=>{const color=palette[si%palette.length];if(kind==='bar'){const bw=Math.max(4,(x1-x0)/xs.length*.55/series.length);return s.values.map((v,i)=>`<rect data-series="${html(s.name)}" data-x="${xs[i]}" data-y="${v}" x="${px(i)-bw*series.length/2+si*bw}" y="${py(Math.max(v,0))}" width="${bw*.86}" height="${Math.max(1,Math.abs(py(v)-py(0)))}" fill="${color}"/>`).join('');}const coords=[];for(let i=0;i<s.values.length;i++){if(kind==='cdf'&&i){coords.push(`${px(i)},${py(s.values[i-1])}`);}coords.push(`${px(i)},${py(s.values[i])}`);}const points=coords.join(' '),line=kind==='scatter'?'':`<polyline data-series="${html(s.name)}" data-values="${s.values.join(',')}" points="${points}" fill="none" stroke="${color}" stroke-width="3"/>`;return `${line}${s.values.map((v,i)=>`<circle data-x="${xs[i]}" data-y="${v}" cx="${px(i)}" cy="${py(v)}" r="4" fill="${color}"/>`).join('')}`;}).join('');
      const grid=[0,1,2,3,4].map(i=>{const y=y1+i*(y0-y1)/4,v=maxY-i*range/4;return `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="#D7DEE8"/><text x="${x0-8}" y="${y+4}" text-anchor="end" font-size="12">${v.toPrecision(3)}</text>`;}).join('');
      const ticks=xs.map((v,i)=>`<text x="${px(i)}" y="${y0+18}" text-anchor="middle" font-size="11">${html(String(v))}</text>`).join(''),legend=series.map((s,i)=>`<text x="${x0+i*180}" y="${height-6}" font-size="12" fill="${palette[i%palette.length]}">${html(s.name)}</text>`).join('');
      const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="300" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${html(element.x_axis_label)} by ${html(element.y_axis_label)}"><desc>${html(kind)} chart; source evidence IDs: ${(element.source_ids||[]).map(html).join(', ')}. Exact series values are also recorded in the lineage sidecar.</desc><text x="${x1}" y="18" text-anchor="end" font-size="12" font-weight="600">${html(element.y_axis_label)}</text>${grid}<line x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}" stroke="#24364B"/><line x1="${x0}" x2="${x0}" y1="${y1}" y2="${y0}" stroke="#24364B"/>${marks}${ticks}<text x="${(x0+x1)/2}" y="${height-28}" text-anchor="middle" font-size="12">${html(element.x_axis_label)}</text>${legend}</svg>`;
      const data=JSON.stringify({element_id:element.element_id,kind,x_values:xs,series:series.map(s=>({name:s.name,values:s.values})),source_ids:element.source_ids||[]});
      return `### ${html(element.title||kind+' chart')}\n\n<!-- AIAUTOSLIDES_CHART ${html(data)} -->\n\n${svg}`;
    }
    case 'mermaid': {
      const source=requireText(element.source,`${where} Mermaid source`);
      if(source.includes('```')) throw new Error(`${where}: Mermaid source cannot contain a Markdown fence`);
      return `\`\`\`mermaid\n${source}\n\`\`\``;
    }
    default: throw new Error(`${where}: unsupported Slidev IR element kind '${element.kind}'`);
  }
}

export function compilePresentationIR(ir) {
  const validation=assertValidPresentationIR(ir);
  const sources=ir.source_ir?.sources;
  const sourceById=new Map();
  for(const source of sources)sourceById.set(source.source_id,source);
  const evidenceById=new Map((ir.source_ir.evidence||[]).map(item=>[item.evidence_id,item]));
  const lineageSlides=[],markdownSlides=[],chartAudits=[],assetById=new Map((ir.assets||[]).map(asset=>[asset.asset_id,asset]));
  for(const slide of ir.slides) {
    const id=slide.slide_id;
    const title=oneLine(slide.title,`${id} title`);
    const evidenceIds=[...new Set(slide.evidence_ids)];
    const elements=slide.elements.map(element=>{
      const elementId=element.element_id;
      const sourceIds=element.source_ids??evidenceIds;
      return {...element,source_ids:[...new Set(sourceIds.length?sourceIds:evidenceIds)]};
    });
    const assertion=slide.assertion_title?`\n## ${html(oneLine(slide.assertion_title,`${id} assertion_title`))}\n`:'';
    const body=elements.map(element=>renderElement(element,id,assetById)).filter(Boolean).join('\n\n');
    const status=evidenceIds.map(evidenceId=>`${evidenceId}: ${sourceById.get(evidenceId)?.verification_status||evidenceById.get(evidenceId)?.verification_status}`).join('; ')||'none';
    const notes=noteSafe(slide.speaker_notes||'No speaker notes supplied.');
    const elementLineage=elements.map(element=>({element_id:element.element_id,...(element.kind==='image'?{asset_id:element.asset_id,alt:element.alt}:{}),source_ids:element.source_ids.length?element.source_ids:evidenceIds}));
    const elementMap=elementLineage.map(element=>`${element.element_id}=${element.source_ids.join(',')||'none'}`).join('; ');
    const comment=`<!--\nslide_id: ${id}\nevidence_ids: ${evidenceIds.join(', ')||'none'}\nverification: ${status}\nelement_sources: ${elementMap||'none'}\nSPEAKER NOTES: ${notes}\n-->`;
    markdownSlides.push([`# ${html(title)}`,assertion.trim(),body,comment].filter(Boolean).join('\n\n'));
    for(const element of elements.filter(item=>item.kind==='chart'))chartAudits.push({slide_id:id,element_id:element.element_id,kind:element.chart_kind,x_values:[...element.x_values],series:element.series.map(s=>({name:s.name,values:[...s.values]})),source_ids:[...new Set(element.source_ids)]});
    lineageSlides.push({slide_id:id,title,evidence_ids:evidenceIds,elements:elementLineage});
  }
  const deckTitle=oneLine(ir.meta.title||ir.slides[0].title,'meta.title');
  const frontmatter=['---','theme: default',`title: ${JSON.stringify(deckTitle)}`,`info: ${JSON.stringify('Generated from Presentation IR 1.0.0; evidence status is preserved, not verified.')}`,'---',''].join('\n');
  const markdown=frontmatter+markdownSlides.join('\n\n---\n\n')+'\n';
  const lineage={schema_version:'1.0.0',source_ir_sha256:hash(Buffer.from(JSON.stringify(ir))),sources:sources.map(source=>({source_id:source.source_id,type:source.type,uri:source.uri??null,sha256:source.sha256??null,locator:source.locator??null,verification_status:source.verification_status})),evidence:ir.source_ir.evidence||[],claims:ir.source_ir.claims||[],assets:(ir.assets||[]).map(asset=>({asset_id:asset.asset_id,uri:asset.uri??null,sha256:asset.sha256??null,media_type:asset.media_type,source_id:asset.source_id??null,license:asset.license??null,rights_status:asset.rights_status})),slides:lineageSlides,charts:chartAudits};
  const usedAssetIds=new Set(ir.slides.flatMap(slide=>slide.elements.filter(element=>element.kind==='image').map(element=>element.asset_id))),requiredAssets=(ir.assets||[]).filter(asset=>usedAssetIds.has(asset.asset_id)).map(asset=>({asset_id:asset.asset_id,uri:asset.uri,sha256:asset.sha256,media_type:asset.media_type,source_id:asset.source_id,license:asset.license,rights_status:asset.rights_status})),assetWarnings=requiredAssets.flatMap(asset=>[...(asset.rights_status==='approved'?[]:[`Asset ${asset.asset_id} rights status is ${asset.rights_status}; export does not establish permission.`]),...(!asset.license?[`Asset ${asset.asset_id} has no license metadata; verify reuse rights before distribution.`]:[])]);
  return {markdown,lineage,sourceIrSha256:lineage.source_ir_sha256,warnings:[...validation.warnings,...assetWarnings],requiredAssets};
}

export function verifyPptxLineage(pptxBytes,lineage) {
  if(!lineage||!Array.isArray(lineage.slides)||!lineage.slides.length) throw new Error('Lineage sidecar must contain a non-empty slides[] array');
  const files=unzipSync(new Uint8Array(pptxBytes));
  const notes=Object.keys(files).filter(name=>/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name)).sort((a,b)=>Number(a.match(/notesSlide(\d+)/)[1])-Number(b.match(/notesSlide(\d+)/)[1]));
  if(notes.length!==lineage.slides.length) throw new Error(`Lineage mismatch: PPTX has ${notes.length} notes slides, sidecar has ${lineage.slides.length} slides`);
  const checked=[];
  for(let index=0;index<lineage.slides.length;index++) {
    const expected=lineage.slides[index],xml=strFromU8(files[notes[index]]),textContent=[...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>xmlText(match[1])).join('\n'),lines=textContent.split(/\r?\n/),slideXml=files[`ppt/slides/slide${index+1}.xml`]?strFromU8(files[`ppt/slides/slide${index+1}.xml`]):'',slideText=[...slideXml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map(match=>xmlText(match[1]));
    const missing=[];
    if(!slideText.length) missing.push('editable slide text');
    if(expected.title&&!slideText.includes(expected.title)) missing.push(`slide title '${expected.title}'`);
    const slideLine=lines.find(line=>line.startsWith('slide_id:'))||'',slideValue=slideLine.slice('slide_id:'.length).split('|')[0].trim();
    if(slideValue!==expected.slide_id) missing.push(`slide_id ${expected.slide_id}`);
    const evidenceLine=lines.find(line=>line.startsWith('evidence_ids:'))||lines.find(line=>line.includes('evidence:'))||'';
    const evidenceValue=evidenceLine.startsWith('evidence_ids:')?evidenceLine.slice('evidence_ids:'.length).trim():evidenceLine.match(/(?:\||^)\s*evidence:\s*([^|]+)/)?.[1]?.trim()||'';
    const actualEvidence=new Set(evidenceValue==='none'||!evidenceValue?[]:evidenceValue.split(',').map(value=>value.trim()));
    for(const evidenceId of expected.evidence_ids||[]) if(!actualEvidence.has(evidenceId)) missing.push(`evidence_id ${evidenceId}`);
    if(Array.isArray(expected.elements)) {
      const elementLine=lines.find(line=>line.startsWith('element_sources:'))||'',actualElements=new Map(elementLine.slice('element_sources:'.length).split(';').map(pair=>pair.trim()).filter(Boolean).map(pair=>{const separator=pair.indexOf('=');return separator<0?[pair,'']:[pair.slice(0,separator),pair.slice(separator+1)];}));
      for(const element of expected.elements) {
        const actualSources=(actualElements.get(element.element_id)||'').split(',').map(value=>value.trim()).filter(Boolean);
        if(!actualElements.has(element.element_id)) missing.push(`element ${element.element_id}`);
        for(const sourceId of element.source_ids||[]) if(!actualSources.includes(sourceId)) missing.push(`element source ${element.element_id}/${sourceId}`);
      }
    }
    if(missing.length) throw new Error(`Lineage mismatch on slide ${expected.slide_id}: notes are missing ${missing.join(', ')}`);
    checked.push({slide_id:expected.slide_id,evidence_ids:expected.evidence_ids||[],element_count:expected.elements?.length||0,text_objects:slideText.length,notes_part:notes[index],status:'passed'});
  }
  return {status:'passed',slide_count:checked.length,slides:checked};
}
