/** Read-only Unbound 2.1.1.1 adapter. Layout/catalog derived from MIT PUSE
 * eb1ac0094c97f9c406fdd26066b4638676fbd3c3; see vendor/PUSE-LICENSE.
 * Cartridge format is asserted by caller, not detected from the filename. */
import data from './vendor/catalog-data.js';
import charmap from './vendor/save-charmap.js';
import moveMetadata from './vendor/move-metadata.js';
import {ru16,ru32} from './vendor/binary.js';
import {calcCurrentLevel} from './vendor/growth.js';
import {resolveQuickPockets,mapPocketFromAnchor,collectOwnedTmhmItemIds} from './vendor/bag.js';
const VERSION='unbound-readonly-3';
const NATURES='Hardy Lonely Brave Adamant Naughty Bold Docile Relaxed Impish Lax Timid Hasty Serious Jolly Naive Modest Mild Quiet Bashful Rash Calm Gentle Sassy Careful Quirky'.split(' ');
const KEYS=['hp','atk','def','spe','spa','spd'];
const lengths=[0xADC,0xFF0,0xFF0,0xFF0,0xD98,...Array(8).fill(0xFF4),0x450];
function fail(message){throw new Error(`Unsupported or corrupt save: ${message}`);}
function checksum(b,off,len){let total=0;for(let i=0;i<len;i+=4)total=(total+ru32(b,off+i))>>>0;return ((total>>>16)+(total&65535))&65535;}
function activeBank(b){
  const banks=[0,14].map(start=>Array.from({length:14},(_,i)=>{const off=(start+i)*4096;return {off,id:ru16(b,off+0xff4),idx:ru32(b,off+0xffc),signature:ru32(b,off+0xff8)};}));
  const candidates=banks.filter(bank=>bank.some(s=>s.signature===0x08012025||s.signature===0x01121999));
  if(!candidates.length)fail('no recognized cartridge bank signature');
  // Counter wrap is deliberately unsupported rather than choosing stale progress.
  const counters=candidates.flat().filter(s=>s.signature===0x01121999||s.signature===0x08012025).map(s=>s.idx);
  if(Math.max(...counters)-Math.min(...counters)>0x7fffffff)fail('save counter wrap requires parser update');
  const latest=Math.max(...counters);
  const matches=candidates.filter(bank=>bank.some(s=>s.idx===latest));
  if(matches.length!==1)fail('ambiguous active save bank');
  const bank=matches[0];
  if(bank.some(s=>s.idx!==latest||s.signature!==0x01121999)||new Set(bank.map(s=>s.id)).size!==14||bank.some(s=>s.id>13))fail('incomplete active bank; save again after the game finishes writing');
  for(const s of bank)if(checksum(b,s.off,lengths[s.id])!==ru16(b,s.off+0xff6))fail(`section ${s.id} checksum mismatch`);
  return new Map(bank.map(s=>[s.id,s.off]));
}
function text(b){let s='';for(const c of b){if(c===255)break;s+=charmap[c]??'?';}return s;}
function readMon(raw,location){
  const party=location.kind==='party';const speciesId=ru16(raw,party?0x20:0x1c),spec=data.species[speciesId];
  if(!spec)fail(`unknown species ${speciesId} at ${JSON.stringify(location)}`);
  const exp=ru32(raw,party?0x24:0x20),pid=ru32(raw,0),otid=ru32(raw,4);
  if(!Number.isInteger(spec.growthRate)||exp>2000000)fail('invalid Pokémon experience or unknown growth rate');
  const ivPacked=ru32(raw,party?0x48:0x36),evOff=party?0x38:0x2c;
  const ivs=Object.fromEntries(KEYS.map((k,i)=>[k,(ivPacked>>>(i*5))&31]));
  const evs=Object.fromEntries(KEYS.map((k,i)=>[k,raw[evOff+i]]));
  let packed=0n;if(!party)for(let i=0;i<5;i++)packed|=BigInt(raw[0x27+i])<<BigInt(8*i);
  const ups=raw[party?0x28:0x24];
  const moves=Array.from({length:4},(_,i)=>{
    const id=party?ru16(raw,0x2c+i*2):Number((packed>>BigInt(i*10))&1023n);
    if(!id)return null;
    const m=data.moves[id];if(!m)fail(`unknown move ${id}`);
    const maxPp=m.basePp+Math.floor(m.basePp*((ups>>>(i*2))&3)/5),pp=party?raw[0x34+i]:null;
    if(pp!==null&&pp>maxPp)fail(`move ${id} PP out of range`);
    const meta=moveMetadata.moves[id]||{type:null,power:null,accuracy:null,category:'unknown'};
    return {id,name:m.name,...meta,pp,maxPp};
  }).filter(Boolean);
  const level=party?raw[0x54]:calcCurrentLevel(spec.growthRate,exp);
  if(level<1||level>100)fail('party level out of range');
  const abilitySlot=ivPacked>>>31?2:pid&1;
  const a=spec.abilities;const aid=abilitySlot===2?a.hidden_ability_id:abilitySlot===1?(a.ability_2_id||a.ability_1_id):(a.ability_1_id||a.ability_2_id);
  const itemId=ru16(raw,party?0x22:0x1e);
  const stats=party?{hp:ru16(raw,0x58),atk:ru16(raw,0x5a),def:ru16(raw,0x5c),spe:ru16(raw,0x5e),spa:ru16(raw,0x60),spd:ru16(raw,0x62)}:null;
  const hp=party?{current:ru16(raw,0x56),max:stats.hp}:null;
  if(hp&&(hp.max<1||hp.current>hp.max))fail('party HP out of range');
  return {id:`mon-${otid.toString(16).padStart(8,'0')}-${pid.toString(16).padStart(8,'0')}`,identityConfidence:'candidate',speciesId,dexId:spec.dexId??null,name:spec.name,nickname:text(raw.subarray(8,18)),level,types:spec.types,nature:NATURES[pid%25],ability:data.abilities[aid]||'Unknown',item:itemId===0?'None':data.items[itemId]||`Unknown item ${itemId}`,moves,ivs,evs,stats,hp,location,baseStats:spec.baseStats};
}
export function getCatalog(){return {species:Object.values(data.species).map(({speciesId,dexId,name,types,baseStats})=>({speciesId,dexId:dexId??null,name,types,baseStats}))};}
export function parseSave(input,{gameVersion='2.1.1.1'}={}){
  if(gameVersion!=='2.1.1.1')fail('only explicitly selected Unbound 2.1.1.1 is supported');
  if(!(input instanceof Uint8Array)||input.length!==131072)fail('expected a 128 KiB cartridge save, not a save state');
  const b=new Uint8Array(input),sections=activeBank(b),trainer=sections.get(1),count=ru32(b,trainer+0x34);
  if(count<1||count>6)fail('party count must be 1–6');
  const party=Array.from({length:count},(_,i)=>readMon(b.subarray(trainer+0x38+i*100,trainer+0x38+(i+1)*100),{kind:'party',slot:i+1}));
  const stream=new Uint8Array(8*0xff0);for(let id=5;id<=12;id++)stream.set(b.subarray(sections.get(id)+4,sections.get(id)+0xff4),(id-5)*0xff0);
  const boxes=Array.from({length:25},(_,i)=>({box:i+1,pokemon:[]}));
  for(let off=0,index=0;off+58<=stream.length;off+=58,index++){
    const raw=stream.subarray(off,off+58);if(raw.every(x=>x===0))continue;
    const box=Math.floor(index/30)+1;boxes[box-1].pokemon.push(readMon(raw,{kind:'box',box,slot:index%30+1}));
  }
  const warnings=[
    'Game version 2.1.1.1 is supplied by the uploader; it is not detected from save contents.',
    'Box inventory is provisional: only boxes 1–18 and slots 1–22 of box 19 are supported. Later storage is not decoded; empty lists there do not establish that those boxes are empty.',
    'Box current PP and battle stats are unknown. Move metadata is extracted from the owner’s verified 2.1.1.1 ROM; dynamic power/types, ability changes and battle effects are not simulated. Accuracy null denotes a bypass/special accuracy rule; power null denotes variable/fixed damage.',
    'Progress and inventory are experimental. Difficulty, level cap, location and next objective are not inferred.',
    'Candidate identity uses original-trainer ID and personality; duplicates are marked ambiguous. This is not a guaranteed permanent identity.',
    'Sector checksums verified. This Unbound layout does not store a standard per-Pokémon checksum; expanded data outside the documented checksum lengths is not independently verified.'
  ];
  const all=[...party,...boxes.flatMap(x=>x.pokemon)],counts=new Map();for(const m of all)counts.set(m.id,(counts.get(m.id)||0)+1);
  for(const m of all)if(counts.get(m.id)>1){m.identityConfidence='ambiguous';m.id+=`-${m.location.kind}-${m.location.box||0}-${m.location.slot}`;}
  const flag=id=>{let off=0xee0+Math.floor(id/8),section=1;while(off>=0xff0){off-=0xff0;section++;}return Boolean(b[sections.get(section)+off]&(1<<(id%8)));};
  const progress={badges:Array.from({length:8},(_,i)=>flag(0x820+i)).filter(Boolean).length,isChampion:flag(0x82c),money:ru32(b,trainer+0x290),heartScales:null,ownedTms:[],provenance:'experimental',difficulty:null,levelCap:null};
  // Restrict experimental inventory scans to the selected bank to avoid stale items.
  const selected=new Uint8Array(b.length);for(const [id,off] of sections)selected.set(b.subarray(off,off+4096),off);
  try{const pockets=resolveQuickPockets(selected),main=pockets.main;if(main&&Number.isInteger(main.anchor_offset))progress.heartScales=mapPocketFromAnchor(selected,main.anchor_offset,new Map()).filter(x=>x.id===111).reduce((sum,x)=>sum+x.qty,0);const ids=collectOwnedTmhmItemIds(selected).owned_tmhm_item_ids;progress.ownedTms=ids.map(id=>data.items[id]||`Item ${id}`);}catch{warnings.push('Experimental bag reader could not establish inventory.');}
  return {party,boxes,progress,warnings,parserVersion:VERSION,gameVersion};
}
