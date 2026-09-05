import {parseSave} from './parser.js';
import {now} from './security.js';
export function changes(previous,current){
 if(!previous)return [{kind:'import',text:`Snapshot recorded: ${current.party.length} party Pokémon and ${current.boxes.reduce((s,b)=>s+b.pokemon.length,0)} boxed Pokémon.`}];
 const out=[];const flatten=s=>[...s.party,...s.boxes.flatMap(b=>b.pokemon)];const old=new Map(flatten(previous).filter(p=>p.identityConfidence!=='ambiguous').map(p=>[p.id,p]));
 for(const mon of flatten(current)){
  if(mon.identityConfidence==='ambiguous')continue;
  const before=old.get(mon.id);if(!before){out.push({kind:'roster',text:`${mon.nickname||mon.name} (${mon.name}) was first observed in this snapshot.`});continue;}
  const details=[];if(before.level!==mon.level)details.push(`level ${before.level} → ${mon.level}`);if(before.name!==mon.name)details.push(`${before.name} → ${mon.name}`);
  if(JSON.stringify(before.moves.map(m=>m.id))!==JSON.stringify(mon.moves.map(m=>m.id)))details.push('moves changed');if(before.item!==mon.item)details.push(`held item ${before.item} → ${mon.item}`);
  if(details.length)out.push({kind:'build',text:`${mon.nickname||mon.name}: ${details.join('; ')}.`});
 }
 if(previous.party.map(p=>p.id).join(',')!==current.party.map(p=>p.id).join(','))out.push({kind:'party',text:'The saved party or its order changed.'});
 if(previous.progress.badges!==null&&current.progress.badges!==null&&previous.progress.badges!==current.progress.badges)out.push({kind:'progress',text:`Experimental badge reading changed from ${previous.progress.badges} to ${current.progress.badges}; confirm in game.`});
 return out.slice(0,100);
}
export async function processSnapshot(env,id){
 const lease=new Date(Date.now()+120000).toISOString();
 const row=await env.DB.prepare("UPDATE snapshots SET status='processing',lease_until=?,attempts=attempts+1 WHERE id=? AND (status='pending' OR (status='processing' AND lease_until<?)) RETURNING *").bind(lease,id,now()).first();
 if(!row)return;
 try{
  const raw=await env.SAVES.get(`raw/${row.hash}`);if(!raw)throw Error('Snapshot bytes unavailable');
  let decoded;try{decoded=parseSave(new Uint8Array(await raw.arrayBuffer()),{gameVersion:row.game_version});}catch(e){await env.DB.prepare("UPDATE snapshots SET status='failed',error=?,lease_until=NULL WHERE id=?").bind('Save could not be validated: '+String(e.message).slice(0,180),id).run();return;}
  const current={...decoded,id:row.id,capturedAt:row.captured_at,receivedAt:row.received_at,hash:row.hash,filename:row.filename};
  const summary={id:row.id,capturedAt:row.captured_at,receivedAt:row.received_at,status:'ready',partyNames:current.party.map(p=>p.name),boxCount:current.boxes.reduce((s,b)=>s+b.pokemon.length,0)};
  const writes=[env.DB.prepare("UPDATE snapshots SET status='ready',parsed_json=?,summary_json=?,error=NULL,lease_until=NULL WHERE id=?").bind(JSON.stringify(current),JSON.stringify(summary),id)];
  await env.DB.batch(writes);await refreshEvents(env,row.id);const next=await env.DB.prepare("SELECT id FROM snapshots WHERE status='ready' AND device_id=? AND device_sequence>? ORDER BY device_sequence LIMIT 1").bind(row.device_id,row.device_sequence).first();if(next)await refreshEvents(env,next.id);console.log(JSON.stringify({event:'snapshot.ready',id,party:current.party.length,boxes:summary.boxCount}));
 }catch(e){await env.DB.prepare("UPDATE snapshots SET status='pending',lease_until=NULL,error=? WHERE id=?").bind('Processing interrupted; retry pending',id).run();console.error(JSON.stringify({event:'snapshot.retry',id}));throw e;}
}
export async function reconcile(env){
 const rows=await env.DB.prepare("SELECT id FROM snapshots WHERE status='pending' OR (status='processing' AND lease_until<?) ORDER BY received_at LIMIT 30").bind(now()).all();
 for(const row of rows.results){try{await env.INGEST.send({id:row.id});}catch{console.error(JSON.stringify({event:'queue.reconcile_failed',id:row.id}));}}
 await env.DB.batch([env.DB.prepare('DELETE FROM request_limits WHERE expires_at<?').bind(Math.floor(Date.now()/1000)),env.DB.prepare('DELETE FROM pairings WHERE expires_at<?').bind(now())]);
}

export async function refreshEvents(env,id){
 const row=await env.DB.prepare("SELECT * FROM snapshots WHERE id=? AND status='ready'").bind(id).first();if(!row)return;
 const prev=await env.DB.prepare("SELECT parsed_json FROM snapshots WHERE status='ready' AND device_id=? AND device_sequence<? ORDER BY device_sequence DESC LIMIT 1").bind(row.device_id,row.device_sequence).first();
 const events=changes(prev?JSON.parse(prev.parsed_json):null,JSON.parse(row.parsed_json));
 const writes=[env.DB.prepare('DELETE FROM events WHERE snapshot_id=?').bind(id)];
 for(let i=0;i<events.length;i++)writes.push(env.DB.prepare('INSERT INTO events(id,snapshot_id,kind,text,created_at) VALUES (?,?,?,?,?)').bind(`${id}:${i}`,id,events[i].kind,events[i].text,row.captured_at));
 await env.DB.batch(writes);
}
