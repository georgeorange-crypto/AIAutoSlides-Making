import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvaOAuthServer} from '../src/canva-oauth.mjs';

test('Canva login requests profile:read only and verifies PKCE before reading profile',async()=>{
  const calls=[];
  const app=createCanvaOAuthServer({clientId:'test-client',clientSecret:'test-secret',port:53683,fetchImpl:async(url,options)=>{
    calls.push({url:String(url),options});
    if(String(url).includes('/oauth/token'))return {ok:true,json:async()=>({access_token:'in-memory-token'})};
    return {ok:true,json:async()=>({display_name:'Test Account'})};
  }});
  const address=await app.listen();const base=`http://127.0.0.1:${address.port}`;
  try{
    const page=await fetch(base);assert.equal(page.status,200);
    const auth=await fetch(`${base}/auth`,{redirect:'manual'});assert.equal(auth.status,302);
    const authorize=new URL(auth.headers.get('location'));
    assert.equal(authorize.searchParams.get('scope'),'profile:read');
    assert.equal(authorize.searchParams.get('code_challenge_method'),'s256');
    const state=authorize.searchParams.get('state');
    const callback=await fetch(`${base}/callback?code=unit-code&state=${encodeURIComponent(state)}`);assert.equal(callback.status,200);
    assert.match(calls[0].url,/oauth\/token$/);assert.match(calls[1].url,/users\/me\/profile$/);
    assert.equal(calls[1].options.headers.authorization,'Bearer in-memory-token');
    const status=await (await fetch(`${base}/status`)).json();assert.equal(status.profile.display_name,'Test Account');
    assert.equal(JSON.stringify(status).includes('in-memory-token'),false);
    assert.match(calls[0].options.body.toString(),/code_verifier=/);
  }finally{await app.close();}
});

test('Canva callback rejects state mismatch without exchanging code',async()=>{
  let exchanges=0;
  const app=createCanvaOAuthServer({clientId:'test-client',clientSecret:'test-secret',port:53684,fetchImpl:async()=>{exchanges++;throw new Error('must not call');}});
  const address=await app.listen();const base=`http://127.0.0.1:${address.port}`;
  try{await fetch(`${base}/auth`,{redirect:'manual'});const response=await fetch(`${base}/callback?code=x&state=bad`);assert.equal(response.status,400);assert.equal(exchanges,0);}
  finally{await app.close();}
});
