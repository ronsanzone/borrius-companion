import { TYPES, typeEffectiveness } from "./type-chart";
import type { Pokemon, Combatant, Move } from "./types";
export { TYPES } from "./type-chart";
export function multiplier(attack: string, defenders: readonly string[], inverse = false) {
  return defenders.reduce((v, d) => {
    let n = typeEffectiveness(attack.toLowerCase(), d.toLowerCase());
    return v * (inverse ? (n === 0 ? 2 : 1 / n) : n);
  }, 1);
}
export function weaknesses(team: readonly Combatant[], inverse = false) {
  return TYPES.map((type) => ({
    type,
    count: team.filter((p) => multiplier(type, p.types, inverse) > 1).length,
  })).sort((a, b) => b.count - a.count);
}
export function opportunities(team: readonly Pokemon[], cap: number | null) {
  return team.flatMap((p) => {
    const tips = [];
    if (!p.item || /^(none|no item)$/i.test(p.item)) {
      const hasAcrobatics = p.moves.some((m) => /^acrobatics$/i.test(m.name));
      tips.push({
        pokemon: p,
        text: hasAcrobatics
          ? `${p.nickname || p.name} has Acrobatics and no held item. Acrobatics benefits from an empty item slot; keeping this build item-free may be intentional.`
          : `${p.nickname || p.name} has no held item. An empty slot can be intentional; consider this Pokémon’s moves and ability before choosing an item from your bag.`,
      });
    }
    if (p.moves.some((m) => m.maxPp > 0 && m.pp === 0))
      tips.push({
        pokemon: p,
        text: `${p.nickname || p.name} has a move with no PP remaining in this snapshot.`,
      });
    if (cap && p.level < cap)
      tips.push({
        pokemon: p,
        text: `${p.nickname || p.name} is ${cap - p.level} levels below your confirmed cap of ${cap}.`,
      });
    return tips;
  });
}

// These moves do not use ordinary type-effectiveness damage multipliers.
// Keep them visible in build details, but never count them as 2×/4× coverage.
const SPECIAL_DAMAGE_MOVES = new Set([
  "counter",
  "mirrorcoat",
  "metalburst",
  "bide",
  "seismictoss",
  "nightshade",
  "sonicboom",
  "dragonrage",
  "superfang",
  "endeavor",
  "finalgambit",
  "naturesmadness",
  "ruination",
  "psywave",
  "guardianofalola",
  "fissure",
  "guillotine",
  "horndrill",
  "sheercold",
  "comeuppance",
]);
export function hasOrdinaryTypeDamage(move: Move) {
  const normalized = String(move.name || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return Boolean(
    move.type &&
    ["physical", "special"].includes(move.category ?? "") &&
    move.power !== 0 &&
    !SPECIAL_DAMAGE_MOVES.has(normalized),
  );
}
