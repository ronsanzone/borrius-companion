import { Data, Effect } from "effect";
import { parseSave } from "../parser/index.js";
import type { Snapshot } from "../shared/types.js";
import { now } from "./http.js";
import { all, first, IdRow, SnapshotRow } from "./storage.js";
import { refreshEvents } from "./events.js";

class InvalidSave extends Data.TaggedError("InvalidSave")<{ cause: unknown }> {}

async function parseSnapshot(env: Env, row: SnapshotRow): Promise<void> {
  const raw = await env.SAVES.get(`raw/${row.hash}`);
  if (!raw) throw new Error("Snapshot bytes unavailable");
  const bytes = new Uint8Array(await raw.arrayBuffer());
  // Invalid cartridge bytes are permanent failures. Storage failures remain retryable.
  const result = await Effect.try({
    try: () => parseSave(bytes, { gameVersion: row.game_version }),
    catch: (cause) => new InvalidSave({ cause }),
  }).pipe(Effect.either, Effect.runPromise);
  if (result._tag === "Left") {
    const cause = result.left.cause;
    const reason = cause instanceof Error ? cause.message.slice(0, 180) : "Unknown save format";
    await env.DB.prepare("UPDATE snapshots SET status='failed',error=?,lease_until=NULL WHERE id=?")
      .bind(`Save could not be validated: ${reason}`, row.id)
      .run();
    return;
  }
  const current: Snapshot = {
    ...result.right,
    id: row.id,
    capturedAt: row.captured_at,
    receivedAt: row.received_at,
    hash: row.hash,
    filename: row.filename,
  };
  const summary = {
    id: row.id,
    capturedAt: row.captured_at,
    receivedAt: row.received_at,
    status: "ready",
    partyNames: current.party.map((pokemon) => pokemon.name),
    boxCount: current.boxes.reduce((count, box) => count + box.pokemon.length, 0),
  };
  await env.DB.prepare(
    "UPDATE snapshots SET status='ready',parsed_json=?,summary_json=?,error=NULL,lease_until=NULL WHERE id=?",
  )
    .bind(JSON.stringify(current), JSON.stringify(summary), row.id)
    .run();
  await refreshEvents(env, row.id);
  const next = await first(
    env.DB.prepare(
      "SELECT id FROM snapshots WHERE status='ready' AND device_id=? AND device_sequence>? ORDER BY device_sequence LIMIT 1",
    ).bind(row.device_id, row.device_sequence),
    IdRow,
  );
  if (next) await refreshEvents(env, next.id);
  console.log(
    JSON.stringify({
      event: "snapshot.ready",
      id: row.id,
      party: current.party.length,
      boxes: summary.boxCount,
    }),
  );
}

export async function processSnapshot(env: Env, id: string): Promise<void> {
  const lease = new Date(Date.now() + 120000).toISOString();
  const row = await first(
    env.DB.prepare(
      "UPDATE snapshots SET status='processing',lease_until=?,attempts=attempts+1 WHERE id=? AND (status='pending' OR (status='processing' AND lease_until<?)) RETURNING *",
    ).bind(lease, id, now()),
    SnapshotRow,
  );
  if (!row) return;
  try {
    await parseSnapshot(env, row);
  } catch (error) {
    await env.DB.prepare(
      "UPDATE snapshots SET status='pending',lease_until=NULL,error=? WHERE id=?",
    )
      .bind("Processing interrupted; retry pending", id)
      .run();
    console.error(JSON.stringify({ event: "snapshot.retry", id }));
    throw error;
  }
}

export async function reconcile(env: Env): Promise<void> {
  const rows = await all(
    env.DB.prepare(
      "SELECT id FROM snapshots WHERE status='pending' OR (status='processing' AND lease_until<?) ORDER BY received_at LIMIT 30",
    ).bind(now()),
    IdRow,
  );
  for (const row of rows) {
    try {
      await env.INGEST.send({ id: row.id });
    } catch {
      console.error(JSON.stringify({ event: "queue.reconcile_failed", id: row.id }));
    }
  }
  await env.DB.batch([
    env.DB.prepare("DELETE FROM request_limits WHERE expires_at<?").bind(
      Math.floor(Date.now() / 1000),
    ),
    env.DB.prepare("DELETE FROM pairings WHERE expires_at<?").bind(now()),
  ]);
}
