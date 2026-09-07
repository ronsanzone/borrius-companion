import { esc } from "../dom";
import { evolutionLabel } from "./dex";
import { moveSections } from "./dex-data";
import type { Dex, DexSpecies } from "./dex-data";
import type { Pokemon } from "../../shared/types";
export function speciesDetail(data: Dex, s: DexSpecies, owned: readonly Pokemon[]): string {
  const badges = (types: readonly string[]) =>
    types
      .map((t) => `<span class="dex-type" data-type="${esc(t.toLowerCase())}">${esc(t)}</span>`)
      .join("");
  const sprite = (s: DexSpecies) =>
    `<img class="dex-sprite" src="/sprites/${s.dexId}.png" alt="" loading="lazy">`;
  function moveTable(rows: readonly { moveId: number; label: string }[]) {
    return `<div class="dex-move-scroll">
      <table>
      <thead>
      <tr>
      <th>Learn</th>
      <th>Move</th>
      <th>Type</th>
      <th>Category</th>
      <th>Power</th>
      <th>Accuracy</th>
      </tr>
      </thead>
      <tbody>${rows
        .map(({ moveId, label }) => {
          const m = data.moves[moveId];
          return m
            ? `<tr>
      <td>${esc(label)}</td>
      <th scope="row">${esc(m.name)}</th>
      <td>${badges([m.type || "Unknown"])}</td>
      <td>${esc(m.category || "Unknown")}</td>
      <td>${m.power ?? "—"}</td>
      <td>${m.accuracy == null ? "—" : m.accuracy + "%"}</td>
      </tr>`
            : "";
        })
        .join("")}</tbody>
      </table>
      </div>`;
  }
  function detail() {
    const back = data.species.filter((p) => p.evolutions.some((e) => e.target === s.speciesId));
    return `<div class="dex-species-head">${sprite(s)}<div>
      <small>No. ${s.dexId} · ${owned.filter((p) => p.speciesId === s.speciesId).length} owned</small>
      <h2>${esc(s.name)}</h2>${badges(s.types)}</div>
      </div>
      <h3>Base stats</h3>
      <div class="dex-stats">${["HP", "Attack", "Defense", "Sp. Atk", "Sp. Def", "Speed"]
        .map(
          (label, i) => `<div>
      <span>${label}</span>
      <meter min="0" max="255" value="${s.baseStats[i]}">${s.baseStats[i]}</meter>
      <b>${s.baseStats[i]}</b>
      </div>`,
        )
        .join("")}</div>
      <small>Total ${s.baseStats.reduce((a, b) => a + b, 0)} · species base stats, not your individual Pokémon’s stats</small>
      <h3>Abilities</h3>
      <p>${s.abilities.map(esc).join(" · ")}${
        s.hiddenAbility
          ? `<br>
      <small>Hidden: ${esc(s.hiddenAbility)}</small>`
          : ""
      }</p>
      <h3>Evolution reference</h3>${back
        .map(
          (p) =>
            `<p>From <button class="dex-inline" data-species="${p.speciesId}">${esc(p.name)}</button> · ${p.evolutions
              .filter((e) => e.target === s.speciesId)
              .map((e) => esc(evolutionLabel(e)))
              .join(" / ")}</p>`,
        )
        .join("")}${s.evolutions
        .map((e) => {
          const target = data.species.find((p) => p.speciesId === e.target);
          return target
            ? `<p>
      <button class="dex-inline" data-species="${target.speciesId}">${esc(target.name)}</button> · ${esc(evolutionLabel(e))}</p>`
            : "";
        })
        .join(
          "",
        )}${!s.evolutions.length && !back.length ? "<p>No regular evolution recorded in this reference.</p>" : ""}<h3>Learnset reference</h3>
      <p class="dex-note">These are potential moves, not moves your Pokémon currently knows. TM/HM and tutor compatibility does not mean you own the item or have reached its location.</p>
      <details>
      <summary>Level-up (${s.learnset.length})</summary>${moveTable(s.learnset.map((m) => ({ ...m, label: m.level === 0 ? "Evolution" : `Lv. ${m.level}` })))}</details>${moveSections
        .map(
          ([key, label]) =>
            `<details>
      <summary>${label} (${s[key]?.length || 0})</summary>${s[key]?.length ? moveTable(s[key].map((moveId) => ({ moveId, label }))) : "<p>No moves recorded.</p>"}</details>`,
        )
        .join(
          "",
        )}<p class="dex-note">Move power and accuracy use the verified 2.1.1.1 move table; variable values show —. Type, ability and learnset interactions are not damage simulations.</p>
      <a href="https://ydarissep.github.io/Unbound-Pokedex/?species=${encodeURIComponent(s.symbol || "SPECIES_" + s.name.toUpperCase())}" target="_blank" rel="noopener noreferrer">Open ${esc(s.name)} in Yda Dex ↗</a>`;
  }

  return detail();
}
