import {getCatalog} from './parser.js';
import {processSnapshot,reconcile} from './processing.js';
import {HttpError,json,now,hash,randomToken,readBody,readJson,requireOwner,requireDevice,requireOrigin,rateLimit,localRequest,secure} from './security.js';
const DEFAULT_CONTEXT={difficulty:'unknown',levelCap:null,checkpoint:'',spoilerMode:'hints',favorites:[]};
const text=(v,max=120)=>typeof v==='string'?v.trim().slice(0,max):'';
const idPattern=/^[a-zA-Z0-9_-]{8,80}$/;
const all=async stmt=>(await stmt.all()).results;
export async function ingest(request,env,deviceId){
 await rateLimit(env,'upload:'+deviceId,30);
 const bytes=await readBody(request,131072);if(bytes.length!==131072)throw new HttpError(400,'Choose a 128 KiB Unbound cartridge save (.srm or .sav), not a save state');
 const version=request.headers.get('x-game-version');if(version!=='2.1.1.1')throw new HttpError(400,'Select supported Unbound version 2.1.1.1');
 const captureId=request.headers.get('x-capture-id')||crypto.randomUUID();if(!idPattern.test(captureId))throw new HttpError(400,'Invalid capture identifier');
 const sequence=Number(request.headers.get('x-device-sequence')||Date.now());if(!Number.isSafeInteger(sequence)||sequence<0)throw new HttpError(400,'Invalid capture sequence');
 const supplied=request.headers.get('x-captured-at');const captured=supplied?new Date(supplied):new Date();if(!Number.isFinite(captured.getTime()))throw new HttpError(400,'Invalid capture time');
 let filename='Unbound.srm';try{filename=text(decodeURIComponent(request.headers.get('x-save-name')||'Unbound.srm'),180);}catch{throw new HttpError(400,'Invalid save name');}
 const digest=await hash(bytes);
 let existing=await env.DB.prepare('SELECT id,status,hash,device_sequence FROM snapshots WHERE device_id=? AND capture_id=?').bind(deviceId,captureId).first();
 if(existing){if(existing.hash!==digest||existing.device_sequence!==sequence)throw new HttpError(409,'Capture identifier already used for different data');return json({id:existing.id,status:existing.status==='processing'?'pending':existing.status,duplicate:true});}
 // Only raw copies enter object storage; the device original is never written.
 await env.SAVES.put(`raw/${digest}`,bytes,{httpMetadata:{contentType:'application/octet-stream'}});
 const id=crypto.randomUUID();const received=now();
 await env.DB.prepare('INSERT OR IGNORE INTO snapshots(id,device_id,capture_id,device_sequence,captured_at,received_at,hash,filename,game_version) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,deviceId,captureId,sequence,captured.toISOString(),received,digest,filename,version).run();
 existing=await env.DB.prepare('SELECT id,status,hash,device_sequence FROM snapshots WHERE device_id=? AND capture_id=?').bind(deviceId,captureId).first();
 if(existing.hash!==digest||existing.device_sequence!==sequence)throw new HttpError(409,'Capture identifier already used for different data');
 if(deviceId!=='browser')await env.DB.prepare('UPDATE devices SET last_seen_at=? WHERE id=?').bind(received,deviceId).run();
 try{await env.INGEST.send({id:existing.id});}catch{console.error(JSON.stringify({event:'queue.pending',id:existing.id}));}
 return json({id:existing.id,status:existing.status==='processing'?'pending':existing.status,duplicate:existing.id!==id},202);
}
async function machine(request,env,url){
 if(url.pathname==='/api/device/pair'&&request.method==='POST'){
  await rateLimit(env,'pair:'+request.headers.get('cf-connecting-ip'),10,600);
  const body=await readJson(request);const code=text(body.code,80).toUpperCase().replace(/[-\s]/g,'');if(!/^[A-F0-9]{12}$/.test(code))throw new HttpError(400,'Pairing code is invalid or expired');
  const key=await hash(code);const claimed=await env.DB.prepare('UPDATE pairings SET claimed_at=? WHERE code_hash=? AND expires_at>? AND claimed_at IS NULL RETURNING code_hash').bind(now(),key,now()).first();
  if(!claimed)throw new HttpError(400,'Pairing code is invalid or expired');
  const token=randomToken();const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO devices(id,name,token_hash,created_at) VALUES (?,?,?,?)').bind(id,text(body.name,80)||'Retroid Classic',await hash(token),now()).run();return json({deviceId:id,token,uploadUrl:env.UPLOAD_ORIGIN});
 }
 const device=await requireDevice(request,env);
 if(url.pathname==='/api/device/upload'&&request.method==='POST')return ingest(request,env,device.id);
 const receipt=url.pathname.match(/^\/api\/device\/receipts\/([a-zA-Z0-9_-]+)$/);
 if(receipt&&request.method==='GET'){await rateLimit(env,'receipt:'+device.id,120);const row=await env.DB.prepare('SELECT id,status,error FROM snapshots WHERE id=? AND device_id=?').bind(receipt[1],device.id).first();if(!row)throw new HttpError(404,'Receipt not found');return json({...row,status:row.status==='processing'?'pending':row.status});}
 throw new HttpError(404,'Not found');
}
async function browserApi(request,env,url){
 const route=url.pathname;const method=request.method;
 if(!['GET','HEAD'].includes(method))requireOrigin(request);
 if(route==='/api/state'&&method==='GET'){
  // A delayed lower sequence from the same device never replaces a later ready capture.
  const latest=await env.DB.prepare("SELECT s.parsed_json FROM snapshots s WHERE s.status='ready' AND NOT EXISTS (SELECT 1 FROM snapshots n WHERE n.device_id=s.device_id AND n.status='ready' AND n.device_sequence>s.device_sequence) ORDER BY s.received_at DESC,s.device_sequence DESC LIMIT 1").first();
  const [snapshots,devices,plans,settings,events,notes]=await Promise.all([
   all(env.DB.prepare('SELECT id,captured_at,received_at,status,summary_json,error FROM snapshots ORDER BY received_at DESC LIMIT 100')),
   all(env.DB.prepare('SELECT id,name,created_at AS createdAt,last_seen_at AS lastSeenAt,revoked_at AS revokedAt FROM devices ORDER BY created_at DESC')),
   all(env.DB.prepare('SELECT data FROM plans ORDER BY updated_at DESC')),
   env.DB.prepare("SELECT data FROM settings WHERE id='context'").first(),
   all(env.DB.prepare('SELECT id,snapshot_id AS snapshotId,kind,text,created_at AS createdAt FROM events ORDER BY created_at DESC LIMIT 150')),
   all(env.DB.prepare('SELECT id,text,snapshot_id AS snapshotId,created_at AS createdAt FROM notes ORDER BY created_at DESC LIMIT 100'))]);
  return json({snapshot:latest?JSON.parse(latest.parsed_json):null,snapshots:snapshots.map(s=>s.summary_json?JSON.parse(s.summary_json):{id:s.id,capturedAt:s.captured_at,receivedAt:s.received_at,status:s.status==='processing'?'pending':s.status,error:s.error,partyNames:[],boxCount:0}),devices,plans:plans.map(p=>JSON.parse(p.data)),context:settings?JSON.parse(settings.data):DEFAULT_CONTEXT,events,notes});
 }
 if(route==='/api/catalog'&&method==='GET')return json(getCatalog());
 if(route==='/api/import'&&method==='POST')return ingest(request,env,'browser');
 if(route==='/api/pairings'&&method==='POST'){
  await rateLimit(env,'owner-pair',10,600);const raw=randomToken().slice(0,12).toUpperCase();const expiresAt=new Date(Date.now()+600000).toISOString();await env.DB.prepare('INSERT INTO pairings(code_hash,expires_at,created_at) VALUES (?,?,?)').bind(await hash(raw),expiresAt,now()).run();return json({code:raw.match(/.{4}/g).join('-'),expiresAt,uploadUrl:env.UPLOAD_ORIGIN});
 }
 const snap=route.match(/^\/api\/snapshots\/([\w-]+)$/);if(snap&&method==='GET'){const row=await env.DB.prepare('SELECT parsed_json,status,error FROM snapshots WHERE id=?').bind(snap[1]).first();if(!row)throw new HttpError(404,'Snapshot not found');if(!row.parsed_json)throw new HttpError(409,row.error||'Snapshot is still processing');return json(JSON.parse(row.parsed_json));}
 if(route==='/api/context'&&method==='PUT'){
  const body=await readJson(request);if(!['unknown','Vanilla','Difficult','Expert','Insane'].includes(body.difficulty)||!['hints','full'].includes(body.spoilerMode))throw new HttpError(400,'Choose a valid difficulty and spoiler setting');
  if(body.levelCap!==null&&(!Number.isInteger(body.levelCap)||body.levelCap<1||body.levelCap>100))throw new HttpError(400,'Level cap must be 1–100 or unknown');
  const oldSetting=await env.DB.prepare("SELECT data FROM settings WHERE id='context'").first();const oldContext=oldSetting?JSON.parse(oldSetting.data):{};
  const nextBattleId=body.nextBattleId===undefined?(oldContext.nextBattleId||null):body.nextBattleId;
  const fightReveal=body.fightReveal===undefined?(oldContext.fightReveal||'types'):body.fightReveal;
  if(nextBattleId!==null&&(typeof nextBattleId!=='string'||!/^[a-z0-9-]{1,100}$/.test(nextBattleId)))throw new HttpError(400,'Choose a valid fight');
  if(!['types','team','full'].includes(fightReveal))throw new HttpError(400,'Choose a valid fight spoiler level');
  const context={nextBattleId,fightReveal,difficulty:body.difficulty,levelCap:body.levelCap,checkpoint:text(body.checkpoint,300),spoilerMode:body.spoilerMode,favorites:Array.isArray(body.favorites)?body.favorites.filter(x=>typeof x==='string'&&x.length<100).slice(0,100):[]};
  await env.DB.prepare("INSERT INTO settings(id,data) VALUES ('context',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data").bind(JSON.stringify(context)).run();return json(context);
 }
 if(route==='/api/plans'&&method==='POST'){
  const body=await readJson(request);const ids=body.memberIds;if(!Array.isArray(ids)||ids.length>6||ids.some(x=>typeof x!=='string'||x.length>100)||new Set(ids).size!==ids.length)throw new HttpError(400,'Choose up to six distinct Pokémon');
  if(!text(body.name)||!Number.isInteger(body.weaknessLimit)||body.weaknessLimit<0||body.weaknessLimit>6)throw new HttpError(400,'Name and weakness limit are required');
  const id=body.id||crypto.randomUUID();if(!idPattern.test(id))throw new HttpError(400,'Invalid plan id');
  const shortlistIds=body.shortlistIds??ids;
  if(!Array.isArray(shortlistIds)||shortlistIds.length>24||shortlistIds.some(x=>typeof x!=='string'||x.length>100)||new Set(shortlistIds).size!==shortlistIds.length||ids.some(x=>!shortlistIds.includes(x)))throw new HttpError(400,'Shortlist must contain the active team and up to 24 distinct Pokémon');
  const plan={id,name:text(body.name,80),memberIds:ids,shortlistIds,inverse:body.inverse===true,weaknessLimit:body.weaknessLimit,hardLimit:body.hardLimit===true,updatedAt:now()};
  await env.DB.prepare('INSERT INTO plans(id,data,updated_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(id,JSON.stringify(plan),plan.updatedAt).run();return json(plan);
 }
 const plan=route.match(/^\/api\/plans\/([\w-]+)$/);if(plan&&method==='DELETE'){await env.DB.prepare('DELETE FROM plans WHERE id=?').bind(plan[1]).run();return json({ok:true});}
 if(route==='/api/notes'&&method==='POST'){const body=await readJson(request);const content=text(body.text,2000);if(!content)throw new HttpError(400,'Write a short note');const note={id:crypto.randomUUID(),text:content,snapshotId:text(body.snapshotId,80)||null,createdAt:now()};await env.DB.prepare('INSERT INTO notes(id,text,snapshot_id,created_at) VALUES (?,?,?,?)').bind(note.id,note.text,note.snapshotId,note.createdAt).run();return json(note);}
 const revoke=route.match(/^\/api\/devices\/([\w-]+)\/revoke$/);if(revoke&&method==='POST'){await env.DB.prepare('UPDATE devices SET revoked_at=? WHERE id=?').bind(now(),revoke[1]).run();return json({ok:true});}
 throw new HttpError(404,'Not found');
}
export default {
 async fetch(request,env,ctx){try{
  const url=new URL(request.url);const local=localRequest(request,env);
  if(!local&&url.protocol!=='https:')return Response.redirect('https://'+url.host+url.pathname+url.search,308);
  if((!local&&url.hostname===env.UPLOAD_HOSTNAME)||(local&&url.pathname.startsWith('/api/device/'))){if(!url.pathname.startsWith('/api/device/'))throw new HttpError(404,'Not found');return secure(await machine(request,env,url));}
  if(!local&&url.hostname!==env.DASHBOARD_HOSTNAME)throw new HttpError(404,'Not found');
  await requireOwner(request,env);
  if(url.pathname.startsWith('/api/'))return secure(await browserApi(request,env,url));
  if(!['GET','HEAD'].includes(request.method))throw new HttpError(405,'Method not allowed');
  return secure(await env.ASSETS.fetch(request));
 }catch(e){if(!(e instanceof HttpError))console.error(JSON.stringify({event:'request.failed',type:e.name}));return secure(json({error:e instanceof HttpError?e.message:'Request failed. Please retry.'},e.status||500));}},
 async queue(batch,env){for(const message of batch.messages){try{if(typeof message.body?.id!=='string'){message.ack();continue;}await processSnapshot(env,message.body.id);message.ack();}catch{message.retry({delaySeconds:60});}}},
 async scheduled(controller,env,ctx){await reconcile(env);}
};
