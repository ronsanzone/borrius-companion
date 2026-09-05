import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filterDex,evolutionLabel} from '../public/dex.mjs';
const d=JSON.parse(fs.readFileSync(new URL('../public/data/dex.json',import.meta.url),'utf8'));
test('dex search joins learnsets, abilities and types while owned filter uses species ID',()=>{
 const j=filterDex(d.species,d.moves,{query:'joltik'})[0];assert.equal(j.dexId,595);assert.equal(j.speciesId,648);
 assert(filterDex(d.species,d.moves,{query:'compound eyes',type:'Electric'}).some(s=>s.name==='Joltik'));
 assert(filterDex(d.species,d.moves,{query:'Thunderbolt',ownedOnly:true,ownedIds:[648]}).some(s=>s.name==='Joltik'));
 assert.equal(filterDex(d.species,d.moves,{query:'joltik',ownedOnly:true,ownedIds:[595]}).length,0);
});
test('reference retains known evolution and precise move identifiers',()=>{
 const j=d.species.find(s=>s.name==='Joltik');const evo=j.evolutions[0];assert.equal(evolutionLabel(evo),'Level 36');assert.equal(d.species.find(s=>s.speciesId===evo.target).name,'Galvantula');
 assert.equal(d.moves[85].name,'Thunderbolt');assert.equal(d.moves[85].power,95);
 const eevee=d.species.find(s=>s.name==='Eevee');assert.equal(eevee.evolutions.length,8);
});
test('all displayed learnset references resolve without missing names',()=>{
 assert(d.species.length>1000);
 for(const s of d.species){assert.equal(s.baseStats.length,6);assert(s.abilities.every(Boolean));for(const id of [...s.learnset.map(m=>m.moveId),...s.eggMoves,...s.machineMoves,...s.tutorMoves])assert(d.moves[id]?.name,`${s.name} missing ${id}`);}
 assert.match(d.source.notice,/not verified/);
});
