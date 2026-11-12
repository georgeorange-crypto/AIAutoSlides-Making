import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';

export const GOOGLE_SLIDES_READONLY = 'https://www.googleapis.com/auth/presentations.readonly';
export const GOOGLE_USERINFO = 'https://openidconnect.googleapis.com/v1/userinfo';
const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"><title>AIAutoSlides · Google connection test</title><style>body{font:16px system-ui;max-width:760px;margin:4rem auto;padding:0 1rem;color:#172033}button{padding:.7rem 1rem;margin:.3rem}input{padding:.6rem;width:min(30rem,90%)}pre{white-space:pre-wrap;background:#f2f4f8;padding:1rem}.note{color:#48566a}</style><h1>Google authorization test</h1><p class="note">Local-only consent test. Identity login requests OpenID profile. Slides access is read-only. No deck is created, changed, or uploaded; tokens remain in memory until this process exits.</p><p id="config"></p><button onclick="go('/auth?mode=identity')">Connect Google account</button><button onclick="go('/auth?mode=slides')">Authorize Slides read-only</button><h2>Read an existing deck</h2><input id="id" placeholder="Paste an existing Google Slides presentation ID"><button onclick="readDeck()">Read title and slide count</button><h2>Status</h2><pre id="status">Not connected</pre><script>async function go(path){location.href=path}async function readDeck(){const r=await fetch('/deck',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({presentationId:document.querySelector('#id').value})});document.querySelector('#status').textContent=await r.text()}fetch('/status').then(r=>r.json()).then(x=>{document.querySelector('#config').textContent=x.configured?'OAuth client configured':'Set GOOGLE_OAUTH_CLIENT_FILE to a local Desktop OAuth client JSON file.';if(x.identity)document.querySelector('#status').textContent='Connected as '+x.identity.email+' ('+x.identity.name+')';if(x.message)document.querySelector('#status').textContent=x.message})</script>`;

export function pkcePair() {
  const verifier=crypto.randomBytes(48).toString('base64url');
  return {verifier,challenge:crypto.createHash('sha256').update(verifier).digest('base64url')};
}
export function loadOAuthClient(file) {
  const data=JSON.parse(fs.readFileSync(file,'utf8'));
  const c=data.installed||data.web;
  if(!c?.client_id) throw new Error('OAuth client JSON must contain installed.client_id or web.client_id');
  return {clientId:c.client_id,clientSecret:c.client_secret};
}
function json(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(value));}
function safeId(id){return typeof id==='string'&&/^[A-Za-z0-9_-]{10,200}$/.test(id);}

export function createGoogleOAuthServer({clientFile=process.env.GOOGLE_OAUTH_CLIENT_FILE,fetchImpl=globalThis.fetch,port=0,host='127.0.0.1'}={}) {
  let client=null, identity=null, token=null, pending=null, message='';
  try { if(clientFile) client=loadOAuthClient(clientFile); } catch(e){message=`OAuth client configuration error: ${e.message}`;}
  const server=http.createServer(async(req,res)=>{
    const hostname=(req.headers.host||'').split(':')[0].replace(/^\[|\]$/g,'');
    if(!['127.0.0.1','localhost','[::1]','::1'].includes(hostname)){res.writeHead(403);res.end('Loopback host only');return;}
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(html);return;}
    if(req.method==='GET'&&url.pathname==='/status'){json(res,200,{configured:!!client,identity,message});return;}
    if(req.method==='GET'&&url.pathname==='/auth'){
      if(!client){res.writeHead(503,{'content-type':'text/plain; charset=utf-8'});res.end('Configure GOOGLE_OAUTH_CLIENT_FILE first.');return;}
      const mode=url.searchParams.get('mode');if(!['identity','slides'].includes(mode)){res.writeHead(400);res.end('Invalid mode');return;}
      const state=crypto.randomBytes(32).toString('base64url'),pair=pkcePair();const redirect=`http://127.0.0.1:${server.address().port}/callback`;
      pending={state,verifier:pair.verifier,redirect,mode,expires:Date.now()+5*60*1000};
      const q=new URLSearchParams({client_id:client.clientId,redirect_uri:redirect,response_type:'code',scope:mode==='identity'?'openid email profile':`openid email profile ${GOOGLE_SLIDES_READONLY}`,state,code_challenge:pair.challenge,code_challenge_method:'S256',access_type:'online',include_granted_scopes:'true'});
      res.writeHead(302,{location:`${AUTH}?${q}`,'cache-control':'no-store'});res.end();return;
    }
    if(req.method==='GET'&&url.pathname==='/callback'){
      const p=pending;pending=null;
      if(!p||Date.now()>p.expires||url.searchParams.get('state')!==p.state){res.writeHead(400);res.end('Authorization state mismatch or expired. Return to the local app.');return;}
      const code=url.searchParams.get('code');if(!code){message='Google authorization was denied or failed.';res.writeHead(400);res.end('Authorization failed. Return to the local app.');return;}
      try{
        const body=new URLSearchParams({client_id:client.clientId,code,code_verifier:p.verifier,redirect_uri:p.redirect,grant_type:'authorization_code'});if(client.clientSecret)body.set('client_secret',client.clientSecret);
        const tr=await fetchImpl(TOKEN,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});if(!tr.ok)throw new Error(`token endpoint returned HTTP ${tr.status}`);
        const td=await tr.json();if(!td.access_token)throw new Error('token response did not contain access_token');token={access_token:td.access_token,scope:td.scope||''};
        const ur=await fetchImpl(GOOGLE_USERINFO,{headers:{authorization:`Bearer ${token.access_token}`}});if(!ur.ok)throw new Error(`userinfo endpoint returned HTTP ${ur.status}`);identity=await ur.json();message=p.mode==='slides'?'Slides read-only permission authorized.':'';
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'"});res.end('<meta charset="utf-8"><title>Connected</title><p>Google authorization succeeded. Return to the AIAutoSlides local test page.</p>');
      }catch(e){token=null;identity=null;message=`Authorization test failed: ${e.message}`;res.writeHead(502,{'content-type':'text/plain; charset=utf-8'});res.end('Authorization test failed. Return to the local app for status.');}return;
    }
    if(req.method==='POST'&&url.pathname==='/deck'){
      if(!req.headers.origin||!req.headers.origin.startsWith(`http://127.0.0.1:${server.address().port}`)){json(res,403,{error:'Local origin required'});return;}
      if(!token||!token.scope.split(' ').includes(GOOGLE_SLIDES_READONLY)){json(res,401,{error:'Authorize Slides read-only first'});return;}
      let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){json(res,413,{error:'Request too large'});return;}}
      let input;try{input=JSON.parse(body);}catch{json(res,400,{error:'Invalid JSON'});return;}
      if(!safeId(input.presentationId)){json(res,400,{error:'Enter a valid existing presentation ID'});return;}
      try{const endpoint=`https://slides.googleapis.com/v1/presentations/${encodeURIComponent(input.presentationId)}?fields=presentationId,title,slides(objectId),pageSize`;const r=await fetchImpl(endpoint,{headers:{authorization:`Bearer ${token.access_token}`}});if(!r.ok){json(res,r.status,{error:`Slides API returned HTTP ${r.status}`});return;}const d=await r.json();json(res,200,{presentationId:d.presentationId,title:d.title,slideCount:d.slides?.length??0,pageSize:d.pageSize});}catch(e){json(res,502,{error:`Slides read failed: ${e.message}`});}return;
    }
    res.writeHead(404);res.end('Not found');
  });
  return {server,listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server.address()));}),close:()=>new Promise(resolve=>server.close(resolve))};
}
