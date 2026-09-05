import { renderCamp } from "./features/camp";
import { renderPlanner } from "./features/planner";
import { renderJournal } from "./features/journal";
import { renderSettings } from "./features/settings";
import { age, portrait, types } from "./components";
import type { ViewModel } from "./view-model";
import { mountDex } from "./features/dex";
import { mountTypeTools } from "./features/type-tools";
import { mountBattlePrep } from "./features/battle-prep";
import { exposure, toggleActive } from "../shared/planner";
import { readPlannerDraft, writePlannerDraft } from "./planner-storage";
import { element as $, esc, errorMessage, dialog, control } from "./dom";
import { request } from "./api";
import {
  StateSchema,
  ContextSchema,
  PlanSchema,
  PairingSchema,
  ReceiptSchema,
  OkSchema,
  NoteSchema,
  emptyState,
} from "./contracts";
import type { AppState, Pairing } from "./contracts";
import { SnapshotSchema } from "../shared/types";
import type { Pokemon, Snapshot } from "../shared/types";
let state: AppState = emptyState,
  selected: string[] = [],
  inverse = false,
  limit = 3,
  hard = false,
  query = "",
  scope = "all",
  view = location.hash.slice(1) || "today",
  loaded = false,
  compare: Snapshot | null = null,
  pair: Pairing | null = null,
  opponent = ["normal"],
  activePlan: string | null = null,
  collectionPage = 0,
  toolCleanup: (() => void) | null = null,
  shortlist: string[] = [],
  focusBoard = false,
  swapIn: string | null = null,
  draftName = "",
  lastCounts: Record<string, number> | null = null,
  plannerMessage = "";
const owned = () =>
    state.snapshot
      ? [...state.snapshot.party, ...state.snapshot.boxes.flatMap((b) => b.pokemon)]
      : [],
  team = () =>
    selected
      .map((id) => owned().find((p) => p.id === id))
      .filter((pokemon): pokemon is Pokemon => pokemon !== undefined);
function notify(text: string) {
  $("#notice").textContent = text;
  setTimeout(() => {
    $("#notice").textContent = "";
  }, 9000);
}
let refreshing = false;
async function refresh(quiet = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    const previous = state.snapshot?.id;
    state = await request(StateSchema, "/state");
    if (!loaded || !previous) selected = state.snapshot?.party.map((p) => p.id) || [];
    else if (previous !== state.snapshot?.id)
      selected = selected.filter((id) => owned().some((p) => p.id === id));
    if (!loaded) {
      shortlist = [...selected];
      {
        const d = readPlannerDraft();
        if (d) {
          shortlist = (d.shortlist || [])
            .filter((id) => owned().some((p) => p.id === id))
            .slice(0, 24);
          selected = (d.selected || []).filter((id) => shortlist.includes(id)).slice(0, 6);
          inverse = !!d.inverse;
          limit = Math.max(1, Math.min(6, d.limit || 3));
          draftName = d.name || "";
          activePlan = state.plans.some((p) => p.id === d.activePlan) ? d.activePlan : null;
        }
      }
    }
    shortlist = [
      ...new Set([...shortlist.filter((id) => owned().some((p) => p.id === id)), ...selected]),
    ];
    if (swapIn && !shortlist.includes(swapIn)) swapIn = null;
    loaded = true;
    render();
    if (!quiet) notify("Playthrough refreshed.");
  } catch (e) {
    $("#status").textContent = "Connection needs attention";
    if (!loaded)
      $("#content").innerHTML = `<div class="empty">
      <h2>Let’s reconnect.</h2>
      <p>${esc(errorMessage(e))}</p>
      <button data-action="refresh">Try again</button>
      </div>`;
    else notify(errorMessage(e));
  } finally {
    refreshing = false;
  }
}
const planningRoster = () =>
  shortlist
    .map((id) => owned().find((p) => p.id === id))
    .filter((pokemon): pokemon is Pokemon => pokemon !== undefined);
function viewModel(): ViewModel {
  return {
    state,
    selected,
    inverse,
    limit,
    hard,
    query,
    scope,
    compare,
    pair,
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
  };
}
function render() {
  const gridScroll = document.querySelector<HTMLElement>(".planning-scroll")?.scrollLeft || 0,
    gridY = document.querySelector<HTMLElement>(".planning-scroll")?.scrollTop || 0,
    pickerY = document.querySelector<HTMLElement>(".picker-list")?.scrollTop || 0;
  const focus =
    document.activeElement instanceof HTMLElement ? document.activeElement.dataset : undefined;

  view = ["today", "lab", "prepare", "journey", "settings", "dex", "types"].includes(view)
    ? view
    : "today";
  document.querySelectorAll<HTMLAnchorElement>("nav a").forEach((a) => {
    const active = a.hash === "#" + view;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#status").innerHTML = `<span class="light">
      </span>${state.snapshot ? `Last snapshot ${esc(age(state.snapshot.capturedAt))} · ${esc(state.snapshot.gameVersion)}` : "Awaiting your first save"}`;
  document.body.classList.toggle("planner-focus", view === "lab" && focusBoard);
  $("#content").dataset.view = view;
  if (toolCleanup) {
    toolCleanup();
    toolCleanup = null;
  }
  const toolProps = { owned: owned(), active: team() };
  if (view === "dex") toolCleanup = mountDex($("#content"), toolProps);
  else if (view === "types") toolCleanup = mountTypeTools($("#content"), toolProps);
  else if (view === "prepare")
    toolCleanup = mountBattlePrep($("#content"), {
      ...toolProps,
      party: state.snapshot?.party || [],
      shortlist: [...shortlist],
      context: state.context,
      onInspect: detail,
      onSaveContext: async (patch) => {
        state = {
          ...state,
          context: await request(ContextSchema, "/context", "PUT", {
            ...state.context,
            ...patch,
          }),
        };
      },
      onShortlist: (id) => {
        if (!shortlist.includes(id)) {
          if (shortlist.length >= 24)
            throw Error("The planning board has 24 candidates. Remove one there first.");
          shortlist.push(id);
        }
        writePlannerDraft({ shortlist, selected, inverse, limit, name: draftName, activePlan });
      },
    });
  else {
    const model = viewModel();
    $("#content").innerHTML =
      view === "lab"
        ? renderPlanner(model)
        : view === "journey"
          ? renderJournal(model)
          : view === "settings"
            ? renderSettings(model)
            : renderCamp(model);
  }
  if (view === "lab") {
    if (document.querySelector(".planning-scroll")) {
      $(".planning-scroll").scrollLeft = gridScroll;
      $(".planning-scroll").scrollTop = gridY;
    }
    if (document.querySelector(".picker-list")) $(".picker-list").scrollTop = pickerY;
    if (focus?.action && focus?.id)
      [...document.querySelectorAll<HTMLElement>("[data-action]")]
        .find((b) => b.dataset.action === focus.action && b.dataset.id === focus.id)
        ?.focus({ preventScroll: true });
    writePlannerDraft({ shortlist, selected, inverse, limit, name: draftName, activePlan });
  }
  document.title = `${{ today: "Today", lab: "The Pokémon workshop", prepare: "Prepare", journey: "Journey", settings: "Connection", dex: "Pokédex", types: "Type Desk" }[view]} · Borrius`;
}
const statKeys: readonly (keyof Pokemon["ivs"])[] = ["hp", "atk", "def", "spe", "spa", "spd"];
function detail(id: string) {
  const p = owned().find((p) => p.id === id);
  if (!p) return;
  $("#detail-content").innerHTML =
    `<div class="detail-portrait" aria-hidden="true">${portrait(p)}</div>
      <div class="eyebrow">${p.location.kind === "party" ? "Current party" : "Box " + p.location.box} · identity ${esc(p.identityConfidence)}</div>
      <h1>${esc(p.nickname || p.name)}</h1>
      <p>${esc(p.name)} · Level ${p.level} · ${esc(p.nature)} nature</p>
      <div class="types">${types(p.types)}</div>
      <div class="stats">
      <div>Ability<strong>${esc(p.ability)}</strong>
      </div>
      <div>Held item<strong>${esc(p.item || "None")}</strong>
      </div>
      <div>HP<strong>${p.hp ? `${p.hp?.current} / ${p.hp?.max}` : "Not stored"}</strong>
      </div>
      </div>
      <button class="quiet" data-action="favorite" data-id="${esc(p.id)}">${state.context.favorites.includes(p.id) ? "★ Remove favorite" : "☆ Keep as favorite"}</button>
      <h2 style="margin-top:24px">Known moves</h2>
      <div class="table-wrap">
      <table>
      <thead>
      <tr>
      <th>Move</th>
      <th>Type</th>
      <th>Category</th>
      <th>Power</th>
      <th>Accuracy</th>
      <th>PP</th>
      </tr>
      </thead>
      <tbody>${p.moves
        .map(
          (m) => `<tr>
      <td>${esc(m.name)}</td>
      <td>${types(m.type ? [m.type] : []) || "Unknown"}</td>
      <td>${esc(m.category)}</td>
      <td>${m.power ?? "—"}</td>
      <td>${m.accuracy ?? "—"}</td>
      <td>${m.pp ?? "—"}/${m.maxPp ?? "—"}</td>
      </tr>`,
        )
        .join("")}</tbody>
      </table>
      </div>
      <h2 style="margin-top:24px">Build details</h2>
      <div class="table-wrap">
      <table>
      <thead>
      <tr>
      <th>Stat</th>
      <th>Current</th>
      <th>IV</th>
      <th>EV</th>
      </tr>
      </thead>
      <tbody>${statKeys
        .map(
          (k) => `<tr>
      <th>${esc(k)}</th>
      <td>${p.stats?.[k] ?? "—"}</td>
      <td>${p.ivs[k] ?? "—"}</td>
      <td>${p.evs[k] ?? "—"}</td>
      </tr>`,
        )
        .join("")}</tbody>
      </table>
      </div>
      <p>Stored snapshot values. Box battle stats may be unavailable. Type matchup analysis does not simulate ability or item effects.</p>`;
  if (!dialog().open) dialog().showModal();
}
$("#detail .close").onclick = () => dialog().close();
dialog().addEventListener("click", (e) => {
  if (e.target === dialog()) dialog().close();
});
$("#refresh").onclick = () => refresh();
window.addEventListener("hashchange", () => {
  view = location.hash.slice(1);
  render();
  window.scrollTo(0, 0);
});
document.addEventListener("click", (e) => {
  void handleClick(e);
});
async function handleClick(e: MouseEvent) {
  const b = e.target instanceof Element ? e.target.closest("button[data-action]") : null;
  if (!(b instanceof HTMLButtonElement)) return;
  const action = b.dataset.action ?? "",
    id = b.dataset.id ?? "";
  try {
    if (action === "refresh") return refresh();
    if (action === "detail") return detail(id);
    if (["activate", "party"].includes(action))
      lastCounts = Object.fromEntries(
        exposure(planningRoster(), selected, inverse, limit).map((r) => [r.type, r.count]),
      );
    if (action === "shortlist") {
      if (shortlist.length >= 24)
        return notify("The board holds 24 candidates. Remove one with × to make room.");
      if (!shortlist.includes(id)) shortlist.push(id);
      plannerMessage = "Candidate added to the bench. Activate or swap them in from their column.";
    }
    if (action === "focus-board") focusBoard = !focusBoard;
    if (action === "cancel-swap") swapIn = null;
    if (action === "activate") {
      if (swapIn === id) swapIn = null;
      else if (swapIn && selected.includes(id)) {
        selected = [...toggleActive(selected, id, swapIn)];
        plannerMessage = "Swap complete. Counts show the change from your previous team.";
        swapIn = null;
      } else if (!selected.includes(id) && selected.length === 6) {
        swapIn = id;
      } else {
        selected = [...toggleActive(selected, id)];
        swapIn = null;
        plannerMessage = "Team updated. Only active columns count.";
      }
    }
    if (action === "unlist") {
      lastCounts = Object.fromEntries(
        exposure(planningRoster(), selected, inverse, limit).map((r) => [r.type, r.count]),
      );
      shortlist = shortlist.filter((x) => x !== id);
      selected = selected.filter((x) => x !== id);
      if (swapIn === id) swapIn = null;
    }
    if (action === "select") {
      if (selected.includes(id)) selected = selected.filter((x) => x !== id);
      else if (selected.length < 6) selected.push(id);
      else return notify("A plan can have up to six Pokémon. Bench one first.");
    }
    if (action === "party" && state.snapshot) {
      selected = state.snapshot.party.map((p) => p.id);
      shortlist = [...new Set([...selected, ...shortlist])].slice(0, 24);
      swapIn = null;
      activePlan = null;
      draftName = "";
    }
    if (action === "left" || action === "right") {
      const i = shortlist.indexOf(id),
        j = i + (action === "left" ? -1 : 1);
      if (j >= 0 && j < shortlist.length)
        [shortlist[i], shortlist[j]] = [shortlist[j], shortlist[i]];
    }
    if (action === "page-prev") collectionPage = Math.max(0, collectionPage - 1);
    if (action === "page-next") collectionPage++;
    if (action === "new-plan") activePlan = null;
    if (action === "load-plan") {
      const p = state.plans.find((p) => p.id === id);
      if (!p) return;
      selected = p.memberIds.filter((id) => owned().some((p) => p.id === id));
      shortlist = [...new Set([...(p.shortlistIds || p.memberIds), ...selected])].filter((id) =>
        owned().some((p) => p.id === id),
      );
      swapIn = null;
      lastCounts = null;
      draftName = p.name;
      inverse = p.inverse;
      limit = Math.max(1, p.weaknessLimit);
      hard = p.hardLimit;
      activePlan = id;
      if (selected.length !== p.memberIds.length)
        notify("Some plan members are absent from this snapshot; available members were loaded.");
    }
    if (action === "delete-plan") {
      await request(OkSchema, "/plans/" + encodeURIComponent(id), "DELETE");
      if (activePlan === id) activePlan = null;
      await refresh(true);
      return;
    }
    if (action === "favorite") {
      const favorites = state.context.favorites.includes(id)
        ? state.context.favorites.filter((x) => x !== id)
        : [...state.context.favorites, id];
      state = {
        ...state,
        context: await request(ContextSchema, "/context", "PUT", {
          ...state.context,
          favorites,
        }),
      };
      render();
      return detail(id);
    }
    if (action === "pair") {
      b.disabled = true;
      pair = await request(PairingSchema, "/pairings", "POST", {});
    }
    if (action === "revoke") {
      b.disabled = true;
      await request(OkSchema, "/devices/" + encodeURIComponent(id) + "/revoke", "POST", {});
      await refresh(true);
      return notify("Device upload access revoked.");
    }
    if (action === "compare") {
      compare = await request(SnapshotSchema, "/snapshots/" + encodeURIComponent(id));
    }
    render();
  } catch (e) {
    b.disabled = false;
    notify(errorMessage(e));
  }
}
document.addEventListener("change", (e) => {
  const target = control(e.target);
  if (!target) return;
  if (target.id === "scope") {
    scope = target.value;
    collectionPage = 0;
  } else if (target.id === "inverse") {
    inverse = target.value === "true";
    lastCounts = null;
    swapIn = null;
  } else if (target.id === "limit") limit = Number(target.value);
  else if (target.id === "hard") hard = target instanceof HTMLInputElement && target.checked;
  else if (target.id === "opp1")
    opponent = [
      target.value,
      ...(opponent[1] && opponent[1] !== target.value ? [opponent[1]] : []),
    ];
  else if (target.id === "opp2")
    opponent = [
      opponent[0],
      ...(target.value !== "none" && target.value !== opponent[0] ? [target.value] : []),
    ];
  else return;
  render();
});
let searchTimer: ReturnType<typeof setTimeout> | undefined;
document.addEventListener("input", (e) => {
  const target = control(e.target);
  if (!target) return;
  if (target.name === "name" && target.closest("#plan-form")) {
    draftName = target.value;
    return;
  }
  if (target.id !== "search") return;
  query = target.value;
  collectionPage = 0;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const start = target instanceof HTMLSelectElement ? null : target.selectionStart;
    render();
    $("#search")?.focus();
    const search = control(document.querySelector("#search"));
    if (search instanceof HTMLInputElement) search.setSelectionRange(start, start);
  }, 170);
});
document.addEventListener("submit", (e) => {
  void handleSubmit(e);
});
async function handleSubmit(e: SubmitEvent) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!["plan-form", "context-form", "note-form", "import-form"].includes(form.id)) return;
  e.preventDefault();
  const b = form.querySelector("button");
  if (!b) return;
  b.disabled = true;
  const f = new FormData(form);
  try {
    if (form.id === "plan-form") {
      const p = await request(PlanSchema, "/plans", "POST", {
        id: activePlan ?? undefined,
        name: f.get("name"),
        memberIds: selected,
        shortlistIds: shortlist,
        inverse,
        weaknessLimit: limit,
        hardLimit: hard,
      });
      activePlan = p.id;
    }
    if (form.id === "context-form")
      await request(ContextSchema, "/context", "PUT", {
        ...state.context,
        difficulty: f.get("difficulty"),
        levelCap: f.get("levelCap") ? Number(f.get("levelCap")) : null,
        checkpoint: f.get("checkpoint"),
        spoilerMode: f.get("spoilerMode"),
      });
    if (form.id === "note-form")
      await request(NoteSchema, "/notes", "POST", {
        text: f.get("text"),
        snapshotId: state.snapshot?.id,
      });
    if (form.id === "import-form") {
      const file = f.get("save");
      if (!(file instanceof File) || !file.size) throw Error("Choose a cartridge save file.");
      if (file.size > 1048576)
        throw Error("This file is too large for a cartridge save. Choose the .srm or .sav file.");
      const receipt = await request(
        ReceiptSchema,
        "/import",
        "POST",
        await file.arrayBuffer(),
        file.name,
      );
      if (receipt.status === "failed")
        throw Error(receipt.error || "The save could not be parsed.");
      notify(
        receipt.status === "ready"
          ? "Snapshot imported."
          : "Save uploaded. Processing will appear in Journey; the page refreshes automatically.",
      );
    }
    await refresh(true);
    if (form.id !== "import-form") notify("Saved.");
  } catch (err) {
    notify(errorMessage(err));
    b.disabled = false;
  }
}
void refresh(true);
setInterval(() => {
  if (
    !["dex", "types", "prepare"].includes(view) &&
    !document.hidden &&
    !dialog().open &&
    !document.activeElement?.matches("input,textarea,select")
  )
    void refresh(true);
}, 60000);
