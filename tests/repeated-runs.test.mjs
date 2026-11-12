import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {unzipSync,strFromU8,zipSync,strToU8} from 'fflate';
import {studentTMeanInterval} from '../src/statistics.mjs';
import {validateDeck,loadEvidence} from '../src/validate.mjs';
import {patchPptxErrorBars} from '../src/chart-error-bars.mjs';

const values=[8,9,10,11,12,13,14,15,16,17];
test('Student-t mean intervals use the correct degrees of freedom and require independent-run minimum',()=>{
 const a=studentTMeanInterval(values),b=studentTMeanInterval([...values].reverse()),sd=Math.sqrt(values.reduce((s,v)=>s+(v-12.5)**2,0)/9);
 assert.deepEqual(a,b);assert.equal(a.mean,12.5);assert.ok(a.lower<=a.mean&&a.mean<=a.upper);assert.equal(a.n,10);assert.ok(Math.abs(a.error_plus-2.2621571627409915*sd/Math.sqrt(10))<1e-8);assert.throws(()=>studentTMeanInterval(values.slice(0,9)),/at least 10/);
});

test('synthetic repeated-run CSV creates a validated run-level storyboard',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-runs-')),out=path.join(dir,'storyboard.json');
 try{const r=spawnSync(process.execPath,['src/import-repeated.mjs','examples/from-csv/synthetic-repeated-runs.csv',out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const deck=JSON.parse(fs.readFileSync(out,'utf8')),evidence=loadEvidence(out.replace(/\.json$/,'-evidence.json')),result=validateDeck(deck,evidence);assert.deepEqual(result.errors,[]);const c=deck.slides[3].chart;assert.equal(c.uncertainty.independent_unit,'run_id');assert.equal(c.series[0].run_values[0].length,10);assert.equal(c.series[0].values[0],studentTMeanInterval(c.series[0].run_values[0]).mean);assert.match(evidence.entries[0].locator,/SHA-256 [a-f0-9]{64}/);const bad=JSON.parse(JSON.stringify(deck));bad.slides[3].chart.series[0].values[0]+=1;assert.match(validateDeck(bad,evidence).errors.join(' '),/does not match raw run_values/);const badIds=JSON.parse(JSON.stringify(deck));badIds.slides[3].chart.series[0].run_ids[1][0]=badIds.slides[3].chart.series[0].run_ids[0][0];assert.match(validateDeck(badIds,evidence).errors.join(' '),/unique across all conditions/);
  const userCsv=path.join(dir,'user.csv');fs.writeFileSync(userCsv,fs.readFileSync('examples/from-csv/synthetic-repeated-runs.csv','utf8').replace(/^#.*\r?\n/,'').replace('baseline-01','user-run-01'));const userOut=path.join(dir,'user-storyboard.json'),user=spawnSync(process.execPath,['src/import-repeated.mjs',userCsv,userOut],{encoding:'utf8'});assert.equal(user.status,0,user.stderr);const userDeck=JSON.parse(fs.readFileSync(userOut,'utf8'));assert.equal(userDeck.meta.data_status,'user-supplied-unverified');assert.equal(loadEvidence(userOut.replace(/\.json$/,'-evidence.json')).entries[0].verified,false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('native PowerPoint error bars serialize custom asymmetric intervals',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-errorbars-')),file=path.join(dir,'deck.pptx');
 try{fs.writeFileSync(file,zipSync({'ppt/charts/chart1.xml':strToU8('<c:chartSpace><c:chart><c:plotArea><c:barChart><c:ser><c:idx val="0"/><c:cat></c:cat><c:val></c:val></c:ser></c:barChart></c:plotArea></c:chart></c:chartSpace>')}));const deck={slides:[{type:'chart',chart:{kind:'bar',series:[{name:'mean',values:[12],error_minus:[1.25],error_plus:[2.5]}]}}]};assert.equal(patchPptxErrorBars(file,deck),1);const xml=strFromU8(unzipSync(new Uint8Array(fs.readFileSync(file)))['ppt/charts/chart1.xml']);assert.match(xml,/<c:errDir val="y"\/><c:errBarType val="both"\/><c:errValType val="cust"\/>/);assert.match(xml,/<c:plus><c:numLit>[\s\S]*?<c:v>2\.5<\/c:v>/);assert.match(xml,/<c:minus><c:numLit>[\s\S]*?<c:v>1\.25<\/c:v>/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
