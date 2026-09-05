import {TYPES,multiplier,hasOrdinaryTypeDamage} from './domain.mjs';
const normalizedType=t=>String(t||'').toLowerCase();
export function battleTypes(defender,rules={}) {
 if(typeof rules==='boolean')rules={inverse:rules};
 if((rules.notes||[]).join(' ').toLowerCase().includes('camomons')){
  const first=(defender.moves||[]).slice(0,2);if(first.length<2||first.some(m=>!m.type))return [];
  return [...new Set(first.map(m=>normalizedType(m.type)))];
 }
 return (defender.types||[]).map(normalizedType);
}
export function battleMultiplier(type, defender, rules={}) {
 if(typeof rules==='boolean')rules={inverse:rules};
 const ts=battleTypes(defender,rules);if(!ts.length)return null;
 const notes=(rules.notes||[]).join(' ').toLowerCase();type=normalizedType(type);
 if(type==='fairy'&&notes.includes('fairy-type moves ban'))return 0;
 if(type==='fire'&&notes.includes('heavy rain'))return 0;
 if(type==='ground'&&notes.includes('magnet rise')&&ts.some(t=>['electric','steel'].includes(t)))return 0;
 let value=multiplier(type,ts,rules.inverse===true);
 if(notes.includes('strong winds')&&ts.includes('flying')&&!rules.inverse&&multiplier(type,['flying'])>1)value/=2;
 return value;
}
export function offensiveOptions(mon,foe,inverse=false) {
 return (mon.moves||[]).filter(m=>hasOrdinaryTypeDamage(m)&&m.pp!==0).map(m=>({move:m,multiplier:battleMultiplier(m.type,foe,inverse)})).filter(x=>x.multiplier>1).sort((a,b)=>b.multiplier-a.multiplier);
}
export function incomingExposure(mon,foes,inverse=false) {
 const attackTypes=[...new Set(foes.flatMap(f=>(f.moves||[]).filter(hasOrdinaryTypeDamage).map(m=>normalizedType(m.type))))];
 return attackTypes.map(type=>({type,multiplier:battleMultiplier(type,mon,inverse)})).filter(x=>x.multiplier>1).sort((a,b)=>b.multiplier-a.multiplier);
}
export function analyzeFight(active,owned,foes,inverse=false) {
 const coverage=foes.map((foe,index)=>({foe,index,answers:active.map(mon=>({mon,options:offensiveOptions(mon,foe,inverse)})).filter(x=>x.options.length)}));
 const uncovered=coverage.filter(x=>x.foe.types.length&&!x.answers.length);
 const activeIds=new Set(active.map(p=>p.id));
 const candidates=owned.filter(p=>!activeIds.has(p.id)).map(mon=>{
  const targets=foes.flatMap((f,i)=>offensiveOptions(mon,f,inverse).length?[i]:[]);
  const fills=targets.filter(i=>uncovered.some(x=>x.index===i));
  return {mon,targets,fills,risks:incomingExposure(mon,foes,inverse)};
 }).filter(x=>x.targets.length).sort((a,b)=>b.fills.length-a.fills.length||b.targets.length-a.targets.length||a.risks.length-b.risks.length||b.mon.level-a.mon.level);
 const attackTypes=TYPES.map(type=>({type,targets:foes.filter(f=>battleMultiplier(type,f,inverse)>1).length})).filter(x=>x.targets).sort((a,b)=>b.targets-a.targets);
 return {coverage,uncovered,candidates,attackTypes};
}
