import { TYPES } from "../../shared/domain";
import { battleMultiplier } from "../../shared/fight-analysis";
import { ownedIds } from "../../shared/team";
import { types as badges } from "../components";
import { esc } from "../dom";
import { memberView } from "./strategy-team";
import type { PlannerDraft } from "../contracts";
import type { Pokemon, TeamMember } from "../../shared/types";
import type { Dex } from "./dex-data";

export interface TypeBoardState {
  type: string;
  metric: "weak" | "resist" | "immune";
  target: number | null;
  benchOpen: boolean;
}

export function boardCandidates(draft: PlannerDraft): readonly TeamMember[] {
  const active = ownedIds(draft.members);
  return [
    ...draft.shortlist
      .filter((id) => !active.includes(id))
      .map((pokemonId) => ({ kind: "owned" as const, pokemonId })),
    ...(draft.benchBuilds ?? []),
  ];
}
/** Keep proposals when benching/replacing, and consume activated bench proposals. */
export function changeActiveTeam(
  draft: PlannerDraft,
  members: readonly TeamMember[],
): PlannerDraft {
  const shortlist = [...new Set([...draft.shortlist, ...ownedIds(members)])];
  const retained = (draft.benchBuilds ?? []).filter((m) => !members.includes(m));
  const removed = draft.members.filter((m) => m.kind === "build" && !members.includes(m));
  const benchBuilds = [...retained, ...removed].filter((m) => m.kind === "build");
  if (shortlist.length > 24) throw Error("The owned shortlist is full. Unlist a candidate first.");
  if (benchBuilds.length > 24) throw Error("The reference bench is full. Unlist a build first.");
  return { ...draft, members, shortlist, benchBuilds };
}
export function teamBoard(
  draft: PlannerDraft,
  owned: readonly Pokemon[],
  dex: Dex,
  pending: boolean,
  mobile?: TypeBoardState,
): string {
  const candidates = boardCandidates(draft);
  const columns = [...draft.members, ...candidates].map((m) => memberView(m, owned, dex));
  const activeCount = draft.members.length;
  const rows = TYPES.map((type) => {
    const values = columns.map((c) =>
      battleMultiplier(type, c.combatant, { inverse: draft.inverse }),
    );
    const active = values.slice(0, activeCount);
    return {
      type,
      values,
      weak: active.filter((v) => v !== null && v > 1).length,
      resist: active.filter((v) => v !== null && v > 0 && v < 1).length,
      immune: active.filter((v) => v === 0).length,
      unknown: active.filter((v) => v === null).length,
    };
  });
  if (mobile) {
    const selected = rows.find((r) => r.type === mobile.type) ?? rows[0];
    const targetName = mobile.target === null ? undefined : columns[mobile.target]?.name;
    const memberRow = (i: number, active: boolean) => {
      const member = columns[i];
      if (!member) return "";
      const value = selected?.values[i];
      const status =
        value === null || value === undefined
          ? "unknown"
          : value === 0
            ? "immune"
            : value > 1
              ? "weak"
              : value < 1
                ? "resist"
                : "neutral";
      const index = active ? i : i - activeCount;
      return `<article class="mobile-type-member"><div class="mobile-type-member-head"><button class="quiet" data-strategy="${active ? "board-inspect" : "inspect-candidate"}" data-id="${index}">${esc(member.name)}</button><span class="mobile-type-value ${status}">${value === null || value === undefined ? "?" : `${value}×`} ${status}</span></div><small>${member.individual ? "Owned" : member.missing ? "Missing owned individual" : "Uncaught reference build"}${active ? "" : " · Bench, not counted"}</small><div class="mobile-member-actions">${
        active
          ? `<button class="quiet" data-strategy="${pending ? "board-replace" : "board-target"}" data-id="${index}" aria-pressed="${mobile.target === index}">${pending ? "Replace" : "Try swap"}</button><button class="quiet" data-strategy="board-bench" data-id="${index}">Bench</button>`
          : `<button class="quiet" data-strategy="board-activate" data-id="${index}">${targetName ? `Replace ${esc(targetName)}` : activeCount === 6 ? "Swap in" : "Activate"}</button><button class="quiet" data-strategy="board-unlist" data-id="${index}">Unlist</button>`
      }</div></article>`;
    };
    return `<div class="section-head"><h3>Build & compare by type</h3><span>${activeCount}/6 active · ${candidates.length} bench</span></div><p>${draft.inverse ? "Inverse" : "Standard"} chart · active team only. Tap a type to inspect each Pokémon.</p>
    <div class="mobile-type-metrics" role="group" aria-label="Type count metric">${(["weak", "resist", "immune"] as const).map((metric) => `<button class="quiet" data-strategy="board-metric" data-id="${metric}" aria-pressed="${mobile.metric === metric}">${metric === "weak" ? "Weak" : metric === "resist" ? "Resist" : "Immune"}</button>`).join("")}</div>
    <div class="mobile-type-tiles" role="group" aria-label="Incoming types">${rows.map((r) => `<button class="quiet" data-strategy="board-type" data-id="${r.type}" aria-pressed="${r.type === selected?.type}" aria-label="${r.type}: ${r[mobile.metric]} ${mobile.metric}, ${r.unknown} unknown">${badges([r.type])}<b>${r[mobile.metric]}</b></button>`).join("")}</div>
    <p class="dex-note">${selected?.unknown ? `${selected.unknown} active member(s) have unknown typing and are not counted. ` : ""}Resist excludes immunity. Encounter field rules are evaluated separately.</p>
    <section class="mobile-type-detail" aria-label="Selected type breakdown"><h4>${badges([selected?.type ?? "normal"])} · your team</h4>${
      activeCount
        ? columns
            .slice(0, activeCount)
            .map((_, i) => memberRow(i, true))
            .join("")
        : "<p>No active members. Add an owned candidate or an uncaught build to start a team.</p>"
    }</section>
    ${pending ? '<p class="banner">Choose Replace on an active member above, or cancel.</p><button class="quiet" data-strategy="cancel">Cancel swap</button>' : ""}
    <section data-mobile-bench><button class="quiet mobile-bench-toggle" data-strategy="board-bench-toggle" aria-expanded="${mobile.benchOpen}">${mobile.benchOpen ? "Hide" : "Show"} bench · ${candidates.length} candidates</button>
    ${mobile.benchOpen ? `<h4>${targetName ? `Choose a replacement for ${esc(targetName)}` : "Bench candidates"}</h4>${targetName ? '<button class="quiet" data-strategy="board-target-cancel">Cancel selection</button>' : ""}${candidates.map((_, i) => memberRow(i + activeCount, false)).join("") || "<p>Your bench is empty. Add an owned Pokémon or an uncaught reference build.</p>"}` : ""}
    <div class="strategy-controls"><button class="quiet" data-strategy="find-owned">Add owned candidates</button><button class="quiet" data-strategy="find-build">Find uncaught Pokémon</button></div></section>`;
  }
  return `<div class="section-head"><h3>Build & compare by type</h3><span>${activeCount}/6 active · ${candidates.length} bench</span></div><p>Compare owned Pokémon and uncaught builds together. Only active columns count toward totals. ${draft.inverse ? "Inverse" : "Standard"} chart; encounter-specific field rules stay in Encounter matchups.</p>
  <div class="strategy-controls"><button class="quiet" data-strategy="find-owned">Add owned candidates</button><button class="quiet" data-strategy="find-build">Find uncaught Pokémon</button></div>
  ${pending ? '<p class="banner">Choose Replace in an active column to finish your swap, or cancel.</p><button class="quiet" data-strategy="cancel">Cancel swap</button>' : ""}
  ${
    columns.length
      ? `<div class="team-board-scroll" tabindex="0" role="region" aria-label="Team type planning grid, scroll for candidates"><table class="team-board"><caption>All 18 incoming types · active and bench comparison</caption><thead><tr><th scope="col">Incoming type</th><th scope="col">Active totals<small>Weak / Resist / Immune</small></th>${columns
          .map((c, i) => {
            const active = i < activeCount;
            const index = active ? i : i - activeCount;
            return `<th scope="col" class="${active ? "board-active" : "board-bench"}"><button class="board-inspect quiet" data-strategy="${active ? "board-inspect" : "inspect-candidate"}" data-id="${index}">${c.species ? `<img src="/sprites/${c.species.dexId}.png" width="48" height="48" alt="">` : ""}<strong>${esc(c.name)}</strong></button><small>${c.individual ? "Owned" : c.missing ? "Missing owned" : "Uncaught build"} · ${active ? "Active" : "Bench"}</small><button class="quiet" data-strategy="${active ? (pending ? "board-replace" : "board-bench") : "board-activate"}" data-id="${index}">${active ? (pending ? "Replace" : "Bench") : activeCount === 6 ? "Swap in" : "Activate"}</button>${!active ? `<button class="quiet" data-strategy="board-unlist" data-id="${index}">Unlist</button>` : ""}</th>`;
          })
          .join(
            "",
          )}</tr></thead><tbody>${rows.map((r) => `<tr><th scope="row">${badges([r.type])}</th><td class="board-totals ${r.weak > 0 && r.weak >= draft.limit ? "board-alert" : ""}" aria-label="${r.type}: ${r.weak} weak, ${r.resist} resistant, ${r.immune} immune, ${r.unknown} unknown"><b>${r.weak} / ${r.resist} / ${r.immune}</b>${r.unknown ? `<small>+${r.unknown} unknown</small>` : ""}</td>${r.values.map((v, i) => `<td class="${i < activeCount ? "board-active" : "board-bench"} ${v === null ? "board-unknown" : v === 0 ? "board-immune" : v > 1 ? "board-weak" : v < 1 ? "board-resist" : "board-neutral"}" aria-label="${esc(columns[i]?.name)}: ${v === null ? "unknown" : `${v} times`}${i < activeCount ? ", active" : ", bench; not counted"}">${v === null ? "?" : `${v}×`}</td>`).join("")}</tr>`).join("")}</tbody></table></div><p class="dex-note">Weak: above 1× · Resist: 0.25–0.5× · Immune: 0× · ?: unknown. Highlighted totals reach your weakness threshold. Resist totals exclude immunities.</p>`
      : "<p>Start a new team by adding owned candidates or searching the Pokédex for uncaught builds.</p>"
  }`;
}
