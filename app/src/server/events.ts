import { Schema } from "effect";
import { SnapshotSchema, type Snapshot } from "../shared/types.js";
import { first, SnapshotRow, ParsedRow } from "./storage.js";

export interface Change {
  kind: "import" | "roster" | "build" | "party" | "progress";
  text: string;
}
export function changes(previous: Snapshot | null, current: Snapshot): Change[] {
  if (!previous)
    return [
      {
        kind: "import",
        text: `Snapshot recorded: ${current.party.length} party Pokémon and ${current.boxes.reduce((s, b) => s + b.pokemon.length, 0)} boxed Pokémon.`,
      },
    ];
  const out: Change[] = [];
  const flatten = (s: Snapshot) => [...s.party, ...s.boxes.flatMap((b) => b.pokemon)];
  const old = new Map(
    flatten(previous)
      .filter((p) => p.identityConfidence !== "ambiguous")
      .map((p) => [p.id, p]),
  );
  for (const mon of flatten(current)) {
    if (mon.identityConfidence === "ambiguous") continue;
    const before = old.get(mon.id);
    if (!before) {
      out.push({
        kind: "roster",
        text: `${mon.nickname || mon.name} (${mon.name}) was first observed in this snapshot.`,
      });
      continue;
    }
    const details = [];
    if (before.level !== mon.level) details.push(`level ${before.level} → ${mon.level}`);
    if (before.name !== mon.name) details.push(`${before.name} → ${mon.name}`);
    if (
      JSON.stringify(before.moves.map((m) => m.id)) !== JSON.stringify(mon.moves.map((m) => m.id))
    )
      details.push("moves changed");
    if (before.item !== mon.item) details.push(`held item ${before.item} → ${mon.item}`);
    if (details.length)
      out.push({ kind: "build", text: `${mon.nickname || mon.name}: ${details.join("; ")}.` });
  }
  if (previous.party.map((p) => p.id).join(",") !== current.party.map((p) => p.id).join(","))
    out.push({ kind: "party", text: "The saved party or its order changed." });
  if (
    previous.progress.badges !== null &&
    current.progress.badges !== null &&
    previous.progress.badges !== current.progress.badges
  )
    out.push({
      kind: "progress",
      text: `Experimental badge reading changed from ${previous.progress.badges} to ${current.progress.badges}; confirm in game.`,
    });
  return out.slice(0, 100);
}

export async function refreshEvents(env: Env, id: string): Promise<void> {
  const row = await first(
    env.DB.prepare("SELECT * FROM snapshots WHERE id=? AND status='ready'").bind(id),
    SnapshotRow,
  );
  if (!row || !row.parsed_json) return;
  const previous = await first(
    env.DB.prepare(
      "SELECT parsed_json FROM snapshots WHERE status='ready' AND device_id=? AND device_sequence<? ORDER BY device_sequence DESC LIMIT 1",
    ).bind(row.device_id, row.device_sequence),
    ParsedRow,
  );
  const decode = Schema.decodeUnknownSync(Schema.parseJson(SnapshotSchema));
  const events = changes(previous ? decode(previous.parsed_json) : null, decode(row.parsed_json));
  const writes = [env.DB.prepare("DELETE FROM events WHERE snapshot_id=?").bind(id)];
  for (const [index, event] of events.entries()) {
    writes.push(
      env.DB.prepare(
        "INSERT INTO events(id,snapshot_id,kind,text,created_at) VALUES (?,?,?,?,?)",
      ).bind(`${id}:${index}`, id, event.kind, event.text, row.captured_at),
    );
  }
  await env.DB.batch(writes);
}
