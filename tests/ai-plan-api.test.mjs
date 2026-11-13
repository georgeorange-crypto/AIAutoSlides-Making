import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';

const fixtureDir=path.resolve('examples/open-source-bakeoff/ai-plan');
const response=JSON.parse(fs.readFileSync(path.join(fixtureDir,'response.json'),'utf8'));

function setup(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-responses-api-'));
  const brief=path.join(dir,'brief.md'),evidence=path.join(dir,'evidence.json'),out=path.join(dir,'draft.json');
  fs.copyFileSync(path.join(fixtureDir,'brief.md'),brief);
  fs.copyFileSync(path.join(fixtureDir,'evidence.json'),evidence);
  return{dir,brief,evidence,out};
}

async function withMockResponses(t,handler){
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    try{await handler(req,res,Buffer.concat(chunks).toString('utf8'));}
    catch(error){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:error.message}}));}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return`http://127.0.0.1:${server.address().port}/v1/responses`;
}

function runPlanner(files,endpoint){
  return new Promise(resolve=>{
    const child=spawn(process.execPath,['src/ai-plan.mjs','--input',files.brief,'--evidence',files.evidence,'--out',files.out,'--audience','research_group','--duration','7','--goal','Test the local synthetic API contract'],{
      cwd:process.cwd(),windowsHide:true,
      env:{...process.env,NODE_ENV:'test',OPENAI_API_KEY:'synthetic-test-key',OPENAI_MODEL:'synthetic-contract-model',AIAUTOSLIDES_TEST_RESPONSES_URL:endpoint}
    });
    let stdout='',stderr='',timedOut=false;
    child.stdout.setEncoding('utf8').on('data',chunk=>stdout+=chunk);
    child.stderr.setEncoding('utf8').on('data',chunk=>stderr+=chunk);
    const timer=setTimeout(()=>{timedOut=true;child.kill();},30000);
    child.on('error',error=>{clearTimeout(timer);resolve({status:null,error,stdout,stderr});});
    child.on('close',(status,signal)=>{clearTimeout(timer);resolve({status,signal,timedOut,stdout,stderr});});
  });
}

test('AI planner completes the Responses API contract against a local stub and keeps output pending review',async t=>{
  const files=setup();t.after(()=>fs.rmSync(files.dir,{recursive:true,force:true}));
  let request;
  const endpoint=await withMockResponses(t,async(req,res,body)=>{
    request={method:req.method,url:req.url,authorization:req.headers.authorization,content_type:req.headers['content-type'],payload:JSON.parse(body)};
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({id:'resp_synthetic_test',output_text:JSON.stringify(response)}));
  });
  const run=await runPlanner(files,endpoint);
  assert.equal(run.status,0,run.error?.message||run.stderr||`planner timed out=${run.timedOut}, signal=${run.signal}`);
  assert.equal(request.method,'POST');assert.equal(request.url,'/v1/responses');
  assert.equal(request.authorization,'Bearer synthetic-test-key');assert.equal(request.content_type,'application/json');
  assert.equal(request.payload.model,'synthetic-contract-model');
  assert.equal(request.payload.text.format.type,'json_schema');assert.equal(request.payload.text.format.strict,true);
  assert.deepEqual(request.payload.text.format.schema.required,['title','subtitle','narrative_structure','structure_rationale','slides']);
  assert.match(request.payload.input[0].content,/Permitted evidence IDs: E_SYN/);
  assert.match(request.payload.input[1].content,/synthetic, hypothetical/i);
  assert.match(request.payload.input[1].content,/Synthetic request-pipeline fixture/);

  const draft=JSON.parse(fs.readFileSync(files.out,'utf8'));
  const review=JSON.parse(fs.readFileSync(`${files.out}.review.json`,'utf8'));
  assert.equal(draft.slides.length,6);assert.equal(draft.meta.requires_human_review,true);
  assert.equal(draft.meta.draft_origin,'OpenAI Responses API');
  assert.equal(review.review_status,'pending');assert.equal(review.source_brief.sha256.length,64);
  assert.ok(review.required_human_checks.length>=4);

  const build=spawnSync(process.execPath,['src/cli.mjs','build','--input',files.out,'--evidence',files.evidence,'--out',path.join(files.dir,'must-not-build.pptx')],{cwd:process.cwd(),encoding:'utf8',timeout:30000,windowsHide:true});
  assert.notEqual(build.status,0);assert.match(build.stderr,/record a human approval/i);
  assert.equal(fs.existsSync(path.join(files.dir,'must-not-build.pptx')),false);
});

test('AI planner rejects non-loopback test API endpoint before sending a request',()=>{
  const run=spawnSync(process.execPath,['src/ai-plan.mjs','--input','unused.md','--out','unused.json'],{
    cwd:process.cwd(),encoding:'utf8',timeout:10000,windowsHide:true,
    env:{...process.env,NODE_ENV:'test',OPENAI_API_KEY:'synthetic-test-key',AIAUTOSLIDES_TEST_RESPONSES_URL:'https://example.invalid/v1/responses'}
  });
  assert.notEqual(run.status,0);assert.match(run.stderr,/Test Responses endpoint must be plain HTTP on loopback/);
});

test('AI planner does not allow a test endpoint override outside test mode',()=>{
  const run=spawnSync(process.execPath,['src/ai-plan.mjs','--input','unused.md','--out','unused.json'],{
    cwd:process.cwd(),encoding:'utf8',timeout:10000,windowsHide:true,
    env:{...process.env,NODE_ENV:'production',OPENAI_API_KEY:'synthetic-test-key',AIAUTOSLIDES_TEST_RESPONSES_URL:'http://127.0.0.1:1/v1/responses'}
  });
  assert.notEqual(run.status,0);assert.match(run.stderr,/allowed only when NODE_ENV=test/);
});
