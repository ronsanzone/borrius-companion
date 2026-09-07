import { TYPES } from "./domain";
import { battleMultiplier, offensiveOptions, battleTypes } from "./fight-analysis";
import type { BattleRules } from "./fight-analysis";
import type { Combatant, Pokemon } from "./types";
export function benchOptions(
  team: readonly Combatant[],
  bench: readonly Pokemon[],
  foes: readonly Combatant[],
  rules: BattleRules,
  threshold: number,
  hard: boolean,
) {
  const gaps = foes.filter(
    (f) => battleTypes(f, rules).length && !team.some((m) => offensiveOptions(m, f, rules).length),
  );
  const counts = TYPES.map((type) => ({
    type,
    count: team.filter((m) => (battleMultiplier(type, m, rules) ?? 0) > 1).length,
  }));
  return bench
    .map((mon) => ({
      mon,
      fills: gaps.filter((f) => offensiveOptions(mon, f, rules).length).length,
      protection: counts.filter(
        (c) =>
          c.count > 0 &&
          battleMultiplier(c.type, mon, rules) !== null &&
          (battleMultiplier(c.type, mon, rules) ?? 1) < 1,
      ).length,
      passes:
        battleTypes(mon, rules).length > 0 &&
        counts.every(
          (c) => c.count + ((battleMultiplier(c.type, mon, rules) ?? 0) > 1 ? 1 : 0) < threshold,
        ),
    }))
    .filter((c) => !hard || c.passes)
    .sort((a, b) => b.fills - a.fills || b.protection - a.protection || b.mon.level - a.mon.level);
}
