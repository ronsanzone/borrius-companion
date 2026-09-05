import { createRemoteJWKSet, jwtVerify } from 'jose';
// Public signing-key resolver cache only; never stores user JWTs or claims.
const ownerKeyResolvers = new Map();
function ownerKeys(teamDomain) {
 let keys = ownerKeyResolvers.get(teamDomain);
 if (!keys) { keys = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`)); ownerKeyResolvers.set(teamDomain, keys); }
 return keys;
}
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8'}});
export const now=()=>new Date().toISOString();
export const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))).map(b=>b.toString(16).padStart(2,'0')).join('');
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function readBody(request,max){
 if(Number(request.headers.get('content-length')||0)>max)throw new HttpError(413,'Request is too large');
 if(!request.body)return new Uint8Array();
 const reader=request.body.getReader();const chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>max){await reader.cancel();throw new HttpError(413,'Request is too large');}chunks.push(value);}}finally{reader.releaseLock();}
 const out=new Uint8Array(total);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.length;}return out;
}
export async function readJson(request,max=16384){try{return JSON.parse(new TextDecoder().decode(await readBody(request,max)));}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'Invalid JSON');}}
export function localRequest(request,env){const u=new URL(request.url);return env.DEPLOYMENT_MODE==='local'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname);}
export async function requireOwner(request,env){
 if(localRequest(request,env))return;
 if(env.DEPLOYMENT_MODE!=='production'||!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_ALLOWED_EMAIL)throw new HttpError(503,'Private access is not configured');
 const token=request.headers.get('cf-access-jwt-assertion');if(!token)throw new HttpError(403,'Sign in to your private companion');
 try{const keys=ownerKeys(env.ACCESS_TEAM_DOMAIN);const {payload}=await jwtVerify(token,keys,{issuer:env.ACCESS_TEAM_DOMAIN,audience:env.ACCESS_AUD});if(payload.email!==env.ACCESS_ALLOWED_EMAIL)throw Error();}catch{throw new HttpError(403,'Access denied');}
}
export function requireOrigin(request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'Request origin is not allowed');}
export async function rateLimit(env,key,limit,seconds=60){
 const window=Math.floor(Date.now()/1000/seconds);const k=key+':'+window;
 const row=await env.DB.prepare('INSERT INTO request_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(k,(window+2)*seconds).first();
 if(row.count>limit)throw new HttpError(429,'Too many requests. Try again later.');
}
export async function requireDevice(request,env){
 const bearer=request.headers.get('authorization')||'';if(!/^Bearer [a-f0-9]{64}$/.test(bearer))throw new HttpError(401,'Device pairing required');
 const device=await env.DB.prepare('SELECT * FROM devices WHERE token_hash=? AND revoked_at IS NULL').bind(await hash(bearer.slice(7))).first();if(!device)throw new HttpError(401,'Device pairing expired or revoked');return device;
}
export function secure(response){const headers=new Headers(response.headers);headers.set('cache-control','no-store');headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','no-referrer');headers.set('strict-transport-security','max-age=31536000');headers.set('x-frame-options','DENY');headers.set('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://raw.githubusercontent.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");return new Response(response.body,{status:response.status,headers});}
