#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=path.join(root,'examples/open-source-bakeoff/ai-plan');
const outDir=path.resolve(process.argv.includes('--out-dir')?process.argv[process.argv.indexOf('--out-dir')+1]:'outputs/open-source-bakeoff/ai-plan-api-poc');
const storyboard=path.join(outDir,'storyboard.json');
const expectedOutputs=[storyboard,`${storyboard}.review.json`,`${storyboard}.review.md`,path.join(outDir,'api-test-report.json')];
const existingOutput=expectedOutputs.find(file=>fs.existsSync(file));
if(existingOutput)throw new Error(`Refusing to overwrite existing POC output: ${existingOutput}`);
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
const syntheticResponse=readJson(path.join(fixture,'response.json'));
const briefFile=path.join(fixture,'brief.md'),evidenceFile=path.join(fixture,'evidence.json');
const brief=fs.readFileSync(briefFile,'utf8'),ledger=readJson(evidenceFile);
let captured=null;
const server=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  try{
    if(req.method!=='POST'||req.url!=='/v1/responses')throw new Error('Unexpected test endpoint or method');
    captured={authorization:req.headers.authorization,content_type:req.headers['content-type'],payload:JSON.parse(Buffer.concat(chunks).toString('utf8'))};
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({id:'resp_synthetic_test',output_text:JSON.stringify(syntheticResponse)}));
  }catch(error){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:error.message}}));}
});

function runNode(args,env={},timeout=30000){
  return new Promise(resolve=>{
    const child=spawn(process.execPath,args,{cwd:root,windowsHide:true,env:{...process.env,...env}});
    let stdout='',stderr='';child.stdout.setEncoding('utf8').on('data',value=>stdout+=value);child.stderr.setEncoding('utf8').on('data',value=>stderr+=value);
    const timer=setTimeout(()=>child.kill(),timeout);
    child.on('error',error=>{clearTimeout(timer);resolve({status:null,error,stdout,stderr});});
    child.on('close',status=>{clearTimeout(timer);resolve({status,stdout,stderr});});
  });
}

async function main(){
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const endpoint=`http://127.0.0.1:${server.address().port}/v1/responses`;
  const env={NODE_ENV:'test',OPENAI_API_KEY:'synthetic-test-key',OPENAI_MODEL:'synthetic-contract-model',AIAUTOSLIDES_TEST_RESPONSES_URL:endpoint};
  fs.mkdirSync(outDir,{recursive:true});
  try{
    const plan=await runNode(['src/ai-plan.mjs','--input',briefFile,'--evidence',evidenceFile,'--out',storyboard,'--audience','research_group','--duration','7','--goal','Test the local synthetic API contract'],env);
    if(plan.status!==0)throw new Error(plan.error?.message||plan.stderr||`Planner exited ${plan.status}`);
    if(!captured)throw new Error('The local stub did not receive an API request');
    if(captured.payload.model!==env.OPENAI_MODEL||captured.payload.text?.format?.type!=='json_schema'||captured.payload.text.format.strict!==true)throw new Error('Planner request did not match the strict JSON-schema Responses contract');
    if(!captured.payload.input?.[0]?.content?.includes('Permitted evidence IDs: E_SYN'))throw new Error('Evidence IDs were not passed to the planner policy');
    if(!captured.payload.input?.[1]?.content?.includes(brief.trim()))throw new Error('Synthetic brief was not passed to the planner');
    const validation=await runNode(['src/cli.mjs','validate','--input',storyboard,'--evidence',evidenceFile]);
    if(validation.status!==0)throw new Error(validation.stderr||validation.stdout||`Draft validation exited ${validation.status}`);
    const buildOut=path.join(outDir,'must-remain-unbuilt.pptx');
    const blockedBuild=await runNode(['src/cli.mjs','build','--input',storyboard,'--evidence',evidenceFile,'--out',buildOut]);
    if(blockedBuild.status===0||!blockedBuild.stderr.includes('record a human approval')||fs.existsSync(buildOut))throw new Error('AI draft did not remain behind the human-review build gate');
    const responseBytes=fs.readFileSync(path.join(fixture,'response.json'));
    const report={
      schema_version:1,status:'passed_local_mock_api_contract',api_endpoint:'127.0.0.1 (ephemeral loopback only)',api_request_count:1,external_api_calls:0,model_deployed:false,paid_api_used:false,
      request:{method:'POST',path:'/v1/responses',authorization_header:'synthetic bearer token present; value omitted',content_type:captured.content_type,model:captured.payload.model,strict_json_schema:captured.payload.text.format.strict,evidence_ids:ledger.entries.map(entry=>entry.id)},
      inputs:{brief_sha256:sha256(brief),evidence_sha256:sha256(fs.readFileSync(evidenceFile)),synthetic_response_sha256:sha256(responseBytes)},
      output:{storyboard:'storyboard.json',storyboard_sha256:sha256(fs.readFileSync(storyboard)),slides:readJson(storyboard).slides.length,review_status:readJson(`${storyboard}.review.json`).review_status,requires_human_review:readJson(storyboard).meta.requires_human_review,structural_validation:'passed',build_gate:'blocked as required until human approval',pptx_created:fs.existsSync(buildOut)},
      output_files:[path.basename(storyboard),path.basename(`${storyboard}.review.json`),path.basename(`${storyboard}.review.md`)]
    };
    fs.writeFileSync(path.join(outDir,'api-test-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
    console.log(plan.stdout.trim());console.log(validation.stdout.trim());console.log(blockedBuild.stderr.trim());
  }finally{await new Promise(resolve=>server.close(resolve));}
}

main().catch(error=>{console.error(`[AI planner API POC failed] ${error.message}`);process.exitCode=1;});
