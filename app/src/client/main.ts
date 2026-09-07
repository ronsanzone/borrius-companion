import { renderCamp } from "./features/camp";
import {
  mountStrategy,
  strategySession,
  type StrategySession,
} from "./features/strategy-workspace";
import { renderJournal } from "./features/journal";
import { renderSettings } from "./features/settings";
import { age, portrait, types } from "./components";
import type { ViewModel } from "./view-model";
import { mountTypeTools } from "./features/type-tools";
import { ownedIds } from "../shared/team";
import { readPlannerDraft, writePlannerDraft } from "./planner-storage";
import { element as $, esc, errorMessage, dialog } from "./dom";
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
import type { AppState, Pairing, PlannerDraft } from "./contracts";
import { SnapshotSchema } from "../shared/types";
import type { Pokemon, Snapshot } from "../shared/types";
let state: AppState = emptyState,
  view = location.hash.slice(1) || "today",
  loaded = false,
  compare: Snapshot | null = null,
  pair: Pairing | null = null,
  toolCleanup: (() => void) | null = null;
let draft: PlannerDraft = readPlannerDraft() ?? {
  version: 2,
  members: [],
  shortlist: [],
  inverse: false,
  limit: 3,
  hard: false,
  name: "",
  activePlan: null,
};
let workspaceSession: StrategySession | null = null;
const hadDraft = readPlannerDraft() !== null;
const owned = () =>
  state.snapshot
    ? [...state.snapshot.party, ...state.snapshot.boxes.flatMap((b) => b.pokemon)]
    : [];
const team = () =>
  ownedIds(draft.members).flatMap((id) => {
    const p = owned().find((p) => p.id === id);
    return p ? [p] : [];
  });
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
    state = await request(StateSchema, "/state");
    if (!loaded && !hadDraft) {
      const ids = state.snapshot?.party.map((p) => p.id) ?? [];
      draft = {
        ...draft,
        members: ids.map((pokemonId) => ({ kind: "owned", pokemonId })),
        shortlist: ids,
      };
    }
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
function viewModel(): ViewModel {
  return { state, selected: ownedIds(draft.members), compare, pair, owned };
}
function render() {
  view = ["today", "journey", "settings", "dex", "types"].includes(view)
    ? view
    : ["lab", "prepare"].includes(view)
      ? "dex"
      : "today";
  document.querySelectorAll<HTMLAnchorElement>("nav a").forEach((a) => {
    const active = a.hash === "#" + view;
    a.classList.toggle("active", active);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  $("#status").innerHTML = `<span class="light">
      </span>${state.snapshot ? `Last snapshot ${esc(age(state.snapshot.capturedAt))} · ${esc(state.snapshot.gameVersion)}` : "Awaiting your first save"}`;
  $("#content").dataset.view = view;
  if (toolCleanup) {
    toolCleanup();
    toolCleanup = null;
  }
  const toolProps = { owned: owned(), active: team() };
  if (view === "dex")
    toolCleanup = mountStrategy($("#content"), {
      owned: owned(),
      party: state.snapshot?.party ?? [],
      plans: state.plans,
      context: state.context,
      draft,
      session: workspaceSession ?? (workspaceSession = strategySession(state.context)),
      onDraft: (next) => {
        draft = next;
        if (!writePlannerDraft(next))
          notify(
            "Browser draft storage is unavailable. Save the team to your account before leaving.",
          );
      },
      onSave: async (next) => {
        const plan = await request(PlanSchema, "/plans", "POST", {
          id: next.activePlan ?? undefined,
          name: next.name,
          members: next.members,
          benchBuilds: next.benchBuilds,
          shortlistIds: next.shortlist,
          inverse: next.inverse,
          weaknessLimit: next.limit,
          hardLimit: next.hard,
        });
        state = { ...state, plans: [plan, ...state.plans.filter((p) => p.id !== plan.id)] };
        return plan;
      },
      onDelete: async (id) => {
        await request(OkSchema, "/plans/" + encodeURIComponent(id), "DELETE");
        state = { ...state, plans: state.plans.filter((p) => p.id !== id) };
      },
      onContext: async (context) => {
        state = { ...state, context: await request(ContextSchema, "/context", "PUT", context) };
      },
    });
  else if (view === "types") toolCleanup = mountTypeTools($("#content"), toolProps);
  else {
    const model = viewModel();
    $("#content").innerHTML =
      view === "journey"
        ? renderJournal(model)
        : view === "settings"
          ? renderSettings(model)
          : renderCamp(model);
  }
  document.title = `${{ today: "Camp", journey: "Journal", settings: "Connection", dex: "Pokédex strategy", types: "Type Desk" }[view]} · Borrius`;
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
document.addEventListener("submit", (e) => {
  void handleSubmit(e);
});
async function handleSubmit(e: SubmitEvent) {
  const form = e.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!["context-form", "note-form", "import-form"].includes(form.id)) return;
  e.preventDefault();
  const b = form.querySelector("button");
  if (!b) return;
  b.disabled = true;
  const f = new FormData(form);
  try {
    if (form.id === "context-form") {
      await request(ContextSchema, "/context", "PUT", {
        ...state.context,
        difficulty: f.get("difficulty"),
        levelCap: f.get("levelCap") ? Number(f.get("levelCap")) : null,
        checkpoint: f.get("checkpoint"),
        spoilerMode: f.get("spoilerMode"),
        fightReveal: f.get("spoilerMode") === "full" ? "full" : "types",
      });
      workspaceSession = null;
    }
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
