import type { ViewModel } from "../view-model";
import { esc } from "../dom";
import { head } from "../components";
import { when } from "../components";
import { opts } from "../components";
export function renderSettings(model: ViewModel): string {
  const { state, pair } = model;
  function settings() {
    const c = state.context;
    return (
      head(
        "Quietly connected",
        "Keep your Pokédex in touch",
        "Link your Retroid, set your context, and let snapshots find their way home.",
      ) +
      `<div class="grid split">
      <section>
      <div class="panel">
      <h2>Connect your Retroid</h2>
      <p>Generate a one-time code, then enter it in the Borrius save courier on your Retroid. The device receives an upload-only credential. It cannot change your game.</p>
      <button data-action="pair">Generate pairing code</button>${
        pair
          ? `<div class="pair-code">${esc(pair.code)}</div>
      <p>Expires ${when(pair.expiresAt)}. Enter this server address in the courier:</p>
      <input aria-label="Upload server address" readonly value="${esc(pair.uploadUrl)}" style="width:100%">`
          : ""
      }<h3 style="margin-top:26px">Linked devices</h3>${
        state.devices
          .map(
            (d) => `<div class="list-item">
      <div>
      <strong>${esc(d.name)}</strong>
      <p>${d.revokedAt ? "Revoked " + when(d.revokedAt) : "Last seen " + when(d.lastSeenAt)}</p>
      </div>${!d.revokedAt ? `<button class="danger" data-action="revoke" data-id="${esc(d.id)}">Revoke</button>` : ""}</div>`,
          )
          .join("") || "<p>No devices paired yet.</p>"
      }<p>
      <small>Android periodic sync is best-effort and can be delayed. Save in-game before syncing. Emulator save states are not imported.</small>
      </p>
      </div>
      <div class="panel">
      <h2>Import a save</h2>
      <p>Upload a copy of your cartridge save. The original file remains unchanged.</p>
      <form id="import-form">
      <label>Game version<select name="version">
      <option>2.1.1.1</option>
      </select>
      </label>
      <label style="margin:15px 0">Cartridge save (.srm or .sav)<input type="file" name="save" accept=".srm,.sav" required>
      </label>
      <button>Import snapshot</button>
      </form>
      </div>
      </section>
      <section class="panel">
      <h2>Playthrough context</h2>
      <p>These settings are confirmed by you. Difficulty, exact location and level cap are not reliably detected from the save.</p>
      <form id="context-form" class="grid form-grid">
      <label>Difficulty<select name="difficulty">${opts(["unknown", "Vanilla", "Difficult", "Expert", "Insane"], c.difficulty)}</select>
      </label>
      <label>Confirmed level cap<input name="levelCap" type="number" min="1" max="100" value="${esc(c.levelCap ?? "")}" placeholder="Unknown">
      </label>
      <label style="grid-column:1/-1">Current objective / checkpoint<input name="checkpoint" maxlength="200" value="${esc(c.checkpoint)}" placeholder="Where are you headed next?">
      </label>
      <label style="grid-column:1/-1">Spoilers<select name="spoilerMode">
      <option value="hints" ${c.spoilerMode === "hints" ? "selected" : ""}>Hints — hide future boss details</option>
      <option value="full" ${c.spoilerMode === "full" ? "selected" : ""}>Full — default to detailed battle scouting</option>
      </select>
      </label>
      <button>Save context</button>
      </form>
      </section>
      </div>`
    );
  }

  return settings();
}
