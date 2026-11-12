const clone=value=>JSON.parse(JSON.stringify(value));
const sourceNote=(entry)=>JSON.stringify(entry,null,2);
function chartSummary(slide){
  const c=slide.chart,series=c.series||[{name:c.series_name||'Series',values:c.values}],uncertainty=c.uncertainty;
  const method=uncertainty?`${uncertainty.method}; ${Math.round(uncertainty.confidence_level*100)}% CI; n is the independent run count.`:c.kind==='cdf'?'Empirical right-continuous CDF; tied observations advance together.':c.kind==='scatter'?'Each x/y pair maps to one source observation.':'Chart values map directly from the storyboard data.';
  return {slide_id:slide.slide_id,kind:c.kind,unit:c.unit,x_axis_label:c.x_axis_label||c.x_unit||null,y_axis_label:c.y_axis_label,sample_size:c.sample_size??null,categories:c.categories||null,x_values:c.x_values||null,raw_values:c.raw_values||null,series,uncertainty,method};
}
function figureRows(slide){
  const c=slide.chart,series=c.series||[{name:c.series_name||'Series',values:c.values}],unit=c.unit;
  if(c.uncertainty){const rows=[];for(let j=0;j<c.categories.length;j++){
    rows.push(`${c.categories[j]}: mean ${series[0].values[j]} ${unit}; 95% CI [${series[0].values[j]-series[0].error_minus[j]}, ${series[0].values[j]+series[0].error_plus[j]}]; independent runs n=${series[0].run_values[j].length}.`);
    rows.push(...series[0].run_values[j].map((v,i)=>`${series[0].run_ids[j][i]} · ${series[0].observation_ids[j][i]} · ${v} ${unit} · source row ${series[0].source_rows[j][i]}`));
  }return rows;}
  if(c.kind==='scatter')return c.x_values.map((x,i)=>`Observation ${i+1}: x=${x} ${c.x_unit}, y=${series[0].values[i]} ${unit}.`);
  if(c.kind==='cdf')return c.raw_values.map((v,i)=>`Raw observation ${i+1}: ${v} ${unit}.`);
  return c.categories.map((category,i)=>`${category}: ${series.map(s=>`${s.name} ${s.values[i]} ${unit}`).join('; ')}.`);
}

export function createTalkReadingDecks(storyboard,evidence){
  const talk=clone(storyboard),reading=clone(storyboard),sourceById=new Map(evidence.entries.map(e=>[e.id,e]));
  talk.meta.mode='talk';talk.meta.profile='talk';reading.meta.mode='reading';reading.meta.profile='reading';reading.meta.title=`${storyboard.meta.title} — Reading Edition`;
  const used=[...new Set(storyboard.slides.flatMap(s=>s.evidence_ids||[]))],appendix=[];
  const nextId=()=>`S${String(storyboard.slides.length+appendix.length+1).padStart(2,'0')}`;
  for(const id of used){const source=sourceById.get(id);if(!source)throw new Error(`Cannot create reading appendix: evidence ${id} is absent from ledger`);appendix.push({slide_id:nextId(),type:'statement',layout:'assertion-evidence',kicker:'SOURCE RECORD',title:`Evidence source ${id}`,body:[`${source.label} · ${source.verified?'verified':'unverified'}`,`Source: ${source.source} · full locator is in notes and the manifest.`],evidence_ids:[id],speaker_notes:`Evidence record ${id}\n${sourceNote(source)}`});}
  const chartSlides=storyboard.slides.filter(s=>s.type==='chart');
  for(const chartSlide of chartSlides){
    const summary=chartSummary(chartSlide),ids=chartSlide.evidence_ids||[];
    appendix.push({slide_id:nextId(),type:'statement',layout:'assertion-evidence',kicker:'FIGURE METHODS',title:`Figure methods: ${chartSlide.slide_id||chartSlide.title}`.slice(0,90),body:[`${summary.kind.toUpperCase()} · ${summary.unit} · sample size ${summary.sample_size??'not provided'}.`,`Method: ${summary.method} Axes: ${summary.x_axis_label?`${summary.x_axis_label}; `:''}${summary.y_axis_label}`],evidence_ids:ids,speaker_notes:`Figure summary and complete input values\n${JSON.stringify(summary,null,2)}`});
    const rows=figureRows(chartSlide),pages=Math.ceil(rows.length/5);
    for(let page=0;page<pages;page++){const section=rows.slice(page*5,(page+1)*5);appendix.push({slide_id:nextId(),type:'bullets',kicker:'FIGURE DATA',title:`Figure data: ${chartSlide.slide_id||'chart'} · ${page+1}/${pages}`.slice(0,90),body:section,evidence_ids:ids,speaker_notes:`Source slide: ${chartSlide.slide_id||''}\nFigure values shown on this page are copied or summarized deterministically from the storyboard chart inputs. Full chart input:\n${JSON.stringify(summary,null,2)}`});}
  }
  reading.slides=[...reading.slides,...appendix];
  return {talk,reading,appendixSlides:appendix.length,sourceIds:used};
}
