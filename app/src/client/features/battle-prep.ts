import {
  analyzeFight,
  offensiveOptions,
  incomingExposure,
  battleTypes,
} from "../../shared/fight-analysis";
import { opportunities } from "../../shared/domain";
import { Schema } from "effect";
import { esc, control, errorMessage } from "../dom";
import { BattlesSchema } from "./battle-data";
import type { Battle, BattleVariant, BattleRules, Foe } from "./battle-data";
import type { Pokemon, TrainerContext } from "../../shared/types";
interface BattleProps {
  owned: readonly Pokemon[];
  active: readonly Pokemon[];
  party: readonly Pokemon[];
  shortlist: string[];
  context: TrainerContext;
  onInspect: (id: string) => void;
  onShortlist: (id: string) => void;
  onSaveContext: (patch: Partial<TrainerContext>) => Promise<void>;
}
const display = (p: Pokemon) => p.nickname || p.name;
const chips = (ts: readonly string[]) =>
  ts.map((t) => `<span class="type ${esc(t.toLowerCase())}">${esc(t)}</span>`).join(" ");
const sprite = (p: { dexId: number | null }) =>
  p.dexId !== null && p.dexId > 0 && p.dexId <= 809
    ? `<img src="/sprites/${p.dexId}.png" alt="" width="64" height="64" class="sprite">`
    : "";
const options = (values: readonly string[], value: string) =>
  values
    .map((v) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
export function fightLabel(b: Battle, level: string) {
  return level === "types"
    ? `${b.kind === "gym" ? "Gym" : "Boss entry"} ${b.kind === "gym" ? b.gymNumber || b.order : b.order}`
    : `${b.name}${b.location ? " · " + b.location : ""}`;
}
export function mountBattlePrep(root: HTMLElement, props: BattleProps) {
  let battles: readonly Battle[] = [],
    disposed = false,
    target = props.context.nextBattleId || "",
    difficulty = props.context.difficulty || "unknown",
    reveal = props.context.fightReveal || (props.context.spoilerMode === "full" ? "full" : "types"),
    group = "all",
    error = "",
    saved = "",
    busy = false,
    useParty = false,
    showNames = false;
  const viewTeam = () => (useParty ? props.party : props.active);
  function render() {
    if (disposed) return;
    const battle = battles.find((b) => b.id === target),
      variant = battle?.variants?.[difficulty],
      visible = reveal !== "types",
      full = reveal === "full";
    const entries = battles.filter((b) => group === "all" || b.kind === group);
    const rules = variant?.rules || battle?.rules || {},
      inverse = rules.inverse === true;
    const foes = variant?.team || [],
      team = viewTeam(),
      analysis = analyzeFight(team, props.owned, foes, rules);
    const title = battle ? fightLabel(battle, reveal) : "Choose the next big fight";
    root.innerHTML = `<section class="fight-intro">
      <div class="eyebrow">A PLAN FOR THE BIG MOMENT</div>
      <h1>Your next matchup</h1>
      <p>Choose a gym or major battle, match your difficulty, then reveal only as much as you want.</p>
      </section>
      <section class="panel fight-pick">
      <div class="fight-controls">
      <label>Fight category<select data-fight="group">${options(["all", "gym", "boss"], group)}</select>
      </label>
      <label class="fight-choice">Upcoming fight<select data-fight="target">
      <option value="">Choose a fight…</option>${entries.map((b) => `<option value="${esc(b.id)}" ${b.id === target ? "selected" : ""}>${esc(fightLabel(b, showNames ? "team" : reveal))}</option>`).join("")}</select>
      </label>
      <label>Your difficulty<select data-fight="difficulty">${options(["unknown", "Vanilla", "Difficult", "Expert", "Insane"], difficulty)}</select>
      </label>
      <button data-fight-action="save" ${!target || difficulty === "unknown" || busy ? "disabled" : ""}>${busy ? "Saving…" : "Set as next fight"}</button>
      </div>
      <label class="check fight-name-choice">
      <input type="checkbox" data-fight="names" ${showNames ? "checked" : ""}>Show encounter names in the selector (names only; no teams)</label>
      <div class="fight-reveal" role="group" aria-label="Fight spoiler level">${[
        ["types", "1 · Typing hints"],
        ["team", "2 · Reveal team"],
        ["full", "3 · Full details"],
      ]
        .map(
          ([id, label]) =>
            `<button class="${id === reveal ? "" : "quiet"}" data-fight-reveal="${id}" aria-pressed="${id === reveal}">${label}</button>`,
        )
        .join("")}</div>
      <p class="fight-small">Typing hints hide opponent identities, individual sets, locations and story rules. Reveal team adds names and the opponent-by-opponent grid. Full details adds moves, items, abilities and battle notes. Progress is selected by you; the save does not reliably detect the next boss. Boss entry numbers are reference IDs, not story order.</p>
      <div role="status" aria-live="polite">${esc(error || saved)}</div>
      </section>${
        !battle
          ? `<div class="empty">
      <h2>Which fight are you heading into?</h2>
      <p>Gyms and major battles are separate lists. Start with typing hints; you can reveal the team when you’re ready.</p>
      </div>`
          : !variant
            ? `<section class="panel">
      <h2>${esc(title)}</h2>
      <p>${difficulty === "unknown" ? "Choose your actual game difficulty to load a matching roster." : `No sourced ${esc(difficulty)} roster is available for this fight. We won’t substitute another difficulty’s team.`}</p>
      <p>Available: ${
        Object.keys(battle.variants || {})
          .filter((k) => battle.variants[k])
          .map(esc)
          .join(", ") || "No sourced rosters yet"
      }.</p>${sourceLinks(battle)}</section>`
            : `<section class="fight-heading">
      <div>
      <div class="eyebrow">${inverse ? "INVERSE TYPE RULES" : "STANDARD TYPE RULES"} · ${esc(difficulty)}</div>
      <h2>${esc(title)}</h2>
      </div>
      <label>Analyze<select data-fight="team">
      <option value="plan" ${!useParty ? "selected" : ""}>Active planning team (${props.active.length})</option>
      <option value="party" ${useParty ? "selected" : ""}>Saved game party (${props.party.length})</option>
      </select>
      </label>
      </section>
      <div class="banner fight-confidence">${foes.some((f) => !f.types.length) ? "<p>Some opponents have unknown typing and are excluded from type recommendations.</p>" : ""}Roster reference: ${esc(variant.version || "version scope noted in source")}. ${esc(variant.confidence || "Community reference; check unusual mechanics in game.")} <b>This compares types and known moves, not damage, turn order, or a guaranteed winning team.</b>${(rules.notes || []).length ? `<p>Special battle rules apply. ${full ? esc((rules.notes || []).join(" · ")) : "Reveal full details to inspect them."}</p>` : ""}<small>Inverse rules, documented Magnet Rise, Strong Winds, heavy-rain Fire blocking and Fairy-move bans are included. Camomons uses the first two known move types on both sides. Ability/item effects and other battle scripts remain outside these calculations.</small>
      </div>
      <section class="panel">
      <div class="eyebrow">COVERAGE TO CONSIDER</div>
      <h2>Useful attacking types</h2>
      <div class="fight-type-picks">${analysis.attackTypes
        .slice(0, 6)
        .map(
          (x) =>
            `<div>${chips([x.type])}${visible ? `<small>Super-effective against ${x.targets}/${foes.length} opponents by type</small>` : ""}</div>`,
        )
        .join("")}</div>
      <p class="fight-small">Ranked by how much of the sourced roster each attacking type covers. These are move types to bring, not necessarily Pokémon types to use. Listed field restrictions are included; ability immunities, items and other battle scripts can still override these matchups.</p>
      </section>
      <section class="panel">
      <h2>Your team’s answers</h2>${
        !team.length
          ? "<p>No active planning team. Choose the saved game party above or build a team in the Pokémon tab.</p>"
          : visible
            ? coverageGrid(team, foes, rules)
            : `<div class="fight-hint-list">${team
                .map((mon) => {
                  const useful = foes.flatMap((f) => offensiveOptions(mon, f, rules));
                  const moves = [...new Set(useful.map((x) => x.move.name))];
                  return `<article>
      <div>${sprite(mon)}<strong>${esc(display(mon))}</strong>
      <small>Lv. ${mon.level}</small>
      </div>
      <p>${moves.length ? `Useful known coverage: ${moves.map(esc).join(", ")}.` : "No known super-effective attack found against this roster."}</p>
      <button class="quiet mini" data-fight-action="inspect" data-id="${esc(mon.id)}">Inspect build</button>
      </article>`;
                })
                .join("")}</div>`
      }${visible && analysis.uncovered.length ? `<div class="banner">No known super-effective answer on your active team for: ${analysis.uncovered.map((x) => esc(x.foe.name)).join(", ")}. Neutral attacks can still be effective; this is a coverage gap, not a prediction of defeat.</div>` : ""}</section>
      <section class="panel">
      <div class="section-head">
      <h2>Options on your bench</h2>
      <a class="text-link" href="#lab">Open planning grid →</a>
      </div>
      <p>Prioritizes missing coverage, then broader coverage, fewer incoming type weaknesses, and level. Suggestions use moves your Pokémon already know.</p>
      <div class="fight-candidates">${
        analysis.candidates
          .slice(0, 6)
          .map(
            (c) =>
              `<article>
      <div class="fight-mon-title">${sprite(c.mon)}<div>
      <h3>${esc(display(c.mon))}</h3>
      <small>Lv. ${c.mon.level} · ${esc(c.mon.location.kind === "party" ? "saved party" : "Box " + c.mon.location.box)}</small>
      </div>
      </div>${visible ? `<p>${c.fills.length ? `Adds an answer for ${c.fills.map((i) => esc(foes[i]?.name ?? "unknown opponent")).join(", ")}.` : `Has super-effective coverage for ${c.targets.length} opponents.`}</p>` : `<p>${c.fills.length ? "Adds coverage your active team is missing." : "Offers another option for this matchup."}</p>`}${full && c.risks.length ? `<small>Watch incoming ${c.risks.map((r) => esc(r.type) + " " + r.multiplier + "×").join(", ")}.</small>` : ""}<div class="row">
      <button class="quiet mini" data-fight-action="inspect" data-id="${esc(c.mon.id)}">Inspect</button>
      <button class="mini" data-fight-action="shortlist" data-id="${esc(c.mon.id)}">${props.shortlist.includes(c.mon.id) ? "On shortlist" : "+ Shortlist"}</button>
      </div>
      </article>`,
          )
          .join("") ||
        "<p>No additional known super-effective coverage found in your decoded collection.</p>"
      }</div>
      </section>${full ? fullDetails(battle, variant, team, rules) : ""}<section class="panel">
      <h2>Before you go</h2>${opportunities(team, props.context.levelCap)
        .slice(0, 5)
        .map((o) => `<p>${esc(o.text)}</p>`)
        .join(
          "",
        )}<p>Save in-game and sync before relying on current HP, PP or moves. Confirm the difficulty and battle rules in-game.</p>
      </section>
      <details class="panel fight-sources">
      <summary>Data sources & limitations${visible ? "" : " (source titles can contain spoilers)"}</summary>${sourceLinks(battle, variant)}<p>Community rosters are reference data, not extracted from your save. Levels may scale with your party. Partial or conditional fields remain labeled; unknown does not mean absent.</p>
      </details>`
      }`;
  }
  function sourceLinks(b: Battle, v?: BattleVariant) {
    const sources = v?.source
      ? [Schema.is(Schema.String)(v.source) ? { label: "Roster source", url: v.source } : v.source]
      : b.sources || [];
    return sources
      .filter((s) => (s.url || "").startsWith("https://"))
      .map(
        (s) =>
          `<p>
      <a class="text-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label || "Roster source")} ↗</a>
      </p>`,
      )
      .join("");
  }
  function coverageGrid(team: readonly Pokemon[], foes: readonly Foe[], inv: BattleRules) {
    return `<div class="table-wrap">
      <table class="fight-grid">
      <thead>
      <tr>
      <th>Your Pokémon</th>${foes
        .map(
          (f) => `<th>${sprite(f)}<strong>${esc(f.name)}</strong>
      <div>${chips(f.types)}</div>
      </th>`,
        )
        .join("")}</tr>
      </thead>
      <tbody>${team
        .map(
          (mon) =>
            `<tr>
      <th>
      <button class="quiet mini" data-fight-action="inspect" data-id="${esc(mon.id)}">${esc(display(mon))}</button>
      </th>${foes
        .map((f) => {
          const best = offensiveOptions(mon, f, inv)[0];
          return `<td class="${best ? "resist" : "neutral"}">${
            best
              ? `<b>${esc(best.move.name)}</b>
      <br>${best.multiplier}× by type`
              : f.types.length
                ? "No known super-effective move"
                : "Typing not established"
          }</td>`;
        })
        .join("")}</tr>`,
        )
        .join("")}</tbody>
      </table>
      </div>`;
  }
  function fullDetails(b: Battle, v: BattleVariant, team: readonly Pokemon[], inv: BattleRules) {
    const rules = v.rules || b.rules || {};
    return `<section class="panel">
      <div class="eyebrow">FULL SCOUTING NOTES</div>
      <h2>${rules.format === "scripted" ? "Encounter opponents & scripted rules" : "The opposing team & battle rules"}</h2>
      <p>${esc(rules.format || "Format not specified")}${rules.inverse ? " · Inverse battle" : ""}</p>${(rules.notes || []).map((n) => `<p>${esc(n)}</p>`).join("")}<div class="fight-foes">${v.team
        .map(
          (f) => `<article>
      <div class="fight-mon-title">${sprite(f)}<div>
      <h3>${esc(f.name)}</h3>${chips(f.types)}</div>
      </div>
      <p>Level reference: ${esc(f.level ?? "scales / not specified")} ${esc(f.levelBasis || "")}<br>Ability: ${esc(f.ability || "not specified")}<br>Item: ${esc(f.item || "not specified")}</p>${(f.notes || []).map((n) => `<small>${esc(n)}</small>`).join("")}<ul>${(f.moves || []).map((m) => `<li>${esc(m.name)}${m.type ? " · " + esc(m.type) : ""}</li>`).join("")}</ul>
      </article>`,
        )
        .join("")}</div>${
        team.length
          ? `<h3>Incoming move types to watch</h3>${team
              .map((mon) => {
                const risks = incomingExposure(mon, v.team, inv);
                return `<p>
      <b>${esc(display(mon))}:</b> ${inv.notes?.some((n) => n.toLowerCase().includes("camomons")) ? "Battle typing: " + (battleTypes(mon, inv).join("/") || "unknown") + ". " : ""} ${risks.length ? risks.map((r) => esc(r.type) + " " + r.multiplier + "×").join(", ") : "No super-effective ordinary move types found in the reference sets."}</p>`;
              })
              .join("")}`
          : ""
      }<p>${esc(v.trainerItems ? "Trainer items: " + v.trainerItems : "")}</p>${(v.notes || []).map((n) => `<p>${esc(n)}</p>`).join("")}<p class="fight-small">Incoming checks use the listed ordinary damaging moves. Abilities, items, priority, speed, stat changes and special-damage moves are not simulated.</p>
      </section>`;
  }
  async function click(e: MouseEvent) {
    if (!(e.target instanceof Element)) return;
    const revealButton = e.target.closest<HTMLElement>("[data-fight-reveal]");
    if (revealButton) {
      const level = revealButton.dataset.fightReveal;
      if (level !== "types" && level !== "team" && level !== "full") return;
      reveal = level;
      render();
      return;
    }
    const b = e.target.closest<HTMLElement>("[data-fight-action]");
    if (!b) return;
    const a = b.dataset.fightAction;
    try {
      if (a === "inspect") return props.onInspect(b.dataset.id ?? "");
      if (a === "shortlist") {
        props.onShortlist(b.dataset.id ?? "");
        if (!props.shortlist.includes(b.dataset.id ?? "")) props.shortlist.push(b.dataset.id ?? "");
        saved = "Added to the planning shortlist.";
      }
      if (a === "save") {
        busy = true;
        render();
        await props.onSaveContext({
          nextBattleId: target,
          difficulty,
          fightReveal: reveal,
        });
        saved = "Next fight saved. You can return to it from Camp.";
        busy = false;
      }
      error = "";
    } catch (err) {
      busy = false;
      error = errorMessage(err);
    }
    render();
  }
  function change(e: Event) {
    const input = control(e.target);
    if (!input) return;
    const key = input.dataset.fight;
    if (!key) return;
    if (key === "names") showNames = input instanceof HTMLInputElement && input.checked;
    if (key === "target") target = input.value;
    if (key === "difficulty") difficulty = input.value;
    if (key === "group") {
      group = input.value;
      target = "";
    }
    if (key === "team") useParty = input.value === "party";
    saved = "";
    error = "";
    render();
  }
  const onClick = (event: MouseEvent) => {
    void click(event);
  };
  root.addEventListener("click", onClick);
  root.addEventListener("change", change);
  root.innerHTML = '<div class="empty">Opening the battle notebook…</div>';
  fetch("/data/battles.json")
    .then((response) => {
      if (!response.ok) throw new Error("Battle reference unavailable");
      return response.json();
    })
    .then(Schema.decodeUnknownPromise(BattlesSchema))
    .then((data) => {
      battles = data;
      if (!battles.some((b) => b.id === target)) target = "";
      render();
    })
    .catch(() => {
      if (!disposed)
        root.innerHTML =
          '<div class="empty">The battle reference could not be loaded. Refresh to try again.</div>';
    });
  return () => {
    disposed = true;
    root.removeEventListener("click", onClick);
    root.removeEventListener("change", change);
  };
}
