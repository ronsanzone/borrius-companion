import { esc, element, control } from "../dom";
import type { Dex, DexSpecies, Evolution, DexFilters } from "./dex-data";
import type { Pokemon } from "../../shared/types";
const title = (v: string) =>
  v
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function filterDex(
  species: readonly DexSpecies[],
  moves: Dex["moves"],
  { query = "", type = "", ownedOnly = false, ownedIds = [] }: DexFilters = {},
) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean),
    ids = new Set(ownedIds);
  return species.filter(
    (s) =>
      (!type || s.types.includes(type)) &&
      (!ownedOnly || ids.has(s.speciesId)) &&
      terms.every((term) =>
        [
          s.name,
          s.dexId,
          ...s.types,
          ...s.abilities,
          s.hiddenAbility,
          ...[
            ...s.learnset.map((m) => m.moveId),
            ...s.eggMoves,
            ...(s.machineMoves || []),
            ...(s.tutorMoves || []),
          ].map((id) => moves[id]?.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(term),
      ),
  );
}
export function evolutionLabel(e: Evolution) {
  const item = title(e.parameter.replace(/^ITEM_/, ""));
  if (e.method === "EVO_LEVEL") return `Level ${e.parameter}`;
  if (e.method === "EVO_ITEM") return `Use ${item}`;
  if (e.method === "EVO_FRIENDSHIP") return "High friendship";
  if (e.method === "EVO_FRIENDSHIP_DAY") return "High friendship · daytime";
  if (e.method === "EVO_FRIENDSHIP_NIGHT") return "High friendship · nighttime";
  return `${title(e.method.replace(/^EVO_/, ""))} · ${item}${e.extra !== "0" ? " · " + title(e.extra) : ""}`;
}
export interface DexBrowserState {
  selected: number | null;
  page: number;
  search: string;
  type: string;
  ownedOnly: boolean;
}
export function mountDex(
  container: HTMLElement,
  {
    owned,
    data,
    onSelect,
    state,
  }: {
    owned: readonly Pokemon[];
    data: Dex;
    onSelect: (speciesId: number) => void;
    state: DexBrowserState;
  },
) {
  let selected: number | null = state.selected,
    page = state.page,
    search = state.search,
    type = state.type,
    ownedOnly = state.ownedOnly;
  const counts = new Map<number, number>();
  for (const p of owned) counts.set(p.speciesId, (counts.get(p.speciesId) || 0) + 1);
  container.classList.add("dex-root");
  container.innerHTML = '<div class="dex-loading" role="status">Opening your Pokédex…</div>';
  const badges = (types: readonly string[]) =>
    types
      .map((t) => `<span class="dex-type" data-type="${esc(t.toLowerCase())}">${esc(t)}</span>`)
      .join("");
  const sprite = (s: DexSpecies) =>
    `<img class="dex-sprite" src="/sprites/${s.dexId}.png" alt="" loading="lazy">`;
  function results() {
    Object.assign(state, { selected, page, search, type, ownedOnly });
    const list = filterDex(data.species, data.moves, {
      query: search,
      type,
      ownedOnly,
      ownedIds: [...counts.keys()],
    });
    page = Math.min(page, Math.max(0, Math.ceil(list.length / 36) - 1));
    element(".dex-count", container).textContent = `${list.length} species & forms`;
    element(".dex-results", container).innerHTML =
      list
        .slice(page * 36, page * 36 + 36)
        .map(
          (s) =>
            `<button class="dex-entry ${s.speciesId === selected ? "dex-selected" : ""}" data-species="${s.speciesId}" aria-pressed="${s.speciesId === selected}">${sprite(s)}<span>
      <small>#${s.dexId}${counts.has(s.speciesId) ? " · Owned " + counts.get(s.speciesId) : ""}</small>
      <strong>${esc(s.name)}</strong>${badges(s.types)}</span>
      </button>`,
        )
        .join("") || "<p>No matching Pokémon. Try fewer filters.</p>";
    element(".dex-pager", container).innerHTML =
      `<button data-page="-1" ${!page ? "disabled" : ""}>Previous</button>
      <span>${page + 1} / ${Math.max(1, Math.ceil(list.length / 36))}</span>
      <button data-page="1" ${(page + 1) * 36 >= list.length ? "disabled" : ""}>Next</button>`;
  }
  function render() {
    container.innerHTML = `<header class="dex-heading">
      <div class="eyebrow">POKÉDEX</div>
      <h2>Explore the Pokédex</h2>

      </header>
      <div class="dex-filters">
      <label>Search species, ability or learnable move<input data-dex-search type="search" placeholder="Joltik, Levitate, Thunderbolt…" value="${esc(search)}">
      </label>
      <label>Type<select data-dex-type>
      <option value="">All types</option>${[...new Set(data.species.flatMap((s) => s.types))]
        .sort()
        .map((t) => `<option ${type === t ? "selected" : ""}>${esc(t)}</option>`)
        .join("")}</select>
      </label>
      <label class="dex-check">
      <input data-dex-owned type="checkbox" ${ownedOnly ? "checked" : ""}>Owned only</label>
      </div>
      <details class="dex-search-results" ${search ? "open" : ""}><summary>Browse results</summary><div class="dex-layout">
      <section class="dex-browser" aria-label="Species results">
      <p class="dex-count" aria-live="polite">
      </p>
      <div class="dex-results">
      </div>
      <div class="dex-pager">
      </div>
      </section>

      </div>
      </details><details class="dex-source">
      <summary>Reference source & coverage</summary>
      <p>${esc(data.source.notice)}</p>
      <p>National Dex 1–809 and catalogued forms. Forms use their species’ standard sprite. No encounter-location claims or randomized-mode predictions.</p>
      <a href="${esc(data.source.url)}" target="_blank" rel="noopener noreferrer">Pinned Unbound expansion reference ↗</a>
      </details>`;
    results();
  }
  const onInput = (e: Event) => {
    const target = control(e.target);
    if (!target) return;
    if (target.matches("[data-dex-search]")) {
      search = target.value;
      const resultsPanel = container.querySelector(".dex-search-results");
      if (resultsPanel instanceof HTMLDetailsElement) resultsPanel.open = true;
      page = 0;
      results();
    }
  };
  const onChange = (e: Event) => {
    const target = control(e.target);
    if (!target) return;
    if (target.matches("[data-dex-type]")) type = target.value;
    else if (target.matches("[data-dex-owned]"))
      ownedOnly = target instanceof HTMLInputElement && target.checked;
    else return;
    page = 0;
    results();
  };
  const onClick = (e: MouseEvent) => {
    const button = e.target instanceof Element ? e.target.closest("button") : null;
    if (!button) return;
    if (button.dataset.species) {
      selected = Number(button.dataset.species);
      onSelect(selected);
      results();
    } else if (button.dataset.page) {
      page += Number(button.dataset.page);
      results();
      element(".dex-results", container).scrollTop = 0;
    }
  };
  container.addEventListener("input", onInput);
  container.addEventListener("change", onChange);
  container.addEventListener("click", onClick);
  render();
  return () => {
    container.removeEventListener("input", onInput);
    container.removeEventListener("change", onChange);
    container.removeEventListener("click", onClick);
    container.classList.remove("dex-root");
  };
}
