import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createLocalApi} from '../packages/api/server.mjs';
import {openProjectStore} from '../packages/api/store.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'examples/phase1/pptxgenjs-ir.json'),'utf8'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function mockAdapter(counter){
  return{
    manifest:{id:'test-renderer',version:'1',status:'test'},
    async probe(){return{status:'available'};},
    async negotiate(){return{ok:true,formats:['pptx'],capabilities:{}};},
    async render({outputDir}){
      counter.active++;counter.peak=Math.max(counter.peak,counter.active);
      await wait(80);
      const file=path.join(outputDir,'presentation.pptx'),bytes=Buffer.from(`synthetic deck ${path.basename(outputDir)}`);
      fs.writeFileSync(file,bytes);counter.active--;
      return{status:'completed',slideCount:fixture.slides.length,qa:{status:'pass',errors:[],warnings:[],chartValuesExact:true},artifacts:[{path:file,format:'pptx',sha256:hash(bytes)}],warnings:[]};
    },
    async export({artifacts,outputDir}){
      fs.mkdirSync(outputDir,{recursive:true});
      const copied=[];
      for(const item of artifacts){const file=path.join(outputDir,path.basename(item.path));fs.copyFileSync(item.path,file);copied.push({path:file,format:item.format,sha256:hash(fs.readFileSync(file))});}
      return{status:'completed',artifacts:copied};
    }
  };
}

async function terminalJob(base,jobId,token){
  let job;
  for(let i=0;i<200;i++){
    const response=await fetch(`${base}/jobs/${jobId}`,{headers:{authorization:`Bearer ${token}`}});
    assert.equal(response.status,200);job=(await response.json()).job;
    if(['completed','failed','cancelled'].includes(job.status))return job;
    await wait(25);
  }
  throw new Error(`Job ${jobId} did not reach a terminal state; last status ${job?.status}`);
}

test('authenticated owners are isolated and submitted jobs run under a bounded shared scheduler',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-owners-')),counter={active:0,peak:0};let api;
  const authenticate=async req=>{
    const token=req.headers.authorization?.replace(/^Bearer\s+/i,'');
    if(token==='alice-token')return{user_id:'user-alice'};
    if(token==='bob-token')return{user_id:'user-bob'};
    throw new Error('invalid test credential');
  };
  try{
    api=await createLocalApi({workspaceDir:workspace,preview:false,maxConcurrentJobs:2,authenticate,adapter:mockAdapter(counter)});
    const address=await api.listen({port:0}),base=`http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(`${base}/projects`)).status,401);
    assert.equal((await fetch(`${base}/health`)).status,200);

    async function createProject(token,title){
      const response=await fetch(`${base}/projects`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({title,presentation_ir:structuredClone(fixture)})});
      assert.equal(response.status,201);return(await response.json()).project;
    }
    const alice=await createProject('alice-token','Alice project'),bob=await createProject('bob-token','Bob project');
    assert.deepEqual((await(await fetch(`${base}/projects`,{headers:{authorization:'Bearer alice-token'}})).json()).projects.map(project=>project.project_id),[alice.project_id]);
    assert.deepEqual((await(await fetch(`${base}/projects`,{headers:{authorization:'Bearer bob-token'}})).json()).projects.map(project=>project.project_id),[bob.project_id]);
    assert.equal((await fetch(`${base}/projects/${alice.project_id}`,{headers:{authorization:'Bearer bob-token'}})).status,404);
    assert.equal((await fetch(`${base}/projects/${bob.project_id}/slides`,{headers:{authorization:'Bearer alice-token'}})).status,404);

    const bytes=Buffer.from('same source content in separate tenant scopes');
    for(const [token,project,sourceId] of [['alice-token',alice,'SRC_ALICE'],['bob-token',bob,'SRC_BOB']]){
      const response=await fetch(`${base}/projects/${project.project_id}/source-files/${sourceId}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/octet-stream','x-filename':'notes.txt','x-source-type':'text'},body:bytes});
      assert.equal(response.status,201);assert.equal((await response.json()).source.sha256,hash(bytes));
    }
    const tenantBlobDirs=fs.readdirSync(path.join(workspace,'source-blobs','users'),{withFileTypes:true}).filter(item=>item.isDirectory());
    assert.equal(tenantBlobDirs.length,2,'identical source bytes are stored in separate user namespaces');

    // Authenticated image uploads are stored under the owning principal and cannot
    // be referenced by another principal through a crafted project IR.
    const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
    const upload=await fetch(`${base}/projects/${alice.project_id}/assets/ASSET_ALICE`,{method:'POST',headers:{authorization:'Bearer alice-token','content-type':'image/png','x-filename':'plot.png','x-source-id':'SRC_PLOT','x-media-type':'image/png','x-license':'unknown'},body:png});
    assert.equal(upload.status,201);
    const uploaded=(await upload.json()).asset.asset;
    assert.ok(uploaded.uri.includes(path.join('asset-blobs','users',hash(Buffer.from('user-alice')))));
    const foreignAssetIR=structuredClone(fixture);foreignAssetIR.assets=[uploaded];
    const rejected=await fetch(`${base}/projects`,{method:'POST',headers:{authorization:'Bearer bob-token','content-type':'application/json'},body:JSON.stringify({title:'Must not reference Alice asset',presentation_ir:foreignAssetIR})});
    assert.equal(rejected.status,403);

    const jobIds=[];
    for(const [token,project,count] of [['alice-token',alice,3],['bob-token',bob,2]])for(let i=0;i<count;i++){
      const response=await fetch(`${base}/projects/${project.project_id}/jobs`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({preview:false})});
      assert.equal(response.status,202);jobIds.push({id:(await response.json()).job.job_id,token,project});
    }
    const jobs=await Promise.all(jobIds.map(item=>terminalJob(base,item.id,item.token)));
    assert.ok(jobs.every(job=>job.status==='completed'),jobs.map(job=>job.error).filter(Boolean).join('\n'));
    assert.equal(counter.peak,2,'the scheduler starts no more than the configured number of jobs');
    for(const item of jobIds){
      const foreignToken=item.token==='alice-token'?'bob-token':'alice-token';
      assert.equal((await fetch(`${base}/jobs/${item.id}`,{headers:{authorization:`Bearer ${foreignToken}`}})).status,404);
      const ownResponse=await fetch(`${base}/jobs/${item.id}`,{headers:{authorization:`Bearer ${item.token}`}}),own=(await ownResponse.json()).job;
      const pptx=own.result.artifacts.find(artifact=>artifact.format==='pptx');assert.ok(pptx);
      assert.ok(pptx.path.includes(`${path.sep}runs${path.sep}${item.id}${path.sep}`));
      assert.equal((await fetch(`${base}/artifacts/${pptx.artifact_id}`,{headers:{authorization:`Bearer ${foreignToken}`}})).status,404);
    }
  }finally{if(api)await api.close();fs.rmSync(workspace,{recursive:true,force:true});}
});

test('queued job keeps its submitted IR snapshot when the project is edited later',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-snapshot-'));let api;
  try{
    api=await createLocalApi({workspaceDir:workspace,preview:false});
    const project=api.store.createProject({title:'Snapshot fixture',presentationIR:structuredClone(fixture)}),job=api.store.createJob(project.project_id,{preview:false});
    const edited=structuredClone(fixture);edited.slides[0].title='Edited after submit';api.store.savePresentationIR(project.project_id,edited);
    const snapshot=api.store.getProjectSnapshotForJob(job.job_id);
    assert.notEqual(job.input_ir_sha256,api.store.getProject(project.project_id).ir_sha256);
    assert.equal(snapshot.ir_sha256,job.input_ir_sha256);
    assert.equal(snapshot.presentationIR.slides[0].title,fixture.slides[0].title);
    assert.equal(api.store.getProject(project.project_id).presentationIR.slides[0].title,'Edited after submit');
  }finally{if(api)await api.close();fs.rmSync(workspace,{recursive:true,force:true});}
});

test('database migration preserves legacy local projects and binds old queued jobs to their current IR',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-legacy-db-'));let store;
  try{
    const {DatabaseSync}=await import('node:sqlite'),dbDir=path.join(workspace,'db'),blobDir=path.join(workspace,'source-blobs');
    fs.mkdirSync(dbDir,{recursive:true});fs.mkdirSync(blobDir,{recursive:true});
    const db=new DatabaseSync(path.join(dbDir,'aiautoslides.sqlite'));
    db.exec(`CREATE TABLE projects(project_id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,ir_path TEXT NOT NULL,ir_sha256 TEXT NOT NULL);
      CREATE TABLE jobs(job_id TEXT PRIMARY KEY,project_id TEXT NOT NULL,workflow TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,options_json TEXT NOT NULL,events_json TEXT NOT NULL,result_json TEXT,error TEXT,cancel_requested INTEGER NOT NULL DEFAULT 0);`);
    const irBytes=Buffer.from(`${JSON.stringify(fixture,null,2)}\n`),irHash=hash(irBytes),irPath=path.join(blobDir,irHash),at=new Date().toISOString();fs.writeFileSync(irPath,irBytes);
    db.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?)').run('legacy-project','Legacy project',at,at,irPath,irHash);
    db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('legacy-job','legacy-project','presentation','queued',at,at,'{"preview":false}','[]',null,null,0);db.close();
    store=await openProjectStore(workspace);
    assert.ok(store.getProjectForUser('legacy-project','local'));
    assert.equal(store.listProjects('local').length,1);
    const job=store.getJob('legacy-job'),snapshot=store.getProjectSnapshotForJob('legacy-job');
    assert.equal(job.input_ir_sha256,irHash);assert.equal(snapshot.ir_sha256,irHash);assert.equal(snapshot.presentationIR.slides.length,fixture.slides.length);
  }finally{store?.close();fs.rmSync(workspace,{recursive:true,force:true});}
});
