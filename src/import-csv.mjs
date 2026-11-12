import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {empiricalCdfStep} from './statistics.mjs';

const args=process.argv.slice(2), input=path.resolve(args[0]||'examples/from-csv/synthetic-latency.csv'), output=path.resolve(args[1]||'outputs/synthetic-csv/storyboard.json'), chartKind=args[2]||'bar';
const allowUnverifiedLocal=args.includes('--allow-unverified-local');
if(!['bar','line','scatter','cdf'].includes(chartKind))throw new Error('chartKind must be bar, line, scatter, or cdf');
function parseCsv(text){
  text=text.replace(/^#.*(?:\r?\n|$)/,'');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;
  }
  if(quoted)throw new Error('CSV contains an unterminated quoted field');
  if(cell.length||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  const [headers,...data]=rows;
  if(!headers||data.some(r=>r.length!==headers.length))throw new Error('CSV rows must match the header column count');
  const normalizedHeaders=headers.map(h=>h==='condition'&&!headers.includes('category')?'category':h);
  return data.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(normalizedHeaders.map((h,i)=>[h,r[i]])));
}
const csv=fs.readFileSync(input,'utf8');
const synthetic=/SYNTHETIC/i.test(csv.slice(0,300));
if(!synthetic&&!allowUnverifiedLocal)throw new Error('CSV must explicitly label itself SYNTHETIC, or pass --allow-unverified-local for a user-supplied local dataset; the resulting evidence remains unverified');
const rows=parseCsv(csv), unit=rows[0]?.unit, isScatter=chartKind==='scatter', isCdf=chartKind==='cdf', pointChart=isScatter||isCdf;
const maxRows=pointChart?200:54;
if(rows.length<2||rows.length>maxRows)throw new Error(`CSV workflow requires 2–${maxRows} rows for ${chartKind}`);
if(!unit||rows.some(r=>!Number.isFinite(Number(r.value))||r.unit!==unit))throw new Error('CSV requires finite numeric values and one consistent unit column');
if(chartKind==='bar'&&rows.some(r=>Number(r.value)<0))throw new Error('Bar chart values must be nonnegative and use a zero baseline');
let chart, sampleSize, categoryCount;
if(isScatter){
  const xUnit=rows[0]?.x_unit;
  if(!xUnit||rows.some(r=>!Number.isFinite(Number(r.x))||r.x_unit!==xUnit))throw new Error('Scatter CSV requires finite x, x_unit, and consistent unit columns');
  chart={kind:'scatter',unit,x_unit:xUnit,x_axis_label:`X (${xUnit})`,y_axis_label:`Y (${unit})`,x_values:rows.map(r=>Number(r.x)),values:rows.map(r=>Number(r.value))};
  sampleSize=rows.length;categoryCount=rows.length;
}else if(isCdf){
  const raw_values=rows.map(r=>Number(r.value)),step=empiricalCdfStep(raw_values);
  chart={kind:'cdf',unit,x_unit:unit,x_axis_label:`Observed value (${unit})`,y_axis_label:'Empirical cumulative probability',raw_values,...step,sample_size:raw_values.length};
  sampleSize=raw_values.length;categoryCount=raw_values.length;
}else{
  if(rows.some(r=>!r.category))throw new Error('Bar/line CSV requires a category column');
  const categories=[...new Set(rows.map(r=>r.category))],seriesNames=[...new Set(rows.map(r=>r.series||'Observed'))];
  if(categories.length<2||categories.length>9||seriesNames.length>6||categories.length*seriesNames.length!==rows.length)throw new Error('Bar/line CSV requires 2–9 categories, 1–6 series, and exactly one row per category/series pair');
  const series=seriesNames.map(name=>{
    const subset=rows.filter(r=>(r.series||'Observed')===name);
    if(subset.some(r=>!Number.isInteger(Number(r.sample_n))||Number(r.sample_n)<1))throw new Error('Each bar/line row needs positive integer sample_n');
    return{name,values:categories.map(cat=>{const found=subset.find(r=>r.category===cat);if(!found)throw new Error(`Missing category ${cat} for series ${name}`);return Number(found.value);})};
  });
  chart={kind:chartKind,unit,y_axis_label:`Value (${unit})`,categories,series};
  sampleSize=Math.min(...rows.map(r=>Number(r.sample_n)));categoryCount=categories.length;
}
chart.sample_size=sampleSize;
const hash=crypto.createHash('sha256').update(csv).digest('hex');
const evidenceId=synthetic?'E_SYN1':'E_CSV1',evidenceLabel=synthetic?'Synthetic chart teaching dataset':'User-supplied local CSV';
const evidence={entries:[{id:evidenceId,label:evidenceLabel,source:path.relative(process.cwd(),input).replaceAll('\\','/'),locator:`CSV rows 2–${rows.length+1}; SHA-256 ${hash}`,verified:false,note:synthetic?'Synthetic values for demonstrating the import pipeline; not experimental evidence.':'Local source was parsed deterministically, but provenance and scientific meaning have not been independently verified.'}]};
const qualifier=synthetic?'Synthetic':'Local unverified',deck={meta:{title:'From CSV to an editable research talk',subtitle:synthetic?'Synthetic teaching data · no empirical claim':'User-supplied data · verification pending',audience:'Research group',audience_profile:'research_group',mode:'talk',goal:'Demonstrate a traceable data-to-slide workflow',duration_minutes:7,theme:'academic-light',status:synthetic?'SYNTHETIC DEMO — NOT RESEARCH EVIDENCE':'LOCAL DATA — SOURCE VERIFICATION PENDING',data_status:synthetic?'synthetic':'unverified-local',aspect_ratio:'16:9'},slides:[
 {slide_id:'S01',type:'cover',kicker:`${qualifier.toUpperCase()} WORKFLOW`,title:'A CSV can produce an editable, traceable slide deck',body:[synthetic?'Synthetic example only — values are not experimental results.':'Local values remain unverified until compared with their original records.'],evidence_ids:[evidenceId],speaker_notes:synthetic?'State clearly that the dataset is synthetic.':'State that source provenance and scientific verification are pending.'},
 {slide_id:'S02',type:'statement',layout:'assertion-evidence',kicker:'WORKFLOW',title:'Keep the data source attached to every quantitative claim',body:['CSV rows become chart values without an AI-generated numeric step.'],evidence_ids:[evidenceId],speaker_notes:'Describe the deterministic transformation.'},
 {slide_id:'S03',type:'metrics',layout:'metric-focus',kicker:'DATA SNAPSHOT',title:'The input contains labeled source observations',metrics:[{label:'Categories / points',value:String(categoryCount),detail:'Source rows'},{label:'Sample size',value:String(sampleSize),detail:'From source rows'},{label:'Unit',value:unit,detail:'From CSV'}],evidence_ids:[evidenceId]},
 {slide_id:'S04',type:'chart',layout:'chart-and-takeaway',kicker:'SOURCE DATA',title:isCdf?'The empirical CDF is calculated from sorted source rows':`${qualifier} values are read directly from the CSV`,assertion_title:isCdf?'The plotted right-continuous step counts tied observations together':'The plotted values map 1:1 to the source rows',chart,evidence_ids:[evidenceId],body:[synthetic?'Synthetic teaching values; not a measured result.':'Values are source-linked; their meaning and provenance remain unverified.'],speaker_notes:isCdf?'Raw values are sorted and ties grouped. Each right-continuous ECDF step is cumulative count divided by the raw observation count.':'Describe the deterministic transformation.'},
 {slide_id:'S05',type:'statement',layout:'two-column-contrast',kicker:'INTERPRETATION',title:synthetic?'A pipeline demo does not establish a scientific finding':'A local data import does not establish a scientific finding',body:['What this verifies: deterministic CSV parsing and chart generation.','What this does not verify: source authenticity, protocol, or causal interpretation.'],evidence_ids:[evidenceId]},
 {slide_id:'S06',type:'process',kicker:'PROVENANCE',title:'Each output can be traced to a specific source file',steps:['CSV input','Schema checks','Evidence ID','Native chart','QA report'],body:[`Source SHA-256: ${hash.slice(0,16)}…`],evidence_ids:[evidenceId]},
 {slide_id:'S07',type:'bullets',kicker:'LIMITS',title:'Verify source data before drawing a research conclusion',body:['Compare values with the original records and measurement protocol','Confirm units, sample counts, aggregation and missing values','Review the chart and source lineage before presenting'],evidence_ids:[evidenceId]},
 {slide_id:'S08',type:'closing',kicker:'NEXT STEP',title:synthetic?'Replace the demo rows with an audited experiment export':'Verify the source records before using this chart',body:['The workflow stays offline and generates an editable PowerPoint chart.'],evidence_ids:[evidenceId],speaker_notes:synthetic?'Do not reuse the synthetic values in research claims.':'Do not present these rows as verified evidence until checked.'}
]};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(deck,null,2)+'\n');
fs.writeFileSync(output.replace(/\.json$/,'-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(`Imported ${rows.length} synthetic rows into ${output}`);
