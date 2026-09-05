import type { ViewModel } from "../view-model";
import type { Snapshot } from "../../shared/types";
import { esc } from "../dom";
import { head } from "../components";
import { name } from "../components";
import { when } from "../components";
export function renderJournal(model: ViewModel): string {
  const { state, compare } = model;
  function diff(a: Snapshot, b: Snapshot) {
    const old = [...b.party, ...b.boxes.flatMap((x) => x.pokemon)],
      current = [...a.party, ...a.boxes.flatMap((x) => x.pokemon)],
      lines = [];
    for (const p of current) {
      const prev = old.find((x) => x.id === p.id);
      if (!prev)
        lines.push(
          `${name(p)} is present in the selected snapshot and absent from the comparison snapshot.`,
        );
      else {
        if (p.level !== prev.level) lines.push(`${name(p)}: level ${prev.level} → ${p.level}.`);
        if (p.moves.map((m) => m.id).join() !== prev.moves.map((m) => m.id).join())
          lines.push(`${name(p)}: moves changed to ${p.moves.map((m) => m.name).join(", ")}.`);
        if (p.item !== prev.item)
          lines.push(`${name(p)}: item ${prev.item || "none"} → ${p.item || "none"}.`);
      }
    }
    for (const p of old)
      if (!current.some((x) => x.id === p.id))
        lines.push(`${name(p)} is absent from the selected snapshot.`);
    return lines;
  }
  function journey() {
    return (
      head(
        "Every save is a stepping stone",
        "Your adventure journal",
        "A record of observed snapshots and the notes you leave along the way.",
      ) +
      `<div class="grid split">
      <section>
      <div class="panel">
      <h2>Snapshot archive</h2>${
        state.snapshots
          .map(
            (s) => `<div class="list-item">
      <div>
      <strong>${when(s.capturedAt)}</strong> <span class="pill">${esc(s.status)}</span>
      <p>${esc((s.partyNames || []).join(", "))}</p>${s.error ? `<p class="gold">${esc(s.error)}</p>` : ""}</div>${s.status === "ready" ? `<button class="quiet" data-action="compare" data-id="${esc(s.id)}">Compare</button>` : ""}</div>`,
          )
          .join("") || "<p>Your first upload will appear here.</p>"
      }</div>${
        compare
          ? `<section class="panel">
      <h2>Latest snapshot vs. ${when(compare.capturedAt)}</h2>
      <p>Identity matching is provisional. Differences describe the save contents, not necessarily catches, releases, or a chronological play session.</p>${
        (state.snapshot ? diff(state.snapshot, compare) : [])
          .map((l) => `<div class="insight">${esc(l)}</div>`)
          .join("") || "<p>No level, item, move, or collection differences found.</p>"
      }</section>`
          : ""
      }<div class="panel">
      <h2>Observed changes</h2>
      <div class="timeline">${
        state.events
          .map(
            (e) => `<article>
      <small>${when(e.createdAt)}</small>
      <p>${esc(e.text)}</p>
      </article>`,
          )
          .join("") || "<p>Changes between processed snapshots will appear here.</p>"
      }</div>
      </div>
      </section>
      <section class="panel">
      <h2>Leave yourself a note</h2>
      <form id="note-form">
      <label>What should you remember?<textarea name="text" required maxlength="2000" placeholder="Next session: explore that route, try this lead…">
      </textarea>
      </label>
      <button style="margin-top:12px">Save note</button>
      </form>${state.notes
        .map(
          (n) => `<div class="insight">
      <small>${when(n.createdAt)}</small>
      <p style="white-space:pre-wrap">${esc(n.text)}</p>
      </div>`,
        )
        .join("")}</section>
      </div>`
    );
  }

  return journey();
}
