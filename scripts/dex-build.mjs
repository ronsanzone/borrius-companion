import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import data from '../app/src/vendor/catalog-data.js';
import metadata from '../app/src/vendor/move-metadata.js';
const root = new URL('../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const source = '.cache/DPE/';
const revision=execFileSync('git',['-C',fileURLToPath(new URL(source,root)),'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(revision!=='fe058e0e3ac23cf968cf950de43332135bc1549d')throw new Error('DPE checkout does not match pinned reference commit');
function constants(path, prefix) {
 const map = {};
 for (const m of read(source+path).matchAll(new RegExp(`#define\\s+(${prefix}\\w+)\\s+(0x[\\da-fA-F]+|\\d+)\\b`, 'g'))) map[m[1]]=Number(m[2]);
 return map;
}
const speciesIds=constants('include/species.h','SPECIES_'), moveIds=constants('include/moves.h','MOVE_');
const learns=read(source+'src/Learnsets.c'), sets={};
for(const m of learns.matchAll(/static const struct LevelUpMove (\w+)\[\] = \{([\s\S]*?)\};/g)) sets[m[1]]=[...m[2].matchAll(/LEVEL_UP_MOVE\(\s*(\d+),\s*(MOVE_\w+)\)/g)].map(x=>({level:+x[1],moveId:moveIds[x[2]]})).filter(x=>x.moveId);
const learnById={};for(const m of learns.matchAll(/\[(SPECIES_\w+)\]\s*=\s*(\w+),/g)) learnById[speciesIds[m[1]]]=sets[m[2]]||[];
const eggs={};for(const m of read(source+'src/Egg_Moves.c').matchAll(/egg_moves\((\w+),([\s\S]*?)\)/g)) eggs[speciesIds['SPECIES_'+m[1]]]=[...m[2].matchAll(/MOVE_\w+/g)].map(x=>moveIds[x[0]]).filter(Boolean);
const evo={};for(const m of read(source+'src/Evolution Table.c').matchAll(/\[(SPECIES_\w+)\]\s*=\s*\{([\s\S]*?)\},\s*(?=\n\s*\[|\n\};)/g)) {
 evo[speciesIds[m[1]]]=[...m[2].matchAll(/\{(EVO_\w+),\s*([^,]+),\s*(SPECIES_\w+),\s*([^}]+)\}/g)].map(x=>({method:x[1],parameter:x[2].trim(),target:speciesIds[x[3]],extra:x[4].trim()})).filter(x=>x.target && !['EVO_MEGA','EVO_GIGANTAMAX','EVO_PRIMAL'].includes(x.method));
}
const symbols=Object.fromEntries(Object.entries(speciesIds).map(([key,id])=>[id,key]));
const moves=Object.fromEntries(Object.entries(data.moves).map(([id,v])=>[id,{id:+id,name:typeof v==='string'?v:v.name,...metadata.moves[id]}]));
const species=Object.values(data.species).filter(s=>s.dexId && s.dexId<=809).map(s=>({speciesId:s.speciesId,dexId:s.dexId,name:s.name,types:s.types,baseStats:s.baseStats,symbol:symbols[s.speciesId],abilities:[...new Set([s.abilities.ability_1_id,s.abilities.ability_2_id].filter(Boolean))].map(id=>data.abilities[id]),hiddenAbility:data.abilities[s.abilities.hidden_ability_id]||null,learnset:learnById[s.speciesId]||[],eggMoves:eggs[s.speciesId]||[],evolutions:evo[s.speciesId]||[]}));
const normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const moveByName={...Object.fromEntries(Object.entries(moveIds).map(([name,id])=>[normalize(name.replace('MOVE_','')),id])),...Object.fromEntries(Object.values(moves).map(m=>[normalize(m.name),m.id]))};
for(const [folder,field] of [['tm_compatibility','machineMoves'],['tutor_compatibility','tutorMoves']]) {
 const assigned={};
 for(const file of fs.readdirSync(new URL(source+'src/'+folder,root)).sort()) {
  const moveId=moveByName[normalize(file.replace(/^\d+ - /,'').replace(/\.txt$/,''))];
  if(!moveId)throw new Error('Unmapped move file '+file);
  for(const name of read(source+'src/'+folder+'/'+file).split(/\r?\n/).slice(1)) {const id=speciesIds['SPECIES_'+name.trim()];if(id)(assigned[id]??=[]).push(moveId);}
 }
 for(const s of species)s[field]=[...new Set(assigned[s.speciesId]||[])];
}
const output={version:1,source:{url:'https://github.com/Skeli789/Dynamic-Pokemon-Expansion/tree/fe058e0e3ac23cf968cf950de43332135bc1549d',commit:'fe058e0e3ac23cf968cf950de43332135bc1549d',branch:'Unbound',notice:'Base stats and abilities use the save parser catalog. Learnsets and evolution references use the Unbound expansion source also used by Yda Dex; exact agreement with your 2.1.1.1 ROM is not verified. This reference does not establish encounter availability.'},species,moves};
fs.writeFileSync(new URL('app/public/data/dex.json',root),JSON.stringify(output));
console.log(`${species.length} species/forms, ${Object.keys(moves).length} moves, ${species.filter(s=>s.learnset.length).length} learnsets, ${species.filter(s=>s.evolutions.length).length} evolutions`);
