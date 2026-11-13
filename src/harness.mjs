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
const usage='Usage: node src/harness.mjs run --input presentation-ir.json --workspace <dir> [--preview true|false] [--allow-degraded-fallback true|false]\n       node src/harness.mjs status --workspace <dir> --job-id <id>\n       node src/harness.mjs review --workspace <dir> --job-id <id> --category science|visual --decision approve|changes_requested --reviewer "Name" --note "Review record" --artifact-sha256 <sha256> --reviewed-ids ID1,ID2';

async function main(){
  if(args.includes('--help')||args.includes('-h')){console.log(usage);return;}
  if(!['run','status','review'].includes(command))throw new Error(usage);
  const workspace=path.resolve(required('workspace')),store=await openProjectStore(workspace);
  try{
    if(command==='run'){
      const inputPath=path.resolve(required('input')),ir=JSON.parse(fs.readFileSync(inputPath,'utf8'));
      const project=store.createProject({title:arg('title')||ir.meta?.title||'AIAutoSlides Harness run',presentationIR:ir});
      const job=store.createJob(project.project_id,{preview:bool('preview',true),allow_degraded_fallback:bool('allow-degraded-fallback',true),input_sha256:crypto.createHash('sha256').update(fs.readFileSync(inputPath)).digest('hex')});
      store.setJob(job.job_id,{status:'running'});store.event(job.job_id,'job','running',{workflow:'presentation-harness'});
      try{
        const result=await runPresentationWorkflow({jobId:job.job_id,project,presentationIR:ir,workspace:store.root,outputDir:path.join(store.root,'runs',job.job_id),preview:job.options.preview,allowDegradedFallback:job.options.allow_degraded_fallback,onEvent:(stage,status,detail)=>store.event(job.job_id,stage,status,detail)});
        store.addArtifacts(job,result.artifacts);const saved={...result,artifacts:store.listArtifacts({jobId:job.job_id})};store.setJob(job.job_id,{status:result.status,result:saved});store.event(job.job_id,'job',result.status,{adapter:result.adapter,artifact_count:result.artifacts.length});
        console.log(JSON.stringify({job_id:job.job_id,status:result.status,review_context:result.review_context,artifacts:saved.artifacts},null,2));
      }catch(error){store.setJob(job.job_id,{status:'failed',error:error.message});store.event(job.job_id,'job','failed',{message:error.message});throw error;}
    }else if(command==='status'){
      const job=store.getJob(required('job-id'));if(!job)throw new Error('Job not found');console.log(JSON.stringify({job_id:job.job_id,status:job.status,error:job.error,result:job.result},null,2));
    }else{
      const jobId=required('job-id'),reviewed=store.reviewJob(jobId,{category:required('category'),decision:required('decision'),reviewer:required('reviewer'),note:required('note'),artifact_sha256:required('artifact-sha256'),reviewed_ids:list(arg('reviewed-ids'))});
      console.log(JSON.stringify({job_id:reviewed.job_id,status:reviewed.status,reviews:reviewed.result?.reviews},null,2));
    }
  }finally{store.close();}
}
main().catch(error=>{console.error(`[HARNESS ERROR] ${error.message}`);process.exitCode=1;});
