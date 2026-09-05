// Read-only diagnostic adapter. Requires a local checkout of Zannael/PUSE.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const [checkout, input, output] = process.argv.slice(2);
if (!checkout || !input || !output) throw new Error('Usage: node scripts/inspect-save.mjs PUSE_CHECKOUT SAVE OUTPUT_JSON');
if (path.resolve(input) === path.resolve(output)) throw new Error('Output must differ from input');
const base = path.resolve(checkout, 'frontend');
const moduleAt = name => import(pathToFileURL(path.join(base, 'src/core', name)));
// Catalog requests resolve only to the local checkout; no save data is uploaded.
globalThis.fetch = async url => {
  const file = String(url);
  if (!/^\/data\/[a-zA-Z0-9_.-]+$/.test(file)) throw new Error(`Unexpected catalog path: ${file}`);
  const data = await fs.readFile(path.join(base, 'public', file));
  return { ok: true, text: async () => data.toString(), json: async () => JSON.parse(data) };
};
const { loadCatalog, getSpeciesMap, getMovesList, getItemsList } = await moduleAt('catalog.js');
const { getParty } = await moduleAt('party.js');
const { loadPcContext, getPcBox } = await moduleAt('pc.js');
const { listSections } = await moduleAt('sections.js');
await loadCatalog();
const bytes = new Uint8Array(await fs.readFile(input));
if (bytes.length !== 131072) throw new Error('Diagnostic currently accepts only 128 KiB cartridge saves');
const hash = data => createHash('sha256').update(data).digest('hex');
const before = hash(bytes);
const species = await getSpeciesMap();
const moves = new Map((await getMovesList()).map(x => [x.id,x.name]));
const items = new Map((await getItemsList()).map(x => [x.id,x.name]));
const decorate = mon => ({...mon, move_names: mon.moves.map(id => id === 0 ? null : moves.get(id) ?? `Unknown move ${id}`), item_name: mon.item_id === 0 ? 'None' : items.get(mon.item_id) ?? `Unknown item ${mon.item_id}`});
const party = getParty(bytes, species).map(decorate);
if (!party.length || party.some(p => !species.has(p.species_id) || p.level < 1 || p.level > 100)) throw new Error('Party failed basic plausibility checks');
const pc = loadPcContext(bytes);
const boxes = Array.from({length:25}, (_,i) => ({box:i+1, pokemon:getPcBox(pc,i+1,species).map(decorate)}));
if (before !== hash(bytes) || before !== hash(await fs.readFile(input))) throw new Error('Input changed during inspection');
const result = {status:'experimental; not yet verified against game screens', source:path.basename(input), sha256:before, parser:'https://github.com/Zannael/PUSE', expectedParserCommit:'eb1ac0094c97f9c406fdd26066b4638676fbd3c3', warnings:['Game version is inferred from filename, not decoded.', 'PUSE section selection and PC fallback heuristics need further validation.', 'Ability and species data come from PUSE catalogs; validate against game.', 'Difficulty, level cap, story progress, health and calculated battle stats are not validated.', 'PC preset sector is excluded from owned box inventory.'], sections:listSections(bytes), party, boxes};
await fs.writeFile(output, JSON.stringify(result,null,2), {flag:'wx'});
console.log(JSON.stringify({party:party.map(p=>({species:p.species_name,level:p.level,nature:p.nature,ability:p.effective_ability_name,item:p.item_name,moves:p.move_names})), boxes:boxes.filter(b=>b.pokemon.length).map(b=>({box:b.box,count:b.pokemon.length,species:b.pokemon.map(p=>p.species_name)}))},null,2));
