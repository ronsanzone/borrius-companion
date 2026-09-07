import type { ViewModel } from "../view-model";
import { esc } from "../dom";
import { blank } from "../components";
import { portrait } from "../components";
import { card } from "../components";
import { when } from "../components";
import { opportunities } from "../../shared/domain";
export function renderCamp(model: ViewModel): string {
  const { state, owned } = model;
  function today() {
    const s = state.snapshot;
    const intro = `<section class="camp-hero">
      <div class="hero-copy">
      <div class="eyebrow">THE BORRIUS ADVENTURE</div>
      <h1>A good day for<br>another adventure.</h1>
      <p>${state.context.checkpoint ? `Up next: ${esc(state.context.checkpoint)}` : "Six companions. A whole region to explore.<br>Pick up your journey right where you left it."}</p>
      <a class="button" href="#dex">Let’s get ready <span aria-hidden="true">→</span>
      </a>
      </div>
      <div class="route-scene" aria-hidden="true">
      <span class="scene-sun">
      </span>
      <span class="cloud cloud-one">
      </span>
      <span class="cloud cloud-two">
      </span>
      <span class="hill hill-back">
      </span>
      <span class="hill hill-front">
      </span>
      <span class="route-path">
      </span>
      <span class="route-sign">BORRIUS ↗</span>
      <div class="scene-party">${
        s
          ? s.party
              .slice(0, 3)
              .map((p) => portrait(p))
              .join("")
          : '<span class="camp-ball"></span>'
      }</div>
      <span class="scene-caption">A LITTLE FURTHER, TOGETHER.</span>
      </div>
      </section>`;
    if (!s) return intro + blank();
    return (
      intro +
      (state.context.nextBattleId
        ? `<section class="panel next-fight-card">
      <div>
      <div class="eyebrow">YOUR NEXT BIG FIGHT</div>
      <h2>Your battle plan is ready to revisit.</h2>
      <p>${esc(state.context.difficulty)} · ${state.context.fightReveal === "full" ? "Full scouting" : state.context.fightReveal === "team" ? "Team preview" : "Typing hints"} · Selected by you</p>
      </div>
      <a class="button" href="#dex">Open matchup →</a>
      </section>`
        : "") +
      `${Date.now() - Date.parse(s.capturedAt) > 3600000 ? '<div class="banner">Your last save is over an hour old. Save in-game and sync your Retroid to catch up.</div>' : ""}<div class="section-head">
      <div>
      <div class="eyebrow">READY WHEN YOU ARE</div>
      <h2>Your traveling companions</h2>
      </div>
      <a class="text-link" href="#dex">Visit your Pokémon →</a>
      </div>
      <div class="grid roster party-roster">${s.party.map((p) => card(p, model, false)).join("")}</div>
      <section class="trainer-record">
      <div class="record-title">
      <span class="record-ball" aria-hidden="true">
      </span>
      <div class="eyebrow">TRAINER’S RECORD</div>
      </div>
      <div class="grid metrics">
      <div class="metric">
      <strong>${owned().length}</strong>
      <span>Pokémon in your save</span>
      </div>
      <div class="metric">
      <strong>${s.progress.badges ?? "—"}<small> / 8</small>
      </strong>
      <span>Badges · provisional</span>
      </div>
      <div class="metric">
      <strong>${esc(state.context.levelCap ?? "—")}</strong>
      <span>Your confirmed level cap</span>
      </div>
      <div class="metric">
      <strong>${s.progress.heartScales ?? "—"}</strong>
      <span>Heart Scales · provisional</span>
      </div>
      </div>
      </section>
      <div class="grid split field-pages">
      <section class="panel">
      <div class="eyebrow">BEFORE YOU SET OFF</div>
      <h2>A few things to remember</h2>${
        opportunities(s.party, state.context.levelCap)
          .slice(0, 6)
          .map((o) => `<div class="insight">${esc(o.text)}</div>`)
          .join("") || "<p>Your party has no immediate item, PP, or confirmed-cap reminders.</p>"
      }<small>Based on your last save. Check your bag and game before acting.</small>
      </section>
      <section class="panel journal-panel">
      <div class="eyebrow">FROM YOUR JOURNAL</div>
      <h2>Notes from the road</h2>${
        state.events
          .slice(0, 4)
          .map(
            (e) =>
              `<div class="insight">${esc(e.text)}<br>
      <small>${when(e.createdAt)}</small>
      </div>`,
          )
          .join("") || "<p>Your next save starts the next page.</p>"
      }<a class="text-link" href="#journey">Open your journal →</a>
      </section>
      </div>
      <section class="panel">
      <div class="section-head" style="margin-top:0">
      <h2>Inside your bag</h2>
      <span class="pill">Provisional save readings</span>
      </div>
      <div class="row">
      <span class="pill">Money · ${s.progress.money == null ? "Unknown" : Number(s.progress.money).toLocaleString()}</span>
      <span class="pill">Champion · ${s.progress.isChampion == null ? "Unknown" : s.progress.isChampion ? "Flag set" : "Flag not set"}</span>
      </div>
      <details>
      <summary>TM pocket (${s.progress.ownedTms.length} reported)</summary>
      <p>${s.progress.ownedTms.map(esc).join(", ") || "No TMs reported by this parser."}</p>
      </details>
      <p>Confirm these readings in-game. Set your location and next objective in Link.</p>${
        s.warnings.length
          ? `<details class="coverage-notes">
      <summary>About this save · ${s.warnings.length} reading notes</summary>${s.warnings.map((w) => `<p>${esc(w)}</p>`).join("")}</details>`
          : ""
      }</section>`
    );
  }

  return today();
}
