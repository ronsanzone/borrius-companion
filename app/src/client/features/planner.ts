import type { ViewModel } from "../view-model";
import { esc } from "../dom";
import { blank } from "../components";
import { portrait } from "../components";
import { name } from "../components";
import { types } from "../components";
import { opts } from "../components";
import { multiplier } from "../../shared/domain";
import { TYPES } from "../../shared/domain";
import { weaknesses } from "../../shared/domain";
import { hasOrdinaryTypeDamage } from "../../shared/domain";
import { exposure } from "../../shared/planner";
export function renderPlanner(model: ViewModel): string {
  const {
    state,
    selected,
    inverse,
    limit,
    hard,
    query,
    scope,
    activePlan,
    shortlist,
    focusBoard,
    swapIn,
    draftName,
    lastCounts,
    plannerMessage,
    owned,
    team,
    planningRoster,
  } = model;
  function matrix() {
    const roster = planningRoster(),
      rows = exposure(roster, selected, inverse, limit);
    return `<div class="planning-scroll" tabindex="0" aria-label="Team planning grid; scroll horizontally for more candidates">
      <table class="matrix planning-matrix">
      <thead>
      <tr>
      <th class="type-col">Incoming<br>type</th>
      <th class="count-col">Weak<br>
      <small>active ${selected.length}/6</small>
      </th>${roster
        .map(
          (
            p,
            i,
          ) => `<th class="${selected.includes(p.id) ? "active-column" : "bench-column"} ${swapIn === p.id ? "swap-column" : ""}">
      <button class="grid-summary" data-action="detail" data-id="${esc(p.id)}" aria-label="Summary for ${esc(name(p))}">${portrait(p)}<span>${esc(p.nickname || p.name)}</span>
      <small>Lv. ${p.level}</small>
      </button>
      <button class="grid-toggle ${selected.includes(p.id) ? "is-active" : ""}" data-action="activate" data-id="${esc(p.id)}" aria-pressed="${selected.includes(p.id)}" aria-label="${swapIn && selected.includes(p.id) ? "Replace" : selected.includes(p.id) ? "Bench" : "Activate"} ${esc(name(p))}">${swapIn === p.id ? "Cancel" : swapIn && selected.includes(p.id) ? "Replace ↓" : selected.includes(p.id) ? "● Active" : selected.length === 6 ? "⇄ Swap in" : "+ Activate"}</button>
      <div class="column-tools">
      <button data-action="left" data-id="${esc(p.id)}" aria-label="Move ${esc(name(p))} left" ${i === 0 ? "disabled" : ""}>‹</button>
      <button data-action="unlist" data-id="${esc(p.id)}" aria-label="Remove ${esc(name(p))} from shortlist">×</button>
      <button data-action="right" data-id="${esc(p.id)}" aria-label="Move ${esc(name(p))} right" ${i === roster.length - 1 ? "disabled" : ""}>›</button>
      </div>
      </th>`,
        )
        .join("")}</tr>
      </thead>
      <tbody>${rows
        .map(({ type, count, flagged }) => {
          const delta = lastCounts ? count - (lastCounts[type] ?? 0) : 0;
          return `<tr class="${flagged ? "threshold-row" : ""}">
      <th class="type-col">${types([type])}</th>
      <td class="count-col ${flagged ? "count-alert" : ""}" aria-label="${type}: ${count} active Pokémon weak${flagged ? ", threshold reached" : ""}">
      <b>${flagged ? "⚑ " : ""}${count}</b>${delta ? `<small class="count-delta ${delta > 0 ? "worse" : "better"}">${delta > 0 ? "+" : ""}${delta}</small>` : ""}</td>${roster
        .map((p) => {
          const v = multiplier(type, p.types, inverse),
            active = selected.includes(p.id);
          return `<td class="${active ? "" : "bench-cell "}${v === 0 ? "immune" : v > 1 ? "weak" : v < 1 ? "resist" : "neutral"}" aria-label="${esc(name(p))}: ${v} times${active ? "" : ", bench; not counted"}">${v}×</td>`;
        })
        .join("")}</tr>`;
        })
        .join("")}</tbody>
      </table>
      </div>`;
  }
  function candidates() {
    const t = team(),
      w = weaknesses(t, inverse).filter((x) => x.count > 0),
      list = owned()
        .filter((p) => !selected.includes(p.id))
        .map((p) => {
          const protection = w.filter((x) => multiplier(x.type, p.types, inverse) < 1),
            covers = [
              ...new Set(
                p.moves
                  .filter(hasOrdinaryTypeDamage)
                  .flatMap((m) =>
                    TYPES.filter((type) => multiplier(m.type ?? "", [type], inverse) > 1),
                  ),
              ),
            ];
          return {
            p,
            protection,
            covers,
            score: protection.reduce((n, x) => n + x.count, 0),
            passes: TYPES.every(
              (type) =>
                t.filter((mon) => multiplier(type, mon.types, inverse) > 1).length +
                  (multiplier(type, p.types, inverse) > 1 ? 1 : 0) <
                limit,
            ),
          };
        })
        .filter((x) => !hard || x.passes)
        .sort((a, b) => b.score - a.score || b.p.level - a.p.level)
        .slice(0, 4);
    return (
      list
        .map(
          (x) =>
            `<div class="list-item">
      <div>
      <strong>${esc(name(x.p))}</strong>
      <p>${x.protection.length ? "Resists " + x.protection.map((w) => esc(w.type)).join(", ") + " where this plan is exposed." : "No resistance to this plan’s exposed types."} ${x.p.moves.some((m) => m.type) ? `Validated attacks cover ${x.covers.length} single types.` : "Move coverage awaits validated metadata."}</p>
      </div>
      <button class="quiet" data-action="detail" data-id="${esc(x.p.id)}">Inspect</button>
      </div>`,
        )
        .join("") ||
      "<p>No owned candidates satisfy this threshold. Try a softer limit or change the plan.</p>"
    );
  }
  function lab() {
    if (!state.snapshot) return blank();
    const rows = exposure(planningRoster(), selected, inverse, limit),
      flagged = rows.filter((x) => x.flagged);
    const list = owned().filter(
      (p) =>
        (scope === "all" ||
          (scope === "party" && p.location.kind === "party") ||
          (scope === "boxes" && p.location.kind === "box") ||
          (scope === "favorites" && state.context.favorites.includes(p.id))) &&
        `${p.name} ${p.nickname} ${p.types.join(" ")} ${p.ability} ${p.moves.map((m) => m.name).join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
    return `<div class="planner-heading">
      <div>
      <div class="eyebrow">THE POKÉMON WORKSHOP</div>
      <h1>Find your six.</h1>
      </div>
      <button class="quiet" data-action="party">Use current party</button>
      </div>
      <section class="planner-workspace">
      <div class="planner-controls">
      <button class="quiet" data-action="focus-board">${focusBoard ? "↙ Exit focus" : "⛶ Focus grid"}</button>
      <strong>${selected.length}/6 active <small>· ${shortlist.length} shortlisted</small>
      </strong>
      <label>Rules<select id="inverse">
      <option value="false" ${!inverse ? "selected" : ""}>Standard</option>
      <option value="true" ${inverse ? "selected" : ""}>Inverse</option>
      </select>
      </label>
      <label>Flag rows at<select id="limit">${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${limit === n ? "selected" : ""}>${n}+ weak</option>`).join("")}</select>
      </label>
      <form id="plan-form">
      <input name="name" aria-label="Plan name" maxlength="80" required placeholder="Name this team" value="${esc(draftName)}">
      <button ${selected.length ? "" : "disabled"}>${activePlan ? "Update plan" : "Save plan"}</button>
      </form>
      </div>
      <div class="planner-feedback" role="status" aria-live="polite">${swapIn ? `Choose an active Pokémon to replace with <b>${esc(owned().find((p) => p.id === swapIn)?.name ?? "candidate")}</b>. <button class="quiet mini" data-action="cancel-swap">Cancel swap</button>` : `<b>${flagged.length ? flagged.length + (flagged.length === 1 ? " type at the threshold" : " types at the threshold") : "No types at the threshold"}</b>${flagged.length ? " · " + flagged.map((x) => `${esc(x.type)} ${x.count}`).join(" · ") : ""} <span>${esc(plannerMessage || "Bench columns stay visible but do not count. At six, choose “Swap in,” then who to replace.")}</span>`}</div>
      <div class="planner-body">
      <section class="roster-picker" aria-label="Shortlist picker">
      <label>Find a Pokémon<input id="search" type="search" value="${esc(query)}" placeholder="Name, type, move…">
      </label>
      <label>Show<select id="scope">${opts(["all", "party", "boxes", "favorites"], scope)}</select>
      </label>
      <small>${list.length} matches · up to 24 on the board</small>
      <div class="picker-list">${
        list
          .map(
            (p) => `<div class="picker-mon">${portrait(p)}<div>
      <strong>${esc(p.nickname || p.name)}</strong>
      <small>Lv. ${p.level} · ${esc(p.types.join("/"))}</small>
      </div>
      <button class="quiet" data-action="${shortlist.includes(p.id) ? "detail" : "shortlist"}" data-id="${esc(p.id)}" aria-label="${shortlist.includes(p.id) ? "Inspect" : "Shortlist"} ${esc(name(p))}">${shortlist.includes(p.id) ? "⋯" : "+"}</button>
      </div>`,
          )
          .join("") || "<p>No matching Pokémon.</p>"
      }</div>
      </section>
      <div class="grid-board">${shortlist.length ? matrix() : '<div class="empty">Add Pokémon from the picker to build your shortlist.</div>'}</div>
      </div>
      <p class="planner-legend">
      <b>⚑ ${limit}+ active Pokémon weak = highlighted row</b> · Orange: weak · Green: resists · Blue: immune · Gray: bench, excluded. Changes show +/− versus your previous selection. Type-only; abilities, items and field effects can change the matchup.</p>
      </section>
      <details class="panel saved-plans">
      <summary>Saved teams (${state.plans.length})</summary>${activePlan ? '<button class="quiet" data-action="new-plan">Save as a new team instead</button>' : ""}${
        state.plans
          .map(
            (p) => `<div class="saved-plan">
      <strong>${esc(p.name)}</strong>
      <small>${p.memberIds.length} active · ${(p.shortlistIds || p.memberIds).length} shortlisted</small>
      <button class="quiet mini" data-action="load-plan" data-id="${esc(p.id)}">Load</button>
      <button class="danger mini" data-action="delete-plan" data-id="${esc(p.id)}">Delete</button>
      </div>`,
          )
          .join("") || "<p>Save your active team and its shortlist together.</p>"
      }</details>
      <details class="panel">
      <summary>Bench suggestions & Pokédex reference</summary>
      <p>Suggestions use the active team. Add any candidate through the picker.</p>
      <label class="check">
      <input id="hard" type="checkbox" ${hard ? "checked" : ""}>Only suggest additions that stay below the threshold</label>${selected.length ? candidates() : ""}<a class="button quiet" href="#dex">Explore Pokédex</a>
      </details>`;
  }

  return lab();
}
