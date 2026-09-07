import { boardCandidates, changeActiveTeam, teamBoard } from "./team-board";
import type { PairSelection } from "./matchup-grid";
import { types as badges } from "../components";
import { Schema } from "effect";
import { esc, control, errorMessage, element } from "../dom";
import { mountDex, type DexBrowserState } from "./dex";
import { DexSchema } from "./dex-data";
import type { Dex } from "./dex-data";
import { BattlesSchema } from "./battle-data";
import type { Battle } from "./battle-data";
import type { Plan, Pokemon, TeamMember, TrainerContext } from "../../shared/types";
import type { PlannerDraft } from "../contracts";
import { benchOptions } from "../../shared/team-analysis";
import { editTeam, ownedIds } from "../../shared/team";
import { encounters, encounterForRoster, rosterId } from "../../shared/encounters";
import { foeFormSymbols } from "../../shared/foe-forms";
import { memberView } from "./strategy-team";
import { inspector } from "./strategy-inspector";
import { strategyAnalysis } from "./strategy-analysis";
interface Props {
  owned: readonly Pokemon[];
  party: readonly Pokemon[];
  plans: readonly Plan[];
  context: TrainerContext;
  draft: PlannerDraft;
  onDraft: (draft: PlannerDraft) => void;
  session: StrategySession;
  onSave: (draft: PlannerDraft) => Promise<Plan>;
  onDelete: (id: string) => Promise<void>;
  onContext: (context: TrainerContext) => Promise<void>;
}
type Selection =
  { side: "dex"; speciesId: number } | { side: "player" | "enemy" | "candidate"; index: number };
export interface StrategySession {
  selection: Selection | null;
  eventId: string;
  stage: number;
  starter: string;
  reveal: TrainerContext["fightReveal"];
  difficulty: string;
  form: number;
  browser: DexBrowserState;
}
export function strategySession(context: TrainerContext): StrategySession {
  const current = encounterForRoster(context.nextBattleId);
  return {
    selection: null,
    eventId: current?.id ?? "",
    stage: Math.max(0, current?.stages.indexOf(context.nextBattleId ?? "") ?? 0),
    starter: context.nextBattleId?.match(/-(gible|beldum|larvitar)$/)?.[1] ?? "",
    reveal: context.fightReveal,
    difficulty: context.difficulty,
    form: 0,
    browser: { selected: null, page: 0, search: "", type: "", ownedOnly: false },
  };
}
const options = (values: readonly string[], selected: string) =>
  values
    .map((v) => `<option value="${esc(v)}" ${selected === v ? "selected" : ""}>${esc(v)}</option>`)
    .join("");
export function mountStrategy(root: HTMLElement, props: Props): () => void {
  let dex: Dex = { species: [], moves: {}, source: { notice: "", url: "" } },
    battles: readonly Battle[] = [],
    draft = props.draft,
    plans = props.plans,
    context = props.context,
    eventId = props.session.eventId,
    stage = props.session.stage,
    starter = props.session.starter,
    reveal = props.session.reveal,
    difficulty = props.session.difficulty,
    selection: Selection | null = props.session.selection,
    form = props.session.form,
    pending: TeamMember | null = null,
    message = "",
    busy = false,
    disposed = false,
    cleanupDex: (() => void) | null = null;
  let pairSelection: PairSelection | null = null;
  const abort = new AbortController();
  const viewport = globalThis.matchMedia("(max-width: 760px)");
  const moveInspector = () => {
    if (root.querySelector(".strategy-inspector")) renderInspector();
  };
  viewport.addEventListener("change", moveInspector);
  const event = () => encounters.find((e) => e.id === eventId);
  const targetId = () => {
    const e = event();
    return e ? rosterId(e, stage, starter) : undefined;
  };
  const battle = () => battles.find((b) => b.id === targetId());
  const variant = () => battle()?.variants[difficulty];
  const rules = () => variant()?.rules ?? battle()?.rules ?? { inverse: draft.inverse };
  const foes = () => variant()?.team ?? [];
  const views = () => draft.members.map((m) => memberView(m, props.owned, dex));
  function update(next: PlannerDraft) {
    if (disposed) return;
    pairSelection = null;
    draft = next;
    props.onDraft(next);
  }
  function setMembers(members: readonly TeamMember[]) {
    update(changeActiveTeam(draft, members));
    pending = null;
    selection = null;
  }
  function add(member: TeamMember) {
    if (draft.members.length === 6) {
      pending = member;
      message = "Choose a slot to replace, or cancel.";
      return;
    }
    setMembers(editTeam(draft.members, member));
    selection = { side: "player", index: draft.members.length - 1 };
  }
  function selectedDetail(): string {
    if (!selection)
      return "<h2>Inspect either side</h2><p>Choose a team member, opponent, or Dex result to see its exact form and strategy.</p>";
    if (selection.side === "dex") {
      const speciesId = selection.speciesId;
      const species = dex.species.find((s) => s.speciesId === speciesId);
      return `${species ? `<button data-strategy="add-build" data-id="${species.speciesId}">+ Add hypothetical build</button><button class="quiet" data-strategy="compare-build" data-id="${species.speciesId}">Compare on bench</button>` : ""}${inspector(dex, species, props.owned, {}, undefined, undefined, true)}`;
    }
    if (selection.side === "player" || selection.side === "candidate") {
      const member = (selection.side === "player" ? draft.members : boardCandidates(draft))[
          selection.index
        ],
        view = member && memberView(member, props.owned, dex);
      if (!member || !view) return "<p>Choose a current team slot.</p>";
      if (view.missing)
        return `<h2>Missing owned individual</h2><p>The saved identity ${esc(member.kind === "owned" ? member.pokemonId : "")} is absent from this snapshot. Membership was preserved. Remove or replace this slot; no other individual has been substituted.</p>`;
      const buildForm =
        member.kind === "build"
          ? `<form id="build-form"><h3>Hypothetical proposal</h3><p>Choose up to four moves in order. These are proposals, not observed moves.</p>${[
              0, 1, 2, 3,
            ]
              .map(
                (i) =>
                  `<label>Proposed move ${i + 1}<select name="move${i}"><option value="">Unknown / none proposed</option>${[
                    ...new Set([
                      ...(view.species?.learnset.map((m) => m.moveId) ?? []),
                      ...(view.species?.machineMoves ?? []),
                      ...(view.species?.tutorMoves ?? []),
                      ...(view.species?.eggMoves ?? []),
                    ]),
                  ]
                    .sort((a, b) =>
                      (dex.moves[a]?.name ?? "").localeCompare(dex.moves[b]?.name ?? ""),
                    )
                    .map(
                      (id) =>
                        `<option value="${id}" ${member.moveIds[i] === id ? "selected" : ""}>${esc(dex.moves[id]?.name ?? "Unknown move")}</option>`,
                    )
                    .join("")}</select></label>`,
              )
              .join(
                "",
              )}<label>Proposed ability<input name="ability" maxlength="100" value="${esc(member.ability)}"></label><label>Proposed item<input name="item" maxlength="100" value="${esc(member.item)}"></label><label>Build assumptions / notes<textarea name="notes" maxlength="1000">${esc(member.notes)}</textarea></label><button>Apply proposal</button></form>`
          : "";
      return (
        buildForm +
        inspector(
          dex,
          view.species,
          props.owned,
          rules(),
          view.individual,
          undefined,
          true,
          view.proposed,
        )
      );
    }
    if (reveal === "types") return "<p>Reveal the team to inspect opponents.</p>";
    const foe = foes()[selection.index];
    if (!foe) return "<p>Choose an opponent from the current roster.</p>";
    const symbols = foeFormSymbols(foe.name),
      species = dex.species.find((s) => s.symbol === symbols[form]);
    return `${symbols.length > 1 ? `<p>The source does not establish the battle state. Preview:</p>${symbols.map((s, i) => `<button class="quiet" data-strategy="form" data-id="${i}" aria-pressed="${i === form}">${s.includes("SHIELD") ? "Shield form" : "Core form"}</button>`).join("")}` : ""}${inspector(dex, species, props.owned, rules(), undefined, foe, reveal === "full")}`;
  }
  function renderInspector(focus = false) {
    Object.assign(props.session, { selection, eventId, stage, starter, reveal, difficulty, form });
    const panel = element(".strategy-inspector", root);
    const host =
      selection?.side === "enemy"
        ? element("[data-enemy-detail]", root)
        : element("[data-player-detail]", root);
    if (globalThis.matchMedia("(max-width: 760px)").matches) host.appendChild(panel);
    else element("[data-desktop-detail]", root).appendChild(panel);
    panel.innerHTML = selectedDetail();
    if (focus) {
      panel.focus({ preventScroll: true });
      if (globalThis.matchMedia("(max-width: 760px)").matches)
        panel.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }
  function render() {
    if (disposed) return;
    const boardScroll = root.querySelector(".team-board-scroll")?.scrollLeft ?? 0;
    const focused = control(document.activeElement);
    const focusKey = focused?.dataset.strategyChange;
    const current = event(),
      b = battle(),
      v = variant(),
      full = reveal === "full",
      visible = reveal !== "types";
    element("[data-player]", root).innerHTML =
      `<div class="section-head"><h2>Your team · ${draft.members.length}/6</h2><button class="quiet" data-strategy="party">Load current party</button><button class="quiet" data-strategy="new">New draft</button></div>
    <label>Saved team<select data-strategy-change="plan"><option value="">Load a named team…</option>${plans.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("")}</select></label>
    <div class="team-strip">${
      views()
        .map(
          (m, i) =>
            `<article><button class="team-member" data-strategy="inspect-player" data-id="${i}">${m.species ? `<img src="/sprites/${m.species.dexId}.png" width="64" height="64" alt="">` : ""}<strong>${esc(m.name)}</strong><small>${m.missing ? "Missing identity — preserved" : draft.members[i]?.kind === "build" ? "Hypothetical" : "Owned · known moves"}</small></button><button class="quiet" data-strategy="remove" data-id="${i}" aria-label="Remove slot ${i + 1}">Remove</button>${pending ? `<button data-strategy="replace" data-id="${i}">Replace slot ${i + 1}</button>` : ""}</article>`,
        )
        .join("") || "<p>Your draft is empty. Add a Dex build or an owned Pokémon below.</p>"
    }</div>${pending ? '<button class="quiet" data-strategy="cancel">Cancel replacement</button>' : ""}
    <form id="strategy-save"><label>Team name<input name="name" required maxlength="80" value="${esc(draft.name)}" placeholder="Name your team"></label><button ${busy ? "disabled" : ""}>${draft.activePlan ? "Update team" : "Save team"}</button>${draft.activePlan ? '<button type="button" class="quiet" data-strategy="copy">Save as new</button><button type="button" class="danger" data-strategy="delete">Delete saved team</button>' : ""}</form>
    <div class="strategy-controls"><label>Free planning chart<select data-strategy-change="inverse">${options(["Standard", "Inverse"], draft.inverse ? "Inverse" : "Standard")}</select></label><label>Weakness threshold<select data-strategy-change="limit">${options(["0", "1", "2", "3", "4", "5", "6"], String(draft.limit))}</select></label><label class="check"><input type="checkbox" data-strategy-change="hard" ${draft.hard ? "checked" : ""}>Only show bench additions below threshold</label></div><section data-type-board>${teamBoard(draft, props.owned, dex, pending !== null)}</section>`;
    const board = root.querySelector(".team-board-scroll");
    if (board) board.scrollLeft = boardScroll;
    element("[data-enemy]", root).innerHTML =
      `<h2>Opposing encounter</h2><div class="strategy-controls"><label>Story encounter<select data-strategy-change="event"><option value="">Choose an encounter…</option>${encounters
        .map((e, i) => {
          const ref = battles.find((x) => x.id === (e.starter ? e.id + "-gible" : e.stages[0]));
          return `<option value="${e.id}" ${e.id === eventId ? "selected" : ""}>${visible ? `${e.group === "optional" ? "Optional · " : e.group === "postgame" ? "Postgame · " : e.group === "player-order" ? "League · any order · " : ""}${e.name ?? ref?.name.replace(/ \(Gible starter\)/, "") ?? e.id}` : `Encounter ${i + 1}${e.group === "player-order" ? " · player order" : ""}`}</option>`;
        })
        .join(
          "",
        )}</select></label><label>Exact difficulty<select data-strategy-change="difficulty">${options(["unknown", "Vanilla", "Difficult", "Expert", "Insane"], difficulty)}</select></label>
    ${current?.starter ? `<label>Your starter branch<select data-strategy-change="starter"><option value="">Choose your starter…</option>${options(["gible", "beldum", "larvitar"], starter)}</select></label>` : ""}
    ${current && current.stages.length > 1 ? `<label>Consecutive stage<select data-strategy-change="stage">${current.stages.map((id, i) => `<option value="${i}" ${stage === i ? "selected" : ""}>Stage ${i + 1}${visible ? " · " + esc(battles.find((x) => x.id === id)?.name ?? "unavailable") : ""}</option>`).join("")}</select></label>` : ""}</div>
    <div class="fight-reveal" role="group" aria-label="Spoiler controls">${["types", "team", "full"].map((r) => `<button class="quiet" data-strategy="reveal" data-id="${r}" aria-pressed="${r === reveal}">${r === "types" ? "Typing hints" : r === "team" ? "Reveal team" : "Full details"}</button>`).join("")}</div>
    <p>Choose progression yourself. Hints hide identities and scouting. Team reveal unlocks reference profiles; full details unlocks sets, role estimates, field notes and sources.</p>
    ${
      !current
        ? "<p>Select a story encounter to begin.</p>"
        : !v
          ? `<p role="status">${current.starter && !starter ? "Choose your starter branch." : `No sourced ${esc(difficulty)} roster is available for this encounter stage. No difficulty is substituted.`}</p>`
          : `<p>Version ${esc(v.version ?? "not established")} · ${esc(difficulty)} · ${esc(v.confidence ?? "community reference")}</p><div class="team-strip">${foes()
              .map((f, i) =>
                visible
                  ? `<button class="team-member" data-strategy="inspect-enemy" data-id="${i}">${f.dexId ? `<img src="/sprites/${f.dexId}.png" width="64" height="64" alt="">` : ""}<strong>${esc(f.name)}</strong><small>${badges(f.types) || "Typing unknown"}</small></button>`
                  : `<div class="type-hint">${badges(f.types) || "Typing unknown"}</div>`,
              )
              .join("")}</div>`
    }
    <button data-strategy="context" ${!current || difficulty === "unknown" || busy ? "disabled" : ""}>Save encounter & reveal preference</button>
    ${full && current ? `<details><summary>Ordering evidence and source coverage</summary><p>Chapter ${current.chapter}. ${esc(current.gap ?? "")} ${current.group === "player-order" ? "Elite Four may be faced in any order before Jax." : "Walkthrough progression; no automatic next-fight detection."}</p><a href="${current.evidence}" target="_blank" rel="noreferrer">Ordering evidence</a>${b ? sourceLinks(b) : ""}<p>Vanilla coverage is unavailable in the pinned versioned workbooks. Named postgame coverage remains partial; see the source audit.</p></details>${v ? `<p>${esc(v.rules?.format ?? "format unspecified")} · ${(v.rules?.notes ?? []).map(esc).join(" · ")}</p>${(v.notes ?? []).map((n) => `<p>${esc(n)}</p>`).join("")}` : ""}` : ""}`;
    renderAnalysis();
    renderCollection();
    element("[data-message]", root).textContent = message;
    renderInspector();
    if (focusKey)
      root
        .querySelector<HTMLElement>(`[data-strategy-change="${focusKey}"]`)
        ?.focus({ preventScroll: true });
    root.setAttribute("aria-busy", String(busy));
    root.querySelectorAll<HTMLElement>("[data-busy-disabled]").forEach((input) => {
      if (
        input instanceof HTMLInputElement ||
        input instanceof HTMLSelectElement ||
        input instanceof HTMLButtonElement ||
        input instanceof HTMLTextAreaElement
      )
        input.disabled = false;
      delete input.dataset.busyDisabled;
    });
    if (busy)
      root
        .querySelectorAll<HTMLElement>(
          "input:not(:disabled),select:not(:disabled),button:not(:disabled),textarea:not(:disabled)",
        )
        .forEach((input) => {
          input.dataset.busyDisabled = "true";
          if (
            input instanceof HTMLInputElement ||
            input instanceof HTMLSelectElement ||
            input instanceof HTMLButtonElement ||
            input instanceof HTMLTextAreaElement
          )
            input.disabled = true;
        });
  }
  function renderAnalysis() {
    element("[data-analysis]", root).innerHTML = strategyAnalysis(
      views(),
      foes(),
      rules(),
      reveal,
      draft.limit,
      pairSelection,
    );
    const suggestions = benchOptions(
      views().map((v) => v.combatant),
      props.owned.filter((p) => !ownedIds(draft.members).includes(p.id)),
      foes(),
      rules(),
      draft.limit,
      draft.hard,
    );
    element("[data-analysis]", root).innerHTML +=
      `<h3>Bench suggestions</h3><p>Known moves only; ranked by uncovered targets, then shared weaknesses resisted. Threshold applies to additions; at six, compare a replacement.</p>${
        suggestions
          .slice(0, 4)
          .map(
            (s) =>
              `<p><b>${esc(s.mon.nickname || s.mon.name)}</b> · ${reveal === "types" ? "Compare after revealing the opposing team." : `${s.fills} missing targets covered`} · resists ${s.protection} exposed types <button class="quiet" data-strategy="add-owned" data-id="${esc(s.mon.id)}">Add / replace</button></p>`,
          )
          .join("") || "<p>No additional candidates meet the selected threshold.</p>"
      }`;
  }
  function sourceLinks(b: Battle): string {
    const v = variant(),
      source = v?.source;
    const sources = Schema.is(Schema.String)(source)
      ? [{ url: source, label: "Exact roster source" }]
      : source
        ? [source]
        : (b.sources ?? []);
    return sources
      .filter((s) => s.url.startsWith("https://"))
      .map(
        (s) =>
          `<p><a href="${esc(s.url)}" target="_blank" rel="noreferrer">${esc(s.label ?? "Roster source")}</a></p>`,
      )
      .join("");
  }
  function renderCollection() {
    const search =
      control(root.querySelector("[data-collection-search]"))?.value.toLowerCase() ?? "";
    const scope = control(root.querySelector("[data-collection-scope]"))?.value ?? "all";
    const list = props.owned.filter(
      (p) =>
        (scope === "all" ||
          (scope === "shortlist" && draft.shortlist.includes(p.id)) ||
          (scope === "favorites" && context.favorites.includes(p.id)) ||
          scope === p.location.kind) &&
        `${p.nickname} ${p.name} ${p.types.join(" ")} ${p.ability} ${p.moves.map((m) => m.name).join(" ")}`
          .toLowerCase()
          .includes(search),
    );
    element("[data-missing-shortlist]", root).innerHTML = draft.shortlist
      .filter((id) => !props.owned.some((p) => p.id === id))
      .map(
        (id) =>
          `<p>Missing shortlisted identity: ${esc(id)} <button class="quiet" data-strategy="shortlist" data-id="${esc(id)}" ${ownedIds(draft.members).includes(id) ? "disabled" : ""}>Remove missing candidate</button></p>`,
      )
      .join("");
    element("[data-collection-results]", root).innerHTML =
      list
        .map(
          (p) =>
            `<article><strong>${esc(p.nickname || p.name)}</strong><small>${esc(p.name)} · Lv. ${p.level} · ${p.location.kind === "party" ? "Party" : `Box ${p.location.box}`}</small><button class="quiet" data-strategy="add-owned" data-id="${esc(p.id)}">Add / replace</button><button class="quiet" data-strategy="shortlist" data-id="${esc(p.id)}">${draft.shortlist.includes(p.id) ? "Remove shortlist" : "Shortlist"}</button><button class="quiet" data-strategy="favorite" data-id="${esc(p.id)}">${context.favorites.includes(p.id) ? "★ Unfavorite" : "☆ Favorite"}</button></article>`,
        )
        .join("") || "<p>No matching owned Pokémon. Sync a save or change your filters.</p>";
  }
  async function click(e: MouseEvent) {
    if (busy || !(e.target instanceof Element)) return;
    const species = e.target.closest<HTMLElement>("[data-species]");
    if (species && species.closest(".strategy-inspector")) {
      selection = { side: "dex", speciesId: Number(species.dataset.species) };
      renderInspector(true);
      return;
    }
    const button = e.target.closest<HTMLElement>("[data-strategy]");
    if (!button) return;
    const a = button.dataset.strategy,
      id = button.dataset.id ?? "";
    try {
      if (a === "find-owned") {
        const collection = root.querySelector<HTMLDetailsElement>("[data-collection-panel]");
        if (collection) collection.open = true;
        root.querySelector<HTMLElement>("[data-collection-search]")?.focus();
        return;
      }
      if (a === "find-build") {
        root.querySelector<HTMLElement>("[data-dex-search]")?.focus();
        return;
      }
      if (a === "inspect-candidate") {
        selection = { side: "candidate", index: Number(id) };
        renderInspector(true);
        return;
      }
      if (a === "board-bench") setMembers(draft.members.filter((_, i) => i !== Number(id)));
      if (a === "board-activate") {
        const candidate = boardCandidates(draft)[Number(id)];
        if (candidate) add(candidate);
      }
      if (a === "board-unlist") {
        const candidate = boardCandidates(draft)[Number(id)];
        if (candidate?.kind === "owned")
          update({ ...draft, shortlist: draft.shortlist.filter((x) => x !== candidate.pokemonId) });
        if (candidate?.kind === "build")
          update({
            ...draft,
            benchBuilds: (draft.benchBuilds ?? []).filter((x) => x !== candidate),
          });
        selection = null;
        pending = null;
      }
      if (a === "compare-build") {
        const builds = draft.benchBuilds ?? [];
        if (builds.length >= 24)
          throw Error("The reference bench holds 24 builds. Unlist one first.");
        update({
          ...draft,
          benchBuilds: [
            ...builds,
            { kind: "build", speciesId: Number(id), moveIds: [], ability: "", item: "", notes: "" },
          ],
        });
        selection = { side: "candidate", index: boardCandidates(draft).length - 1 };
      }
      if (a === "pair" && reveal !== "types") {
        pairSelection = {
          player: Number(button.dataset.player),
          enemy: Number(button.dataset.enemy),
        };
        const scroll = root.querySelector(".matchup-scroll")?.scrollLeft ?? 0;
        renderAnalysis();
        const grid = root.querySelector(".matchup-scroll");
        if (grid) grid.scrollLeft = scroll;
        root
          .querySelector<HTMLElement>(
            `[data-strategy="pair"][data-player="${pairSelection.player}"][data-enemy="${pairSelection.enemy}"]`,
          )
          ?.focus({ preventScroll: true });
        if (viewport.matches && e.detail > 0)
          root.querySelector("[data-pair-detail]")?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (a === "inspect-player" || a === "board-inspect" || a === "inspect-enemy") {
        selection = { side: a === "inspect-enemy" ? "enemy" : "player", index: Number(id) };
        form = 0;
        renderInspector(true);
        return;
      }
      if (a === "form") {
        form = Number(id);
        renderInspector();
        return;
      }
      if (a === "add-build")
        add({
          kind: "build",
          speciesId: Number(id),
          moveIds: [],
          ability: "",
          item: "",
          notes: "",
        });
      if (a === "add-owned") add({ kind: "owned", pokemonId: id });
      if ((a === "replace" || a === "board-replace") && pending) {
        setMembers(editTeam(draft.members, pending, Number(id)));
        pending = null;
        message = "Slot replaced.";
        selection = { side: "player", index: Number(id) };
      }
      if (a === "cancel") {
        pending = null;
        message = "Replacement cancelled.";
      }
      if (a === "remove") setMembers(draft.members.filter((_, i) => i !== Number(id)));
      if (a === "party") {
        setMembers(props.party.map((p) => ({ kind: "owned", pokemonId: p.id })));
        update({ ...draft, activePlan: null, name: "" });
        pending = null;
      }
      if (a === "new") {
        setMembers([]);
        update({ ...draft, activePlan: null, name: "" });
        pending = null;
      }
      if (a === "copy") update({ ...draft, activePlan: null });
      if (a === "shortlist") {
        if (!draft.shortlist.includes(id) && draft.shortlist.length >= 24)
          throw Error("The shortlist holds 24 individuals. Remove a candidate first.");
        if (ownedIds(draft.members).includes(id))
          throw Error("Active members stay on the shortlist. Remove the team member first.");
        update({
          ...draft,
          shortlist: draft.shortlist.includes(id)
            ? draft.shortlist.filter((x) => x !== id)
            : [...draft.shortlist, id],
        });
      }
      if (a === "favorite") {
        const next = {
          ...context,
          favorites: context.favorites.includes(id)
            ? context.favorites.filter((x) => x !== id)
            : [...context.favorites, id],
        };
        busy = true;
        render();
        await props.onContext(next);
        context = next;
      }
      if (a === "delete" && draft.activePlan) {
        const deletedId = draft.activePlan;
        busy = true;
        render();
        await props.onDelete(deletedId);
        if (disposed) return;
        plans = plans.filter((p) => p.id !== deletedId);
        update({ ...draft, activePlan: null });
        message = "Saved team deleted; your working draft remains.";
      }
      if (a === "reveal" && (id === "types" || id === "team" || id === "full")) {
        pairSelection = null;
        reveal = id;
        if (selection?.side === "enemy") selection = null;
      }
      if (a === "context") {
        busy = true;
        render();
        const next = {
          ...context,
          nextBattleId: targetId() ?? null,
          difficulty,
          fightReveal: reveal,
        };
        await props.onContext(next);
        context = next;
        message = "Encounter and reveal preference saved.";
      }
    } catch (error) {
      message = errorMessage(error);
    } finally {
      busy = false;
    }
    render();
    if ((a === "add-build" || a === "compare-build") && !pending) renderInspector(true);
  }
  function change(e: Event) {
    const input = control(e.target);
    if (busy || !input) return;
    if (input.closest("#build-form")) {
      captureProposal();
      return;
    }
    const key = input.dataset.strategyChange;
    if (input.matches("[data-collection-scope]")) {
      renderCollection();
      return;
    }
    if (!key) return;
    if (key === "event") {
      eventId = input.value;
      stage = 0;
    }
    if (key === "difficulty") difficulty = input.value;
    if (key === "starter") starter = input.value;
    if (key === "stage") stage = Number(input.value);
    if (["event", "difficulty", "starter", "stage"].includes(key)) {
      pairSelection = null;
      if (selection?.side === "enemy") selection = null;
      form = 0;
    }
    if (key === "inverse") update({ ...draft, inverse: input.value === "Inverse" });
    if (key === "limit") update({ ...draft, limit: Number(input.value) });
    if (key === "hard")
      update({ ...draft, hard: input instanceof HTMLInputElement && input.checked });
    if (key === "plan") {
      const p = plans.find((p) => p.id === input.value);
      if (p) {
        update({
          version: 2,
          members: p.members,
          benchBuilds: p.benchBuilds,
          shortlist: p.shortlistIds,
          inverse: p.inverse,
          limit: p.weaknessLimit,
          hard: p.hardLimit,
          name: p.name,
          activePlan: p.id,
        });
        selection = null;
        pending = null;
      }
    }
    render();
  }
  function input(e: Event) {
    const target = control(e.target);
    if (busy || !target) return;
    if (target.closest("#build-form")) {
      captureProposal();
      return;
    }
    if (target.matches("[data-collection-search]")) renderCollection();
    if (target.name === "name" && target.closest("#strategy-save"))
      update({ ...draft, name: target.value });
  }
  function captureProposal() {
    const formElement = root.querySelector("#build-form");
    if (
      !(formElement instanceof HTMLFormElement) ||
      (selection?.side !== "player" && selection?.side !== "candidate")
    )
      return;
    const index = selection.index,
      member = (selection.side === "player" ? draft.members : boardCandidates(draft))[index];
    if (member?.kind !== "build") return;
    const formData = new FormData(formElement);
    const moveIds = [0, 1, 2, 3].map((i) => {
      const value = Number(formData.get(`move${i}`));
      return value > 0 ? value : null;
    });
    const proposal = {
      ...member,
      moveIds,
      ability: Schema.decodeUnknownSync(Schema.String)(formData.get("ability")),
      item: Schema.decodeUnknownSync(Schema.String)(formData.get("item")),
      notes: Schema.decodeUnknownSync(Schema.String)(formData.get("notes")),
    };
    if (
      member.moveIds.length === proposal.moveIds.length &&
      member.moveIds.every((id, i) => id === proposal.moveIds[i]) &&
      member.ability === proposal.ability &&
      member.item === proposal.item &&
      member.notes === proposal.notes
    )
      return;
    if (pending === member) pending = proposal;
    update(
      selection.side === "player"
        ? { ...draft, members: draft.members.map((m, i) => (i === index ? proposal : m)) }
        : {
            ...draft,
            benchBuilds: (draft.benchBuilds ?? []).map((m) => (m === member ? proposal : m)),
          },
    );
    const boardScroll = root.querySelector(".team-board-scroll")?.scrollLeft ?? 0;
    element("[data-type-board]", root).innerHTML = teamBoard(
      draft,
      props.owned,
      dex,
      pending !== null,
    );
    const board = root.querySelector(".team-board-scroll");
    if (board) board.scrollLeft = boardScroll;
    renderAnalysis();
  }
  async function submit(e: SubmitEvent) {
    if (
      !(e.target instanceof HTMLFormElement) ||
      !["strategy-save", "build-form"].includes(e.target.id)
    )
      return;
    e.preventDefault();
    if (busy) return;
    try {
      if (e.target.id === "strategy-save") {
        busy = true;
        render();
        const p = await props.onSave(draft);
        if (disposed) return;
        plans = [p, ...plans.filter((x) => x.id !== p.id)];
        update({ ...draft, activePlan: p.id });
        message = "Team saved to your owner account.";
      } else if (selection?.side === "player" || selection?.side === "candidate") {
        const index = selection.index,
          m = (selection.side === "player" ? draft.members : boardCandidates(draft))[index];
        if (m?.kind === "build") {
          captureProposal();
          message = "Proposal applied. Save the team to keep it across devices.";
        }
      }
    } catch (error) {
      message = errorMessage(error);
    } finally {
      busy = false;
    }
    render();
  }
  const onClick = (e: MouseEvent) => {
      void click(e);
    },
    onSubmit = (e: SubmitEvent) => {
      void submit(e);
    };
  root.innerHTML = '<p role="status">Loading the strategy workspace…</p>';
  Promise.all([
    fetch("/data/dex.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error("Dex reference unavailable");
        return r.json();
      })
      .then(Schema.decodeUnknownPromise(DexSchema)),
    fetch("/data/battles.json", { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw Error("Encounter reference unavailable");
        return r.json();
      })
      .then(Schema.decodeUnknownPromise(BattlesSchema)),
  ])
    .then(([d, b]) => {
      if (disposed) return;
      dex = d;
      battles = b;
      root.innerHTML = `<header class="dex-heading"><div class="eyebrow">POKÉDEX · STRATEGY WORKSPACE</div><h1>Find your six.</h1><p>Your collection, hypothetical builds and sourced opponents in one place.</p></header><div data-message role="status" aria-live="polite"></div><div class="strategy-layout"><div class="strategy-main"><section class="panel strategy-search" data-dex></section><section class="panel" data-player></section><div data-player-detail></div><section class="panel" data-enemy></section><section class="panel" data-analysis></section><div data-enemy-detail></div><details class="panel" data-collection-panel><summary>Your collection & shortlist</summary><label>Find an owned Pokémon<input type="search" data-collection-search></label><label>Collection filter<select data-collection-scope>${options(["all", "party", "box", "favorites", "shortlist"], "all")}</select></label><div data-missing-shortlist></div><div data-collection-results></div></details></div><div data-desktop-detail><section class="panel strategy-inspector" tabindex="-1" aria-label="Pokémon inspector"></section></div></div>`;
      cleanupDex = mountDex(element("[data-dex]", root), {
        owned: props.owned,
        data: dex,
        state: props.session.browser,
        onSelect: (speciesId) => {
          selection = { side: "dex", speciesId };
          renderInspector(true);
        },
      });
      root.addEventListener("click", onClick);
      root.addEventListener("change", change);
      root.addEventListener("input", input);
      root.addEventListener("submit", onSubmit);
      render();
    })
    .catch((error) => {
      if (!disposed)
        root.innerHTML = `<p role="alert">${esc(errorMessage(error))}. Reload to retry; your saved draft is retained.</p>`;
    });
  return () => {
    disposed = true;
    abort.abort();
    viewport.removeEventListener("change", moveInspector);
    cleanupDex?.();
    root.removeEventListener("click", onClick);
    root.removeEventListener("change", change);
    root.removeEventListener("input", input);
    root.removeEventListener("submit", onSubmit);
  };
}
