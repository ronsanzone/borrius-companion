import { esc } from "../dom";
import { TYPES } from "../../shared/domain";
import {
  battleTypes,
  battleMultiplier,
  offensiveOptions,
  incomingExposure,
} from "../../shared/fight-analysis";
import type { Combatant } from "../../shared/types";
import type { Foe, BattleRules } from "./battle-data";
export function strategyAnalysis(
  team: readonly { name: string; combatant: Combatant }[],
  foes: readonly Foe[],
  rules: BattleRules,
  reveal: string,
  limit: number,
): string {
  const unknown = team.filter((m) => !battleTypes(m.combatant, rules).length).length;
  const weaknesses = TYPES.map((type) => ({
    type,
    count: team.filter((m) => (battleMultiplier(type, m.combatant, rules) ?? 0) > 1).length,
  })).filter((x) => x.count > 0);
  return `<h2>Team strategy</h2><p>Shared weaknesses · ${rules.inverse ? "Inverse" : "Standard"}${rules.notes?.length ? " with supported field rules" : ""}</p><p>${weaknesses.map((x) => `<span class="pill ${x.count >= limit ? "weak" : ""}">${esc(x.type)} ${x.count}/${team.length}${x.count >= limit ? " ⚑" : ""}</span>`).join(" ") || "No shared weaknesses established."}</p>${unknown ? `<p>${unknown} member(s) have unknown battle typing and are excluded from weakness counts.</p>` : ""}
  ${
    foes.length && reveal !== "types"
      ? foes
          .map(
            (foe) =>
              `<article class="coverage-card"><h3>${esc(foe.name)}</h3>${
                !battleTypes(foe, rules).length
                  ? "<p>Battle typing unknown; coverage cannot be established.</p>"
                  : `<p>${
                      team
                        .map((m) => {
                          const answers = offensiveOptions(m.combatant, foe, rules);
                          return answers.length
                            ? `<b>${esc(m.name)}</b>: ${answers.map((a) => `${esc(a.move.name ?? "Unknown move")} ${a.multiplier}×`).join(", ")}`
                            : "";
                        })
                        .filter(Boolean)
                        .join("<br>") ||
                      "Coverage gap: no known or proposed super-effective ordinary attack. Neutral attacks may still work."
                    }</p>`
              }</article>`,
          )
          .join("")
      : foes.length
        ? "<p>Reveal the team to compare individual matchups. Scouting and incoming moves require full details.</p>"
        : "<p>Load an available encounter to compare attack coverage.</p>"
  }
  ${
    reveal === "full" && foes.length
      ? `<h3>Incoming documented threats</h3>${team
          .map(
            (m) =>
              `<p><b>${esc(m.name)}</b>: ${
                !battleTypes(m.combatant, rules).length
                  ? "unknown typing"
                  : incomingExposure(m.combatant, foes, rules)
                      .map((x) => `${esc(x.type)} ${x.multiplier}×`)
                      .join(", ") ||
                    "No super-effective ordinary move type found in this source set; missing moves are unknown."
              }</p>`,
          )
          .join("")}`
      : ""
  }
  <p class="dex-note">Uses known or explicitly proposed ordinary damaging moves, never the whole learnset. Type coverage is not damage or a safe-switch guarantee. Supported rules: inverse, Camomons (first two moves), Strong Winds, documented Magnet Rise, heavy rain and Fairy-move bans. Other abilities, items, scripts, priority and stat changes are not simulated.</p>`;
}
