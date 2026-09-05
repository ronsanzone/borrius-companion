import type { Pokemon, PokemonMove, PokemonLocation, StatBlock } from "../shared/types";
import data from "../vendor/catalog-data.js";
import charmap from "../vendor/save-charmap.js";
import moveMetadata from "../vendor/move-metadata.js";
import { ru16, ru32 } from "../vendor/binary.js";
import { calcCurrentLevel } from "../vendor/growth.js";
import { fail } from "./errors";
function readStats(read: (index: number) => number): StatBlock {
  return { hp: read(0), atk: read(1), def: read(2), spe: read(3), spa: read(4), spd: read(5) };
}
const NATURES =
  "Hardy Lonely Brave Adamant Naughty Bold Docile Relaxed Impish Lax Timid Hasty Serious Jolly Naive Modest Mild Quiet Bashful Rash Calm Gentle Sassy Careful Quirky".split(
    " ",
  );

function text(b: Uint8Array) {
  let s = "";
  for (const c of b) {
    if (c === 255) break;
    s += charmap[c] ?? "?";
  }
  return s;
}
export function readMon(raw: Uint8Array, location: PokemonLocation): Pokemon {
  const party = location.kind === "party";
  const speciesId = ru16(raw, party ? 0x20 : 0x1c),
    spec = data.species[speciesId];
  if (!spec) fail(`unknown species ${speciesId} at ${JSON.stringify(location)}`);
  const exp = ru32(raw, party ? 0x24 : 0x20),
    pid = ru32(raw, 0),
    otid = ru32(raw, 4);
  if (!Number.isInteger(spec.growthRate) || exp > 2000000)
    fail("invalid Pokémon experience or unknown growth rate");
  const ivPacked = ru32(raw, party ? 0x48 : 0x36),
    evOff = party ? 0x38 : 0x2c;
  const ivs = readStats((i) => (ivPacked >>> (i * 5)) & 31);
  const evs = readStats((i) => raw[evOff + i]);
  let packed = 0n;
  if (!party) for (let i = 0; i < 5; i++) packed |= BigInt(raw[0x27 + i]) << BigInt(8 * i);
  const ups = raw[party ? 0x28 : 0x24];
  const moves = Array.from({ length: 4 }, (_, i) => {
    const id = party ? ru16(raw, 0x2c + i * 2) : Number((packed >> BigInt(i * 10)) & 1023n);
    if (!id) return null;
    const m = data.moves[id];
    if (!m) fail(`unknown move ${id}`);
    const maxPp = m.basePp + Math.floor((m.basePp * ((ups >>> (i * 2)) & 3)) / 5),
      pp = party ? raw[0x34 + i] : null;
    if (pp !== null && pp > maxPp) fail(`move ${id} PP out of range`);
    const meta = moveMetadata.moves[id] || {
      type: null,
      power: null,
      accuracy: null,
      category: "unknown",
    };
    return { id, name: m.name, ...meta, pp, maxPp };
  }).filter((move): move is PokemonMove => move !== null);
  const level = party ? raw[0x54] : calcCurrentLevel(spec.growthRate, exp);
  if (level < 1 || level > 100) fail("party level out of range");
  const abilitySlot = ivPacked >>> 31 ? 2 : pid & 1;
  const a = spec.abilities;
  const aid =
    abilitySlot === 2
      ? a.hidden_ability_id
      : abilitySlot === 1
        ? a.ability_2_id || a.ability_1_id
        : a.ability_1_id || a.ability_2_id;
  const itemId = ru16(raw, party ? 0x22 : 0x1e);
  const stats = party
    ? {
        hp: ru16(raw, 0x58),
        atk: ru16(raw, 0x5a),
        def: ru16(raw, 0x5c),
        spe: ru16(raw, 0x5e),
        spa: ru16(raw, 0x60),
        spd: ru16(raw, 0x62),
      }
    : null;
  const hp = party ? { current: ru16(raw, 0x56), max: ru16(raw, 0x58) } : null;
  if (hp && (hp.max < 1 || hp.current > hp.max)) fail("party HP out of range");
  return {
    id: `mon-${otid.toString(16).padStart(8, "0")}-${pid.toString(16).padStart(8, "0")}`,
    identityConfidence: "candidate",
    speciesId,
    dexId: spec.dexId ?? null,
    name: spec.name,
    nickname: text(raw.subarray(8, 18)),
    level,
    types: spec.types,
    nature: NATURES[pid % 25],
    ability: data.abilities[aid] || "Unknown",
    item: itemId === 0 ? "None" : data.items[itemId] || `Unknown item ${itemId}`,
    moves,
    ivs,
    evs,
    stats,
    hp,
    location,
    baseStats: spec.baseStats,
  };
}
