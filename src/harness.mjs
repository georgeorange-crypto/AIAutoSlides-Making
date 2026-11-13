#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {openProjectStore} from '../packages/api/store.mjs';
import {runPresentationWorkflow} from '../packages/workflow/index.mjs';

const args=process.argv.slice(2),command=args[0];
const arg=name=>{const index=args.indexOf(`--${name}`);return index<0?null:args[index+1]??null;};
const bool=(name,fallback)=>{const value=arg(name);if(value===null)return fallback;if(['true','false'].includes(value))return value==='true';throw new Error(`--${name} must be true or false`);};
const required=name=>{const value=arg(name);if(!value)throw new Error(`--${name} is required`);return value;};
const list=value=>value?value.split(',').map(item=>item.trim()).filter(Boolean):[];
const usage='Usage: node src/harness.mjs plan validate|approve|representative-approve --plan deck-plan.json [--reviewer "Name"] [--note "Review record"] [--artifact-sha256 <sha256>]\n       node src/harness.mjs run --input presentation-ir.json --workspace <dir> --task-type ppt --deck-plan approved-plan.json [--preview true|false] [--allow-degraded-fallback true|false]\n       node src/harness.mjs status --workspace <dir> --job-id <id>\n       node src/harness.mjs review --workspace <dir> --job-id <id> --category science|visual --decision approve|changes_requested --reviewer "Name" --note "Review record" --artifact-sha256 <sha256> --reviewed-ids ID1,ID2 [--page-reviews pages.json]';

async function main(){
  if(args.includes('--help')||args.includes('-h')){console.log(usage);return;}
  if(!['plan','run','status','review'].includes(command))throw new Error(usage);
  if(command==='plan'){
    const planPath=path.resolve(required('plan')),plan=JSON.parse(fs.readFileSync(planPath,'utf8'));
    const {validateDeckPlan,approveDeckPlan,approveRepresentativeSlides}=await import('../packages/workflow/deck-gate.mjs');
    if(args[1]==='validate'){const report=validateDeckPlan(plan);console.log(JSON.stringify(report,null,2));if(report.status!=='pass')process.exitCode=1;return;}
    if(args[1]==='approve'){const reviewer=required('reviewer'),note=required('note');const approved=approveDeckPlan(plan,{reviewer,note});fs.writeFileSync(planPath,`${JSON.stringify(approved,null,2)}\n`);console.log(JSON.stringify({plan:planPath,status:approved.approval.status,plan_sha256:approved.approval.plan_sha256,reviewer:approved.approval.reviewer},null,2));return;}
    if(args[1]==='representative-approve'){const updated=approveRepresentativeSlides(plan,{reviewer:required('reviewer'),note:required('note'),artifact_sha256:required('artifact-sha256')});fs.writeFileSync(planPath,`${JSON.stringify(updated,null,2)}\n`);console.log(JSON.stringify({plan:planPath,status:'representative-approved',artifact_sha256:updated.representative_review.artifact_sha256},null,2));return;}
    throw new Error(usage);
  }
  const workspace=path.resolve(required('workspace')),store=await openProjectStore(workspace);
  try{
    if(command==='run'){
      const inputPath=path.resolve(required('input')),ir=JSON.parse(fs.readFileSync(inputPath,'utf8'));
      let deckPlan=null;
      if(arg('deck-plan')){const {assertApprovedDeckPlan}=await import('../packages/workflow/deck-gate.mjs');deckPlan=JSON.parse(fs.readFileSync(path.resolve(arg('deck-plan')),'utf8'));assertApprovedDeckPlan(deckPlan,ir);}
      else if(arg('task-type')==='ppt')throw new Error('PPT tasks require --deck-plan with a structurally valid and approved plan.');
      const project=store.createProject({title:arg('title')||ir.meta?.title||'AIAutoSlides Harness run',presentationIR:ir});
      const job=store.createJob(project.project_id,{preview:bool('preview',true),allow_degraded_fallback:bool('allow-degraded-fallback',true),input_sha256:crypto.createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex'),...(deckPlan?{deck_task:true,deck_plan_sha256:deckPlan.approval.plan_sha256,deck_plan:deckPlan}: {})});
      store.setJob(job.job_id,{status:'running'});store.event(job.job_id,'job','running',{workflow:'presentation-harness'});
      try{
        const result=await runPresentationWorkflow({jobId:job.job_id,project,presentationIR:ir,qualityPlan:deckPlan,workspace:store.root,outputDir:path.join(store.root,'runs',job.job_id),preview:job.options.preview,allowDegradedFallback:job.options.allow_degraded_fallback,onEvent:(stage,status,detail)=>store.event(job.job_id,stage,status,detail)});
        store.addArtifacts(job,result.artifacts);const saved={...result,artifacts:store.listArtifacts({jobId:job.job_id})};store.setJob(job.job_id,{status:result.status,result:saved});store.event(job.job_id,'job',result.status,{adapter:result.adapter,artifact_count:result.artifacts.length});
        console.log(JSON.stringify({job_id:job.job_id,status:result.status,review_context:result.review_context,artifacts:saved.artifacts},null,2));
      }catch(error){store.setJob(job.job_id,{status:'failed',error:error.message});store.event(job.job_id,'job','failed',{message:error.message});throw error;}
    }else if(command==='status'){
      const job=store.getJob(required('job-id'));if(!job)throw new Error('Job not found');console.log(JSON.stringify({job_id:job.job_id,status:job.status,error:job.error,result:job.result},null,2));
    }else{
      const pageReviews=arg('page-reviews')?JSON.parse(fs.readFileSync(path.resolve(arg('page-reviews')),'utf8')):undefined;
      const jobId=required('job-id'),reviewed=store.reviewJob(jobId,{category:required('category'),decision:required('decision'),reviewer:required('reviewer'),note:required('note'),artifact_sha256:required('artifact-sha256'),reviewed_ids:list(arg('reviewed-ids')),...(pageReviews?{page_reviews:pageReviews}:{})});
      console.log(JSON.stringify({job_id:reviewed.job_id,status:reviewed.status,reviews:reviewed.result?.reviews},null,2));
    }
  }finally{store.close();}
}
main().catch(error=>{console.error(`[HARNESS ERROR] ${error.message}`);process.exitCode=1;});
