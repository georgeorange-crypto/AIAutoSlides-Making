import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createGoogleOAuthServer,pkcePair,GOOGLE_SLIDES_READONLY} from '../src/google-oauth.mjs';

test('PKCE verifier and S256 challenge have expected format',()=>{
 const p=pkcePair();assert.match(p.verifier,/^[A-Za-z0-9_-]{43,128}$/);assert.match(p.challenge,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(p.verifier,p.challenge);
});
test('local consent page starts without credentials and reports setup requirement',async t=>{
 const app=createGoogleOAuthServer({clientFile:undefined});const a=await app.listen();t.after(()=>app.close());
 const res=await fetch(`http://127.0.0.1:${a.port}/status`);assert.deepEqual(await res.json(),{configured:false,identity:null,message:''});
 const page=await fetch(`http://127.0.0.1:${a.port}/`);const body=await page.text();assert.match(body,/Authorize Slides read-only/);assert.match(body,/No deck is created, changed, or uploaded/);
 const auth=await fetch(`http://127.0.0.1:${a.port}/auth?mode=identity`,{redirect:'manual'});assert.equal(auth.status,503);
});
test('mocked PKCE consent verifies identity and allows only read-only deck metadata',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aiautoslides-oauth-'));const file=path.join(dir,'client.json');fs.writeFileSync(file,JSON.stringify({installed:{client_id:'test-client',client_secret:'test-secret'}}));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 let apiCalled=0;const fetchImpl=async(url,options={})=>{
  if(String(url)==='https://oauth2.googleapis.com/token'){assert.match(String(options.body),/code_verifier=/);return Response.json({access_token:'in-memory-token',scope:`openid email profile ${GOOGLE_SLIDES_READONLY}`});}
  if(String(url)==='https://openidconnect.googleapis.com/v1/userinfo'){assert.equal(options.headers.authorization,'Bearer in-memory-token');return Response.json({email:'test@example.test',name:'Test User'});}
  if(String(url).startsWith('https://slides.googleapis.com/v1/presentations/')){apiCalled++;assert.equal(options.headers.authorization,'Bearer in-memory-token');return Response.json({presentationId:'abcdefghijk',title:'Private deck title',slides:[{objectId:'s1'},{objectId:'s2'}]});}
  throw new Error('Unexpected network request');
 };
 const app=createGoogleOAuthServer({clientFile:file,fetchImpl});const a=await app.listen();t.after(()=>app.close());const base=`http://127.0.0.1:${a.port}`;
 const start=await fetch(`${base}/auth?mode=slides`,{redirect:'manual'});assert.equal(start.status,302);const authUrl=new URL(start.headers.get('location'));assert.equal(authUrl.searchParams.get('code_challenge_method'),'S256');assert.match(authUrl.searchParams.get('scope'),new RegExp(GOOGLE_SLIDES_READONLY.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 const badState=await fetch(`${base}/callback?code=fake-code&state=wrong-state`);assert.equal(badState.status,400);
 const retry=await fetch(`${base}/auth?mode=slides`,{redirect:'manual'});const retryUrl=new URL(retry.headers.get('location'));
 const cb=await fetch(`${base}/callback?code=fake-code&state=${encodeURIComponent(retryUrl.searchParams.get('state'))}`);assert.equal(cb.status,200,await cb.text());
 const status=await (await fetch(`${base}/status`)).json();assert.equal(status.identity.email,'test@example.test');
 const meta=await fetch(`${base}/deck`,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({presentationId:'abcdefghijk'})});assert.deepEqual(await meta.json(),{presentationId:'abcdefghijk',title:'Private deck title',slideCount:2});assert.equal(apiCalled,1);
 const denied=await fetch(`${base}/deck`,{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({presentationId:'bad'})});assert.equal(denied.status,400);assert.equal(apiCalled,1);
 const badOrigin=await fetch(`${base}/deck`,{method:'POST',headers:{origin:'http://evil.test','content-type':'application/json'},body:'{}'});assert.equal(badOrigin.status,403);
});
