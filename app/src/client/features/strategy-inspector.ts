import { types as badges } from "../components";
import { esc } from "../dom";
import { TYPES } from "../../shared/domain";
import { battleMultiplier } from "../../shared/fight-analysis";
import { scout } from "../../shared/scouting";
import { speciesDetail } from "./species-detail";
import type { Dex, DexSpecies } from "./dex-data";
import type { Pokemon, Combatant, Move } from "../../shared/types";
import type { BattleRules, Foe } from "./battle-data";
export function defense(mon: Combatant, rules: BattleRules = {}): string {
  const chart = TYPES.map((type) => ({ type, value: battleMultiplier(type, mon, rules) }));
  if (chart.some((x) => x.value === null))
    return "<p>Defensive matchups unknown: typing is not established for these rules.</p>";
  return `<h3>Defensive matchups · ${rules.inverse ? "Inverse" : "Standard"} chart${rules.notes?.length ? " + supported field rules" : ""}</h3>${[
    [4, "Major weaknesses"],
    [2, "Weaknesses"],
    [0.5, "Resistances"],
    [0.25, "Strong resistances"],
    [0, "Immunities"],
  ]
    .map(
      ([value, label]) =>
        `<p class="strategy-defense-row"><b>${label} ${value}×:</b> <span class="strategy-type-list">${
          chart
            .filter((x) => x.value === value)
            .map((x) => badges([x.type]))
            .join(" ") || "None"
        }</span></p>`,
    )
    .join("")}`;
}
function movesTable(moves: readonly Move[], label: string): string {
  return `<h3>${label}</h3><ul>${moves.map((m) => `<li>${esc(m.name ?? "Unknown")} · ${m.type ? badges([m.type]) : "unknown type"} · ${esc(m.category ?? "unknown category")}</li>`).join("") || "<li>No moves recorded; coverage is unknown.</li>"}</ul>`;
}
export function inspector(
  data: Dex,
  species: DexSpecies | undefined,
  owned: readonly Pokemon[],
  rules: BattleRules,
  individual?: Pokemon,
  foe?: Foe,
  full = true,
  proposed?: readonly Move[],
): string {
  const combatant =
    individual ??
    (foe
      ? { ...foe, types: species?.types ?? foe.types }
      : { types: species?.types ?? [], moves: proposed ?? [] });
  const moves = individual?.moves ?? foe?.moves ?? proposed ?? [];
  const scouting = species && (!foe || full) ? scout(species.baseStats, moves) : null;
  return `${foe ? `<h2>${esc(foe.name)}</h2><p>Sourced opponent · ${full ? "documented set" : "team reveal; sets and scouting remain hidden"}</p>` : individual ? `<h2>${esc(individual.nickname || individual.name)}</h2><p>Owned individual · level ${individual.level} · ${esc(individual.nature)} nature</p>` : ""}
  <p>Sprites show ordinary species artwork. Stats use the exact internal form: ${esc(species?.symbol ?? "unresolved")}.</p>
  ${defense(combatant, rules)}
  ${individual ? `<h3>Actual saved stats</h3><p>${(["hp", "atk", "def", "spa", "spd", "spe"] as const).map((key) => `${key.toUpperCase()} ${individual.stats?.[key] ?? "not stored"}`).join(" · ")}</p><p>Ability: ${esc(individual.ability || "unknown")} · Item: ${esc(individual.item || "none recorded")}</p>` : ""}
  ${!foe || full ? movesTable(moves, individual ? "Known moves from save" : foe ? "Documented opponent moves" : "Explicitly proposed moves") : ""}
  ${foe && full ? `<p>Ability: ${esc(foe.ability || "not specified")} · Item: ${esc(foe.item || "not specified")} · Level reference: ${esc(foe.level ?? "unknown")} ${esc(foe.levelBasis || "")}</p>${(foe.notes ?? []).map((n) => `<p>${esc(n)}</p>`).join("")}` : ""}
  ${scouting ? `<section class="scouting"><h3>Estimated role · reference heuristics</h3><p><b>${scouting.speed} · ${scouting.offense} · ${scouting.role}</b></p>${scouting.evidence.map((e) => `<p>${esc(e)}</p>`).join("")}<p>These are base-stat and set summaries, not observed combat stats or guaranteed turn order. EVs, IVs, nature, abilities, items, priority and battle scripts can change the result.</p></section>` : ""}
  ${foe && full && rules.notes?.length ? `<p class="banner">${rules.notes.map(esc).join(" · ")}</p>` : ""}
  ${species ? speciesDetail(data, species, owned) : "<p>Exact form reference unavailable. No base stats or role are inferred.</p>"}`;
}
