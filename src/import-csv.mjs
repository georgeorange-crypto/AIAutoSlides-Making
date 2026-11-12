import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const args=process.argv.slice(2), input=path.resolve(args[0]||'examples/from-csv/synthetic-latency.csv'), output=path.resolve(args[1]||'outputs/synthetic-csv/storyboard.json'), chartKind=args[2]||'bar';
if(!['bar','line'].includes(chartKind))throw new Error('chartKind must be bar or line');
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
  return data.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
}
const csv=fs.readFileSync(input,'utf8');
if(!/SYNTHETIC/i.test(csv.slice(0,300)))throw new Error('CSV must explicitly label itself SYNTHETIC in its first 300 characters');
const rows=parseCsv(csv), unit=rows[0]?.unit;
if(rows.length<2||rows.length>9)throw new Error('CSV workflow requires 2–9 categories');
if(!unit||rows.some(r=>!r.category||!Number.isFinite(Number(r.value))||Number(r.value)<0||r.unit!==unit))throw new Error('CSV requires category, nonnegative numeric value, and consistent unit columns');
const sampleSizes=rows.map(r=>Number(r.sample_n));
if(sampleSizes.some(n=>!Number.isInteger(n)||n<1))throw new Error('CSV sample_n must be a positive integer for every row');
const hash=crypto.createHash('sha256').update(csv).digest('hex');
const evidence={entries:[{id:'E_SYN1',label:'Synthetic latency teaching dataset',source:path.relative(process.cwd(),input).replaceAll('\\','/'),locator:`CSV rows 2–${rows.length+1}; SHA-256 ${hash}`,verified:false,note:'Synthetic values for demonstrating the import pipeline; not experimental evidence.'}]};
const names=rows.map(r=>r.category), values=rows.map(r=>Number(r.value)), n=Math.min(...sampleSizes);
const deck={meta:{title:'From CSV to an editable research talk',subtitle:'Synthetic teaching data · no empirical claim',audience:'Research group',audience_profile:'research_group',mode:'talk',goal:'Demonstrate a traceable data-to-slide workflow',duration_minutes:7,theme:'academic-light',status:'SYNTHETIC DEMO — NOT RESEARCH EVIDENCE',data_status:'synthetic',aspect_ratio:'16:9'},slides:[
 {slide_id:'S01',type:'cover',kicker:'SYNTHETIC WORKFLOW',title:'A CSV can produce an editable, traceable slide deck',body:['Synthetic example only — values are not experimental results.'],evidence_ids:['E_SYN1'],speaker_notes:'State clearly that the dataset is synthetic.'},
 {slide_id:'S02',type:'statement',layout:'assertion-evidence',kicker:'WORKFLOW',title:'Keep the data source attached to every quantitative claim',body:['CSV rows become chart values without an AI-generated numeric step.'],evidence_ids:['E_SYN1'],speaker_notes:'Describe the deterministic transformation.'},
 {slide_id:'S03',type:'metrics',layout:'metric-focus',kicker:'DATA SNAPSHOT',title:'The example contains three labeled conditions',metrics:[{label:'Categories',value:String(rows.length),detail:'Synthetic rows'},{label:'Minimum n',value:String(n),detail:'Per category'},{label:'Unit',value:unit,detail:'From CSV'}],evidence_ids:['E_SYN1']},
 {slide_id:'S04',type:'chart',layout:'chart-and-takeaway',kicker:'SOURCE DATA',title:'Synthetic values are read directly from the CSV',assertion_title:'The plotted values map 1:1 to the source rows',chart:{kind:chartKind,unit,y_axis_label:`Value (${unit})`,sample_size:n,categories:names,values,series_name:'Synthetic demo'},body:['Synthetic teaching values; not a measured result.'],evidence_ids:['E_SYN1']},
 {slide_id:'S05',type:'statement',layout:'two-column-contrast',kicker:'INTERPRETATION',title:'A pipeline demo does not establish a scientific finding',body:['What this verifies: deterministic CSV parsing and chart generation.','What this does not verify: any real system behavior or causal explanation.'],evidence_ids:['E_SYN1']},
 {slide_id:'S06',type:'process',kicker:'PROVENANCE',title:'Each output can be traced to a specific source file',steps:['CSV input','Schema checks','Evidence ID','Native chart','QA report'],body:[`Source SHA-256: ${hash.slice(0,16)}…`],evidence_ids:['E_SYN1']},
 {slide_id:'S07',type:'bullets',kicker:'LIMITS',title:'Use verified data before drawing a research conclusion',body:['Replace the synthetic CSV with measured data and stable run IDs','Confirm units, sample counts, aggregation and missing values','Review the chart and source lineage before presenting'],evidence_ids:['E_SYN1']},
 {slide_id:'S08',type:'closing',kicker:'NEXT STEP',title:'Replace the demo rows with an audited experiment export',body:['The workflow stays offline and generates an editable PowerPoint chart.'],evidence_ids:['E_SYN1'],speaker_notes:'Do not reuse the synthetic values in research claims.'}
]};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(deck,null,2)+'\n');
fs.writeFileSync(output.replace(/\.json$/,'-evidence.json'),JSON.stringify(evidence,null,2)+'\n');
console.log(`Imported ${rows.length} synthetic rows into ${output}`);
