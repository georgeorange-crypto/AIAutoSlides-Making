import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createLocalApi} from '../packages/api/server.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'examples/phase1/pptxgenjs-ir.json'),'utf8'));
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');

test('local REST API persists projects, source blobs, slide edits, jobs, artifacts, and recovery state',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-api-'));let api;
  try{
    api=await createLocalApi({workspaceDir:workspace,preview:false});const address=await api.listen({port:0}),base=`http://127.0.0.1:${address.port}`;
    const ir=structuredClone(fixture);
    let response=await fetch(`${base}/projects`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'API fixture',presentation_ir:ir})});assert.equal(response.status,201);const project=(await response.json()).project;assert.ok(project.project_id);const initialHash=project.ir_sha256;
    response=await fetch(`${base}/projects/${project.project_id}/slides`);assert.equal(response.status,200);assert.equal((await response.json()).slides.length,3);
    response=await fetch(`${base}/projects/${project.project_id}/slides/S03`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({title:'A reviewed local edit'})});assert.equal(response.status,200);const edited=await response.json();assert.equal(edited.slide.title,'A reviewed local edit');assert.notEqual(edited.ir_sha256,initialHash);assert.equal(edited.render_required,true);
    const incoming=path.join(workspace,'incoming','sample.txt'),sourceBytes=Buffer.from('synthetic local source fixture\n');fs.writeFileSync(incoming,sourceBytes);
    response=await fetch(`${base}/projects/${project.project_id}/sources`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source_id:'E_PHASE1_SYN',file_path:incoming,type:'text'})});assert.equal(response.status,201);const source=(await response.json()).source;assert.equal(source.sha256,digest(sourceBytes));assert.equal(source.verification_status,'unverified');assert.equal(fs.readFileSync(path.join(workspace,'source-blobs',source.sha256)).toString(),sourceBytes.toString());
    const beforeBadEdit=(await fetch(`${base}/projects/${project.project_id}`)).status;assert.equal(beforeBadEdit,200);
    response=await fetch(`${base}/projects/${project.project_id}/slides/S03`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({title:''})});assert.equal(response.status,400);
    response=await fetch(`${base}/projects/${project.project_id}/jobs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({preview:false})});assert.equal(response.status,202);const jobId=(await response.json()).job.job_id;
    let job;for(let i=0;i<200;i++){response=await fetch(`${base}/jobs/${jobId}`);job=(await response.json()).job;if(['awaiting_review','failed','cancelled'].includes(job.status))break;await new Promise(resolve=>setTimeout(resolve,50));}
    assert.equal(job.status,'awaiting_review',job.error);assert.ok(job.events.some(event=>event.stage==='research-and-evidence-inventory'&&event.status==='completed'));assert.ok(job.events.some(event=>event.stage==='critic'&&event.status==='completed'));assert.deepEqual(job.result.review_context.required.visual,[]);
    response=await fetch(`${base}/jobs/${jobId}/artifacts`);const artifacts=(await response.json()).artifacts;assert.ok(artifacts.some(item=>item.format==='pptx'));assert.ok(artifacts.some(item=>item.format==='jsonl'));assert.ok(artifacts.some(item=>item.path.includes(`${path.sep}export${path.sep}`)));
    const pptx=artifacts.find(item=>item.format==='pptx');response=await fetch(`${base}/artifacts/${pptx.artifact_id}`);assert.equal(response.status,200);assert.equal(response.headers.get('x-content-sha256'),pptx.sha256);assert.ok((await response.arrayBuffer()).byteLength>1000);
    response=await fetch(`${base}/jobs/${jobId}/review`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({category:'visual',decision:'approve',reviewer:'Reviewer',note:'No rendered pages',artifact_sha256:pptx.sha256,reviewed_ids:[]})});assert.equal(response.status,409);
    const queued=api.store.createJob(project.project_id,{preview:false}),interrupted=api.store.createJob(project.project_id,{preview:false});api.store.setJob(interrupted.job_id,{status:'running'});await api.close();api=null;
    api=await createLocalApi({workspaceDir:workspace,preview:false});const recovered=api.store.getJob(interrupted.job_id);assert.equal(recovered.status,'failed');assert.match(recovered.error,/process restarted/);await api.listen({port:0});
    for(let i=0;i<200&&!['awaiting_review','failed','cancelled'].includes(api.store.getJob(queued.job_id).status);i++)await new Promise(resolve=>setTimeout(resolve,50));assert.equal(api.store.getJob(queued.job_id).status,'awaiting_review',api.store.getJob(queued.job_id).error);assert.ok(api.store.getProject(project.project_id));
  }finally{if(api)await api.close();fs.rmSync(workspace,{recursive:true,force:true});}
});

test('science and visual approval gates are hash-bound, complete, and independently required',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-review-api-'));let api;
  try{
    api=await createLocalApi({workspaceDir:workspace,preview:false});const address=await api.listen({port:0}),base=`http://127.0.0.1:${address.port}`;
    const response=await fetch(`${base}/projects`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Review gate fixture',presentation_ir:fixture})}),project=(await response.json()).project;
    const job=api.store.createJob(project.project_id),deckPath=path.join(workspace,'runs',job.job_id,'presentation.pptx');fs.mkdirSync(path.dirname(deckPath),{recursive:true});fs.writeFileSync(deckPath,'synthetic deck for review gate');const deckHash=digest(fs.readFileSync(deckPath));api.store.addArtifacts(job,[{path:deckPath,format:'pptx',sha256:deckHash}]);const context={deck_sha256:deckHash,required:{science:['E_PHASE1_SYN'],visual:['S01','S02']}};
    api.store.setJob(job.job_id,{status:'awaiting_review',result:{status:'awaiting_review',review_context:context,artifacts:[]}});
    const post=body=>fetch(`${base}/jobs/${job.job_id}/review`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),baseReview={reviewer:'Human Reviewer',note:'Checked the requested items',artifact_sha256:deckHash};
    let result=await post({...baseReview,category:'science',decision:'approve',reviewed_ids:[]});assert.equal(result.status,400);
    result=await post({...baseReview,category:'science',decision:'approve',reviewed_ids:['E_PHASE1_SYN']});assert.equal(result.status,200);assert.equal((await result.json()).job.status,'awaiting_review');
    result=await post({...baseReview,category:'visual',decision:'approve',artifact_sha256:'b'.repeat(64),reviewed_ids:['S01','S02']});assert.equal(result.status,409);
    result=await post({...baseReview,category:'visual',decision:'approve',reviewed_ids:['S01']});assert.equal(result.status,400);
    result=await post({...baseReview,category:'visual',decision:'approve',reviewed_ids:['S01','S02']});assert.equal(result.status,200);const complete=(await result.json()).job;assert.equal(complete.status,'completed');assert.equal(complete.result.reviews.science.decision,'approve');assert.equal(complete.result.reviews.visual.decision,'approve');
    assert.ok(complete.result.artifacts.some(item=>item.path.endsWith('human-review-science.json')));assert.ok(complete.result.artifacts.some(item=>item.path.endsWith('human-review-visual.json')));
  }finally{if(api)await api.close();fs.rmSync(workspace,{recursive:true,force:true});}
});

test('source importer rejects paths outside incoming and keeps content-addressed originals immutable',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-source-api-'));let api;
  try{
    api=await createLocalApi({workspaceDir:workspace,preview:false});const address=await api.listen({port:0}),base=`http://127.0.0.1:${address.port}`;
    const response=await fetch(`${base}/projects`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'Path boundary',presentation_ir:fixture})});const project=(await response.json()).project;
    const outside=path.join(workspace,'outside.txt');fs.writeFileSync(outside,'do not import');const bad=await fetch(`${base}/projects/${project.project_id}/sources`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source_id:'E_OUT',file_path:outside,type:'text'})});assert.equal(bad.status,403);
    const inside=path.join(workspace,'incoming','source.txt');fs.writeFileSync(inside,'immutable content');const ok=await fetch(`${base}/projects/${project.project_id}/sources`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({source_id:'E_IN',file_path:inside,type:'text'})});assert.equal(ok.status,201);const source=(await ok.json()).source;fs.writeFileSync(inside,'changed after import');assert.equal(fs.readFileSync(path.join(workspace,'source-blobs',source.sha256),'utf8'),'immutable content');
  }finally{if(api)await api.close();fs.rmSync(workspace,{recursive:true,force:true});}
});
