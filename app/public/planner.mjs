import {TYPES,multiplier} from './domain.mjs';
export function exposure(roster, activeIds, inverse, threshold) {
 const active=new Set(activeIds);
 return TYPES.map(type=>{
  const count=roster.filter(p=>active.has(p.id)&&multiplier(type,p.types,inverse)>1).length;
  return {type,count,flagged:count>=threshold};
 });
}
export function toggleActive(ids,id,replacement=null) {
 if(replacement && ids.includes(id) && !ids.includes(replacement))return ids.map(x=>x===id?replacement:x);
 if(ids.includes(id))return ids.filter(x=>x!==id);
 return ids.length<6?[...ids,id]:ids;
}
