import { TYPES, multiplier, hasOrdinaryTypeDamage } from "./domain";
import type { Combatant, Move, OwnedCombatant } from "./types";
export interface BattleRules {
  inverse?: boolean;
  notes?: readonly string[];
}
type Rules = BattleRules | boolean;
function rulesObject(rules: Rules): BattleRules {
  return rules === true || rules === false ? { inverse: rules } : rules;
}
function normalizedType(type?: string | null): string {
  return (type ?? "").toLowerCase();
}
export function battleTypes(defender: Combatant, rules: Rules = {}): string[] {
  const notes = rulesObject(rules).notes ?? [];
  if (notes.join(" ").toLowerCase().includes("camomons")) {
    const first = (defender.moves ?? []).slice(0, 2);
    if (first.length < 2 || first.some((move) => !move.type)) return [];
    return [...new Set(first.map((move) => normalizedType(move.type)))];
  }
  return defender.types.map(normalizedType);
}
export function battleMultiplier(
  type: string,
  defender: Combatant,
  rules: Rules = {},
): number | null {
  const settings = rulesObject(rules);
  const types = battleTypes(defender, settings);
  if (types.length === 0) return null;
  const notes = (settings.notes ?? []).join(" ").toLowerCase();
  const attack = normalizedType(type);
  if (attack === "fairy" && notes.includes("fairy-type moves ban")) return 0;
  if (attack === "fire" && notes.includes("heavy rain")) return 0;
  if (
    attack === "ground" &&
    notes.includes("magnet rise") &&
    types.some((t) => t === "electric" || t === "steel")
  )
    return 0;
  let value = multiplier(attack, types, settings.inverse === true);
  if (
    notes.includes("strong winds") &&
    types.includes("flying") &&
    !settings.inverse &&
    multiplier(attack, ["flying"]) > 1
  )
    value /= 2;
  return value;
}
export function offensiveOptions(
  mon: Combatant,
  foe: Combatant,
  rules: Rules = {},
): { move: Move; multiplier: number }[] {
  return (mon.moves ?? [])
    .flatMap((move) => {
      if (!hasOrdinaryTypeDamage(move) || move.pp === 0 || !move.type) return [];
      const value = battleMultiplier(move.type, foe, rules);
      return value !== null && value > 1 ? [{ move, multiplier: value }] : [];
    })
    .sort((a, b) => b.multiplier - a.multiplier);
}
export function incomingExposure(
  mon: Combatant,
  foes: readonly Combatant[],
  rules: Rules = {},
): { type: string; multiplier: number }[] {
  const attacks = new Set(
    foes.flatMap((foe) =>
      (foe.moves ?? []).filter(hasOrdinaryTypeDamage).map((move) => normalizedType(move.type)),
    ),
  );
  return [...attacks]
    .flatMap((type) => {
      const value = battleMultiplier(type, mon, rules);
      return value !== null && value > 1 ? [{ type, multiplier: value }] : [];
    })
    .sort((a, b) => b.multiplier - a.multiplier);
}
export function analyzeFight<M extends OwnedCombatant, F extends Combatant>(
  active: readonly M[],
  owned: readonly M[],
  foes: readonly F[],
  rules: Rules = {},
) {
  const coverage = foes.map((foe, index) => ({
    foe,
    index,
    answers: active
      .map((mon) => ({ mon, options: offensiveOptions(mon, foe, rules) }))
      .filter((answer) => answer.options.length > 0),
  }));
  const uncovered = coverage.filter(
    (entry) => battleTypes(entry.foe, rules).length > 0 && entry.answers.length === 0,
  );
  const activeIds = new Set(active.map((mon) => mon.id));
  const candidates = owned
    .filter((mon) => !activeIds.has(mon.id))
    .map((mon) => {
      const targets = foes.flatMap((foe, index) =>
        offensiveOptions(mon, foe, rules).length > 0 ? [index] : [],
      );
      const fills = targets.filter((index) => uncovered.some((entry) => entry.index === index));
      return { mon, targets, fills, risks: incomingExposure(mon, foes, rules) };
    })
    .filter((candidate) => candidate.targets.length > 0)
    .sort(
      (a, b) =>
        b.fills.length - a.fills.length ||
        b.targets.length - a.targets.length ||
        a.risks.length - b.risks.length ||
        b.mon.level - a.mon.level,
    );
  const attackTypes = TYPES.map((type) => ({
    type,
    targets: foes.filter((foe) => (battleMultiplier(type, foe, rules) ?? 0) > 1).length,
  }))
    .filter((entry) => entry.targets > 0)
    .sort((a, b) => b.targets - a.targets);
  return { coverage, uncovered, candidates, attackTypes };
}
