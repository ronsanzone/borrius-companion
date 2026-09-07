import { types as badges } from "../components";
import { TYPES } from "../../shared/domain";
import { battleTypes, battleMultiplier } from "../../shared/fight-analysis";
import { matchupGrid } from "./matchup-grid";
import type { PairSelection } from "./matchup-grid";
import type { Combatant } from "../../shared/types";
import type { Foe, BattleRules } from "./battle-data";
export function strategyAnalysis(
  team: readonly { name: string; combatant: Combatant; individual?: Combatant }[],
  foes: readonly Foe[],
  rules: BattleRules,
  reveal: string,
  limit: number,
  selected: PairSelection | null = null,
): string {
  const unknown = team.filter((m) => !battleTypes(m.combatant, rules).length).length;
  const weaknesses = TYPES.map((type) => ({
    type,
    count: team.filter((m) => (battleMultiplier(type, m.combatant, rules) ?? 0) > 1).length,
  }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  return `<h2>Encounter matchups</h2>
  ${weaknesses[0] ? `<p><b>Largest shared weakness:</b> ${badges([weaknesses[0].type])} ${weaknesses[0].count}/${team.length} members · ${rules.inverse ? "Inverse" : "Standard"}${rules.notes?.length ? " with supported field rules" : ""}.</p>` : ""}
  ${matchupGrid(team, foes, rules, reveal, selected)}
  <details><summary>All team weaknesses</summary><p>${weaknesses.map((x) => `<span class="pill ${x.count >= limit ? "weak" : ""}">${badges([x.type])} ${x.count}/${team.length}${x.count >= limit ? " ⚑" : ""}</span>`).join(" ") || "No shared weaknesses established."}</p>${unknown ? `<p>${unknown} member(s) have unknown battle typing and are excluded from weakness counts.</p>` : ""}</details>
  <p class="dex-note">Uses known or explicitly proposed ordinary damaging moves, never the whole learnset. Supported rules: inverse, Camomons (first two moves), Strong Winds, documented Magnet Rise, heavy rain and Fairy-move bans. Other abilities, items, scripts, priority and stat changes are not simulated.</p>`;
}
