import { esc } from "./dom";
import type { Pokemon } from "../shared/types";
import type { ViewModel } from "./view-model";
export const name = (p: Pokemon) =>
  p.nickname && p.nickname !== p.name ? `${p.nickname} · ${p.name}` : p.name;
export const when = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Never";
export const age = (d: string | null | undefined) => {
  if (!d) return "No sync yet";
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(d)) / 60000));
  return m < 1
    ? "Just now"
    : m < 60
      ? `${m}m ago`
      : m < 1440
        ? `${Math.floor(m / 60)}h ago`
        : `${Math.floor(m / 1440)}d ago`;
};
export const types = (ts: readonly string[]) =>
  (ts || []).map((t) => `<span class="type ${esc(t.toLowerCase())}">${esc(t)}</span>`).join("");
export const opts = (arr: readonly string[], current: string) =>
  arr
    .map((a) => `<option value="${esc(a)}" ${a === current ? "selected" : ""}>${esc(a)}</option>`)
    .join("");
export function head(kicker: string, title: string, description: string, action = "") {
  return `<div class="lead">
      <div>
      <div class="eyebrow">${kicker}</div>
      <h1>${title}</h1>
      <p>${description}</p>
      </div>${action}</div>`;
}
export function blank() {
  return `<div class="empty">
      <div class="eyebrow">Your next adventure starts here</div>
      <h2>No save yet.</h2>
      <p>Pair your Retroid for automatic snapshots, or import a cartridge save.<br>Your game files are never modified.</p>
      <a class="button" href="#settings">Connect your Retroid →</a>
      </div>`;
}
export function portrait(p: { dexId: number | null }, extra = "") {
  return p.dexId !== null && Number.isInteger(p.dexId) && p.dexId > 0 && p.dexId <= 1025
    ? `<img class="sprite ${extra}" src="/sprites/${p.dexId}.png" alt="" width="96" height="96" loading="lazy">`
    : `<span class="unknown-mon" aria-hidden="true">?</span>`;
}
export function card(p: Pokemon, model: ViewModel, actions = true) {
  const { selected, state } = model;
  const isSelected = selected.includes(p.id),
    fav = state.context.favorites.includes(p.id);
  const hp =
    p.hp && Number.isFinite(p.hp.current) && p.hp.max > 0
      ? Math.max(0, Math.min(100, (100 * p.hp.current) / p.hp.max))
      : null;
  return `<article class="mon ${isSelected ? "selected" : ""}" data-type="${esc(p.types?.[0]?.toLowerCase() || "normal")}">
      <div class="mon-top">
      <span class="avatar" aria-hidden="true">${portrait(p)}</span>
      <div>
      <small class="mon-location">${p.location.kind === "party" ? "IN YOUR PARTY" : "BOX " + p.location.box}</small>
      <h3>${esc(p.nickname || p.name)}${fav ? ' <span class="gold">★</span>' : ""}</h3>
      <small>${esc(p.nickname !== p.name ? p.name + " · " : "")}Lv. ${p.level}</small>
      </div>
      </div>
      <div class="types">${types(p.types)}</div>${
        hp !== null
          ? `<div class="hp-line">
      <b>HP</b>
      <span class="hp-track">
      <span style="width:${hp}%;background:${hp < 20 ? "#c74544" : hp < 50 ? "#c18a25" : "#418761"}">
      </span>
      </span>
      <small>${p.hp?.current} / ${p.hp?.max}</small>
      </div>`
          : ""
      }<p>${esc(p.ability)} · ${esc(!p.item || p.item === "None" ? "No held item" : p.item)}</p>
      <div class="mon-actions">
      <button class="quiet" data-action="detail" data-id="${esc(p.id)}">Summary</button>${actions ? `<button class="${isSelected ? "quiet" : ""}" data-action="select" data-id="${esc(p.id)}" aria-pressed="${isSelected}">${isSelected ? "− Bench" : "+ Plan"}</button>` : ""}</div>
      </article>`;
}
