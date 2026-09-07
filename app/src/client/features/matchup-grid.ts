import { types as badges } from "../components";
import { esc } from "../dom";
import { matchupAttacks, incompleteMoves } from "../../shared/matchups";
import type { Combatant } from "../../shared/types";
import type { BattleRules, Foe } from "./battle-data";

export interface PairSelection {
  player: number;
  enemy: number;
}
type Member = { name: string; combatant: Combatant; individual?: Combatant };
export function matchupGrid(
  team: readonly Member[],
  foes: readonly Foe[],
  rules: BattleRules,
  reveal: string,
  selected: PairSelection | null,
): string {
  if (reveal === "types")
    return "<p>Reveal the team to compare individual matchups. Incoming moves require full details.</p>";
  if (!foes.length) return "<p>Load an available encounter to compare attack coverage.</p>";
  if (!team.length)
    return "<p>Add owned Pokémon or reference builds to compare this encounter.</p>";
  const matrix = team.map((m) => foes.map((f) => matchupAttacks(m.combatant, f, rules)));
  const coverage = foes.map((foe, enemy) => ({
    foe,
    count: matrix.filter((row) => (row[enemy]?.[0]?.multiplier ?? 0) > 1).length,
    unknown: matrix.some((row) => !row[enemy]?.length),
  }));
  const gaps = coverage.filter((c) => c.count === 0);
  const singles = coverage.filter((c) => c.count === 1);
  const chosen = selected && team[selected.player] && foes[selected.enemy] ? selected : null;
  return `<div class="matchup-summary"><h3>Your team against this encounter</h3><div class="matchup-counts"><p><strong>${coverage.filter((c) => c.count > 0).length} / ${foes.length}</strong> targets with super-effective coverage</p><p><strong>${coverage.filter((c) => c.count > 1).length} / ${foes.length}</strong> targets with backup answers</p></div>
  ${gaps.length ? `<p class="matchup-warning"><b>No established super-effective answer:</b> ${gaps.map((c) => esc(c.foe.name)).join(", ")}. Neutral attacks may still help.</p>` : ""}
  ${singles.length ? `<p><b>Only one established answer:</b> ${singles.map((c) => esc(c.foe.name)).join(", ")}.</p>` : ""}
  ${coverage.some((c) => c.unknown) ? "<p>Some pairings are unknown or have no usable ordinary attack. Counts include established answers only.</p>" : ""}</div>
  <p class="dex-note">Best type effectiveness among known / proposed usable attacks. Tap a cell for both directions. Swipe opponent columns on narrow screens.</p>
  <div class="matchup-scroll" tabindex="0" role="region" aria-label="Team matchup grid, scroll to see all opponents"><table class="matchup-grid"><caption class="sr-only">Your team rows against opponent columns. Values are type effectiveness, not damage.</caption><thead><tr><th scope="col">Your team</th>${foes.map((f) => `<th scope="col">${esc(f.name)}<span class="matchup-types">${badges(f.types)}</span></th>`).join("")}</tr></thead><tbody>${team
    .map(
      (m, player) =>
        `<tr><th scope="row">${esc(m.name)}<small>${m.individual ? "Owned moves" : "Proposed / unknown"}</small></th>${foes
          .map((f, enemy) => {
            const value = matrix[player]?.[enemy]?.[0]?.multiplier;
            const exposed =
              reveal === "full" &&
              matchupAttacks(f, m.combatant, rules).some((a) => a.multiplier > 1);
            const label = value === undefined ? "?" : `${value}×`;
            return `<td><button type="button" class="matchup-cell ${value === undefined ? "unknown" : value > 1 ? "effective" : value < 1 ? "resisted" : "neutral"}" data-strategy="pair" data-player="${player}" data-enemy="${enemy}" aria-pressed="${chosen?.player === player && chosen.enemy === enemy}" aria-label="${esc(m.name)} against ${esc(f.name)}: ${value === undefined ? "unknown or no usable ordinary attack" : `${value} times outgoing effectiveness`}${exposed ? "; super-effective return move documented" : ""}">${label}${exposed ? '<span class="matchup-risk" aria-hidden="true">⚠</span>' : ""}</button></td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>
  <p class="dex-note">2–4× super-effective · 1× neutral · below 1× resisted or blocked · ? unknown / no usable ordinary attack${reveal === "full" ? " · ⚠ documented super-effective return move" : " · Return moves hidden"}</p>
  <div data-pair-detail aria-live="polite">${chosen ? pairingDetail(team[chosen.player], foes[chosen.enemy], rules, reveal) : "<p>Select a pairing to inspect its moves and risks.</p>"}</div>`;
}
function pairingDetail(member: Member, foe: Foe, rules: BattleRules, reveal: string): string {
  const out = matchupAttacks(member.combatant, foe, rules);
  const moves = (attacks: ReturnType<typeof matchupAttacks>) =>
    attacks
      .map(
        (a) =>
          `<li>${esc(a.move.name ?? "Unknown move")} ${badges([a.move.type ?? "unknown"])} <b>${a.multiplier}×</b></li>`,
      )
      .join("");
  return `<section class="matchup-detail"><h3>${esc(member.name)} → ${esc(foe.name)}</h3><h4>${member.individual ? "Known attacks from save" : "Proposed attacks / available evidence"}</h4>${out.length ? `<ul>${moves(out)}</ul><p>Highest type effectiveness: <b>${out[0]?.multiplier}×</b>. This does not rank damage or predict a knockout.</p>` : "<p>No usable ordinary attack can be evaluated. Missing typing, empty PP, status and special-damage moves do not establish an answer.</p>"}
  ${incompleteMoves(member.combatant.moves) ? "<p>Move evidence is partial; unlisted moves are unknown.</p>" : ""}
  ${
    reveal === "full"
      ? `<h4>Documented return attacks</h4>${(() => {
          const incoming = matchupAttacks(foe, member.combatant, rules);
          return incoming.length
            ? `<ul>${moves(incoming)}</ul>`
            : "<p>No ordinary return attack can be evaluated; this is not evidence of safety.</p>";
        })()}${incompleteMoves(foe.moves) ? "<p>Opponent move evidence is partial; additional threats may be unknown.</p>" : ""}`
      : "<p>Reveal full details to inspect documented return attacks.</p>"
  }
  <p class="dex-note">Type effectiveness is not a safe-switch guarantee. Speed, priority, damage, abilities, items and unsupported scripts are not evaluated.</p></section>`;
}
