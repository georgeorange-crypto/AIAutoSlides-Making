import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createLocalApi} from '../packages/api/server.mjs';
import {createMcpProtocol} from '../src/mcp.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixture=JSON.parse(fs.readFileSync(path.join(root,'examples/phase1/pptxgenjs-ir.json'),'utf8'));

test('MCP API target accepts loopback only and rejects credentials or remote hosts',()=>{
  assert.throws(()=>createMcpProtocol({apiBase:'https://127.0.0.1:8787'}),/must be an http URL/);
  assert.throws(()=>createMcpProtocol({apiBase:'http://example.com:8787'}),/must be an http URL/);
  assert.throws(()=>createMcpProtocol({apiBase:'http://user:pass@127.0.0.1:8787'}),/must be an http URL/);
});

test('MCP supports modern discovery and per-request metadata with an explicit legacy fallback list',async()=>{
  const server=createMcpProtocol({fetchImpl:async()=>new Response(JSON.stringify({ok:true,service:'aiautoslides-local-api'}),{status:200,headers:{'content-type':'application/json'}})}),meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientInfo':{name:'modern-fixture',version:'1'},'io.modelcontextprotocol/clientCapabilities':{}};
  const discovery=await server.handle({jsonrpc:'2.0',id:'d1',method:'server/discover',params:{_meta:meta}});
  assert.equal(discovery.result.resultType,'complete');assert.ok(discovery.result.supportedVersions.includes('2026-07-28'));assert.ok(discovery.result.supportedVersions.includes('2025-11-25'));
  const listed=await server.handle({jsonrpc:'2.0',id:'l1',method:'tools/list',params:{_meta:meta}});assert.equal(listed.result.resultType,'complete');assert.equal(listed.result.tools.length,24);assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_enqueue_commons_asset'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_plan_deck'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_research_topic'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_enqueue_research'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_enqueue_arxiv_ingest'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_enqueue_document_ingest'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_enqueue_page_crawl'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_critique_deck'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_export_deck'));assert.ok(listed.result.tools.some(tool=>tool.name==='aiautoslides_update_profile'));
  const called=await server.handle({jsonrpc:'2.0',id:'c1',method:'tools/call',params:{_meta:meta,name:'aiautoslides_health',arguments:{}}});assert.equal(called.result.resultType,'complete');assert.equal(JSON.parse(called.result.content[0].text).service,'aiautoslides-local-api');
  const invalid=await server.handle({jsonrpc:'2.0',id:'c2',method:'tools/call',params:{_meta:meta,name:'aiautoslides_list_artifacts',arguments:{project_id:'123e4567-e89b-42d3-a456-426614174000',job_id:'123e4567-e89b-42d3-a456-426614174001'}}});assert.equal(invalid.result.isError,true);assert.match(invalid.result.content[0].text,/exactly one supported input variant/);
  const badLimit=await server.handle({jsonrpc:'2.0',id:'c3',method:'tools/call',params:{_meta:meta,name:'aiautoslides_research_topic',arguments:{project_id:'123e4567-e89b-42d3-a456-426614174000',provider:'arxiv',query:'paper',limit:11,allow_network:true}}});assert.equal(badLimit.result.isError,true);assert.match(badLimit.result.content[0].text,/limit must be an integer/);
  const unsupported=await server.handle({jsonrpc:'2.0',id:'bad',method:'server/discover',params:{_meta:{...meta,'io.modelcontextprotocol/protocolVersion':'1900-01-01'}}});assert.equal(unsupported.error.code,-32022);assert.ok(unsupported.error.data.supported.includes('2026-07-28'));
});

test('stdio MCP lists local tools and runs project-to-render workflow through loopback API',async()=>{
  const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-mcp-'));let api,child,reader,lines;
  try{
    api=await createLocalApi({workspaceDir:workspace,preview:false,research:{search:async({provider,query})=>({provider,query,retrieved_at:'2026-11-12T12:00:00.000Z',results:[{source_id:'SRC_MCP_FIXTURE',record_sha256:'b'.repeat(64),record_url:'https://api.example.test/record',provider_record_id:'fixture-1',title:'Synthetic metadata fixture',authors:[],publication_year:2026,landing_url:'https://example.test/paper',evidence_status:'metadata_candidate_only',verification_status:'unverified'}]})}});const address=await api.listen({port:0}),apiBase=`http://127.0.0.1:${address.port}`;
    child=spawn(process.execPath,['src/mcp.mjs'],{cwd:root,env:{...process.env,AIAUTOSLIDES_API_URL:apiBase},stdio:['pipe','pipe','pipe']});reader=createInterface({input:child.stdout});lines=reader[Symbol.asyncIterator]();
    const send=message=>child.stdin.write(`${JSON.stringify(message)}\n`),next=async()=>{const line=await lines.next();if(line.done)throw new Error('MCP server closed stdout before replying');return JSON.parse(line.value);};
    send({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'fixture-client',version:'1.0'}}});
    const initialized=await next();assert.equal(initialized.result.protocolVersion,'2025-11-25');assert.ok(initialized.result.capabilities.tools);
    send({jsonrpc:'2.0',method:'notifications/initialized'});
    send({jsonrpc:'2.0',id:2,method:'tools/list',params:{}});const listed=await next(),names=listed.result.tools.map(tool=>tool.name);
    assert.ok(names.includes('aiautoslides_create_project'));assert.ok(names.includes('aiautoslides_enqueue_render'));assert.ok(names.includes('aiautoslides_import_source'));assert.ok(names.includes('aiautoslides_plan_deck'));assert.ok(names.includes('aiautoslides_research_topic'));assert.ok(names.includes('aiautoslides_enqueue_research'));assert.ok(names.includes('aiautoslides_enqueue_arxiv_ingest'));assert.ok(names.includes('aiautoslides_enqueue_document_ingest'));assert.ok(names.includes('aiautoslides_enqueue_page_crawl'));assert.ok(names.includes('aiautoslides_critique_deck'));assert.ok(names.includes('aiautoslides_export_deck'));assert.ok(names.includes('aiautoslides_create_profile'));assert.ok(names.includes('aiautoslides_update_profile'));
    send({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'aiautoslides_health',arguments:{}}});
    const health=JSON.parse((await next()).result.content[0].text);assert.equal(health.service,'aiautoslides-local-api');
    send({jsonrpc:'2.0',id:4,method:'tools/call',params:{name:'aiautoslides_health',arguments:{project_id:'bad'}}});
    const invalid=(await next()).result;assert.equal(invalid.isError,true);assert.match(invalid.content[0].text,/project_id is not allowed/);
    send({jsonrpc:'2.0',id:40,method:'tools/call',params:{name:'aiautoslides_create_profile',arguments:{preferences:{audience_profile:'academic_conference',duration_seconds:420}}}});const profile=JSON.parse((await next()).result.content[0].text).profile;assert.equal(profile.privacy.allow_network,false);
    send({jsonrpc:'2.0',id:41,method:'tools/call',params:{name:'aiautoslides_update_profile',arguments:{profile_id:profile.profile_id,preferences:{audience_profile:'research_group',duration_seconds:600}}}});const updatedProfile=JSON.parse((await next()).result.content[0].text).profile;assert.equal(updatedProfile.preferences.audience_profile,'research_group');
    send({jsonrpc:'2.0',id:5,method:'tools/call',params:{name:'aiautoslides_create_project',arguments:{title:'MCP fixture project',presentation_ir:fixture}}});
    const created=JSON.parse((await next()).result.content[0].text),projectId=created.project.project_id;assert.ok(projectId);
    send({jsonrpc:'2.0',id:2050,method:'tools/call',params:{name:'aiautoslides_research_topic',arguments:{project_id:projectId,provider:'arxiv',query:'synthetic MCP research',limit:2,allow_network:true}}});const researched=JSON.parse((await next()).result.content[0].text);assert.equal(researched.added_count,1);assert.equal(researched.result.results[0].verification_status,'unverified');
    send({jsonrpc:'2.0',id:2051,method:'tools/call',params:{name:'aiautoslides_enqueue_research',arguments:{project_id:projectId,provider:'arxiv',query:'synthetic MCP research job',limit:2,allow_network:true}}});const researchQueued=JSON.parse((await next()).result.content[0].text);assert.equal(researchQueued.job.workflow,'research-topic');let researchJob;for(let attempt=0;attempt<100;attempt++){researchJob=(await (await fetch(`${apiBase}/jobs/${researchQueued.job.job_id}`)).json()).job;if(['completed','failed','cancelled'].includes(researchJob.status))break;await new Promise(resolve=>setTimeout(resolve,20));}assert.equal(researchJob.status,'completed',researchJob.error);assert.equal(researchJob.result.ingestion.added_count,0);
    send({jsonrpc:'2.0',id:2052,method:'tools/call',params:{name:'aiautoslides_enqueue_arxiv_ingest',arguments:{project_id:projectId,source_id:'SRC_MCP_FIXTURE',allow_download:true}}});const notArxiv=(await next()).result;assert.equal(notArxiv.isError,true);assert.match(notArxiv.content[0].text,/selected arXiv metadata candidate/);
    send({jsonrpc:'2.0',id:205,method:'tools/call',params:{name:'aiautoslides_plan_deck',arguments:{project_id:projectId}}});const plan=JSON.parse((await next()).result.content[0].text);assert.equal(plan.plan.method,'deterministic_ir_heuristics');
    send({jsonrpc:'2.0',id:206,method:'tools/call',params:{name:'aiautoslides_critique_deck',arguments:{project_id:projectId}}});const critique=JSON.parse((await next()).result.content[0].text);assert.ok(critique.critique);assert.equal(critique.critique.issues.some(issue=>issue.rule_id==='SRC-001'),true);
    send({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:'aiautoslides_enqueue_render',arguments:{project_id:projectId,preview:false}}});
    const enqueued=JSON.parse((await next()).result.content[0].text),jobId=enqueued.job.job_id;assert.ok(jobId);
    let job;for(let attempt=0;attempt<160;attempt++){
      send({jsonrpc:'2.0',id:7+attempt,method:'tools/call',params:{name:'aiautoslides_get_job',arguments:{job_id:jobId}}});
      const response=await next();job=JSON.parse(response.result.content[0].text).job;if(['completed','failed','cancelled'].includes(job.status))break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.equal(job.status,'completed',job.error);
    send({jsonrpc:'2.0',id:200,method:'tools/call',params:{name:'aiautoslides_list_artifacts',arguments:{job_id:jobId}}});
    const artifacts=JSON.parse((await next()).result.content[0].text).artifacts;assert.ok(artifacts.some(item=>item.format==='pptx'));
    send({jsonrpc:'2.0',id:201,method:'tools/call',params:{name:'aiautoslides_export_deck',arguments:{job_id:jobId}}});
    const exported=JSON.parse((await next()).result.content[0].text);assert.match(exported.download_url,new RegExp(`/artifacts/${exported.artifact_id}$`));assert.equal(exported.sha256,artifacts.find(item=>item.format==='pptx').sha256);
  }finally{
    reader?.close();if(child&&!child.killed)child.kill();if(api)await api.close();fs.rmSync(workspace,{recursive:true,force:true});
  }
});
