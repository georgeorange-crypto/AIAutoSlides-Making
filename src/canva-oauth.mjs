import crypto from 'node:crypto';
import http from 'node:http';

export const CANVA_PROFILE = 'https://api.canva.com/rest/v1/users/me/profile';
const AUTHORIZE = 'https://www.canva.com/api/oauth/authorize';
const TOKEN = 'https://api.canva.com/rest/v1/oauth/token';
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'"><title>AIAutoSlides · Canva login test</title><style>body{font:16px system-ui;max-width:700px;margin:4rem auto;padding:0 1rem;color:#172033}button{padding:.7rem 1rem}pre{white-space:pre-wrap;background:#f2f4f8;padding:1rem}.note{color:#48566a}</style><h1>Canva login test</h1><p class="note">Requests only profile:read to confirm login and read your Canva display name. No designs are listed, created, edited, exported, or uploaded. Tokens stay in memory until this process exits.</p><p id="config"></p><button onclick="location.href='/auth'">Connect Canva account</button><h2>Status</h2><pre id="status">Not connected</pre><script>fetch('/status').then(r=>r.json()).then(x=>{document.querySelector('#config').textContent=x.configured?'Canva OAuth client configured':'Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET locally, then restart.';if(x.profile)document.querySelector('#status').textContent='Connected to Canva as '+(x.profile.display_name||'account')+'\\n'+JSON.stringify(x.profile,null,2);if(x.message)document.querySelector('#status').textContent=x.message})</script>`;

export function createCanvaOAuthServer({clientId=process.env.CANVA_CLIENT_ID,clientSecret=process.env.CANVA_CLIENT_SECRET,fetchImpl=globalThis.fetch,port=53682,host='127.0.0.1'}={}) {
  let profile=null, pending=null, message='';
  const redirect=`http://127.0.0.1:${port}/callback`;
  const server=http.createServer(async(req,res)=>{
    const requestHost=(req.headers.host||'').split(':')[0].replace(/^\[|\]$/g,'');
    if(!['127.0.0.1','localhost','::1','[::1]'].includes(requestHost)){res.writeHead(403);res.end('Loopback host only');return;}
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(html);return;}
    if(req.method==='GET'&&url.pathname==='/status'){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify({configured:!!(clientId&&clientSecret),profile,message}));return;}
    if(req.method==='GET'&&url.pathname==='/auth'){
      if(!clientId||!clientSecret){res.writeHead(503);res.end('Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET first.');return;}
      const state=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');
      const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');pending={state,verifier,expires:Date.now()+5*60_000};
      const q=new URLSearchParams({code_challenge:challenge,code_challenge_method:'s256',scope:'profile:read',response_type:'code',client_id:clientId,state,redirect_uri:redirect});
      res.writeHead(302,{location:`${AUTHORIZE}?${q}`,'cache-control':'no-store'});res.end();return;
    }
    if(req.method==='GET'&&url.pathname==='/callback'){
      const p=pending;pending=null;
      if(!p||Date.now()>p.expires||url.searchParams.get('state')!==p.state){res.writeHead(400);res.end('Authorization state mismatch or expired. Return to the local app.');return;}
      const code=url.searchParams.get('code');if(!code){message='Canva authorization was denied or failed.';res.writeHead(400);res.end('Authorization failed. Return to the local app.');return;}
      try{
        const body=new URLSearchParams({grant_type:'authorization_code',code,code_verifier:p.verifier,redirect_uri:redirect});
        const basic=Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const tr=await fetchImpl(TOKEN,{method:'POST',headers:{authorization:`Basic ${basic}`,'content-type':'application/x-www-form-urlencoded'},body});if(!tr.ok)throw new Error(`token endpoint returned HTTP ${tr.status}`);
        const td=await tr.json();if(!td.access_token)throw new Error('token response did not contain access_token');
        const pr=await fetchImpl(CANVA_PROFILE,{headers:{authorization:`Bearer ${td.access_token}`}});if(!pr.ok)throw new Error(`profile endpoint returned HTTP ${pr.status}`);
        profile=await pr.json();message='Canva login and profile:read authorization succeeded.';
        res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'"});res.end('<meta charset="utf-8"><title>Connected</title><p>Canva login succeeded. Return to the AIAutoSlides local test page.</p>');
      }catch(e){profile=null;message=`Authorization test failed: ${e.message}`;res.writeHead(502,{'content-type':'text/plain; charset=utf-8'});res.end('Authorization test failed. Return to the local app for status.');}return;
    }
    res.writeHead(404);res.end('Not found');
  });
  return {server,listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server.address()));}),close:()=>new Promise(resolve=>server.close(resolve))};
}
