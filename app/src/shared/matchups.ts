import { hasOrdinaryTypeDamage } from "./domain";
import { battleMultiplier } from "./fight-analysis";
import type { BattleRules } from "./fight-analysis";
import type { Combatant, Move } from "./types";

/** Every usable ordinary attack, including resisted and immune results. */
export function matchupAttacks(attacker: Combatant, defender: Combatant, rules: BattleRules) {
  return (attacker.moves ?? [])
    .flatMap((move) => {
      if (!hasOrdinaryTypeDamage(move) || move.pp === 0 || !move.type) return [];
      const value = battleMultiplier(move.type, defender, rules);
      return value === null ? [] : [{ move, multiplier: value }];
    })
    .sort((a, b) => b.multiplier - a.multiplier);
}
export function incompleteMoves(moves: readonly Move[] = []) {
  return moves.length < 4 || moves.some((m) => !m.type || !m.category || !m.name);
}
