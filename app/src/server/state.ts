import { Schema } from "effect";
import { all, first, JsonDataRow, ParsedRow } from "./storage.js";
import {
  SnapshotSchema,
  PlanSchema,
  TrainerContextSchema,
  SnapshotSummarySchema,
} from "../shared/types.js";

export const DEFAULT_CONTEXT = {
  difficulty: "unknown",
  levelCap: null,
  checkpoint: "",
  spoilerMode: "hints",
  favorites: [],
};
const decodePlan = Schema.decodeUnknownSync(Schema.parseJson(PlanSchema));
const decodeContext = Schema.decodeUnknownSync(Schema.parseJson(TrainerContextSchema));
const decodeSummary = Schema.decodeUnknownSync(Schema.parseJson(SnapshotSummarySchema));
const SummaryRow = Schema.Struct({
  id: Schema.String,
  captured_at: Schema.String,
  received_at: Schema.String,
  status: Schema.String,
  summary_json: Schema.NullOr(Schema.String),
  error: Schema.NullOr(Schema.String),
});
const DeviceView = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
  lastSeenAt: Schema.NullOr(Schema.String),
  revokedAt: Schema.NullOr(Schema.String),
});
const EventView = Schema.Struct({
  id: Schema.String,
  snapshotId: Schema.String,
  kind: Schema.String,
  text: Schema.String,
  createdAt: Schema.String,
});
const NoteView = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  snapshotId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
});

export async function readState(env: Env) {
  // Arrival order across devices; sequence order within each device. Late uploads cannot rewind the current snapshot.
  const latest = await first(
    env.DB.prepare(
      "SELECT s.parsed_json FROM snapshots s WHERE s.status='ready' AND NOT EXISTS (SELECT 1 FROM snapshots n WHERE n.device_id=s.device_id AND n.status='ready' AND n.device_sequence>s.device_sequence) ORDER BY s.received_at DESC,s.device_sequence DESC LIMIT 1",
    ),
    ParsedRow,
  );
  const [snapshots, devices, plans, settings, events, notes] = await Promise.all([
    all(
      env.DB.prepare(
        "SELECT id,captured_at,received_at,status,summary_json,error FROM snapshots ORDER BY received_at DESC LIMIT 100",
      ),
      SummaryRow,
    ),
    all(
      env.DB.prepare(
        "SELECT id,name,created_at AS createdAt,last_seen_at AS lastSeenAt,revoked_at AS revokedAt FROM devices ORDER BY created_at DESC",
      ),
      DeviceView,
    ),
    all(env.DB.prepare("SELECT data FROM plans ORDER BY updated_at DESC"), JsonDataRow),
    first(env.DB.prepare("SELECT data FROM settings WHERE id='context'"), JsonDataRow),
    all(
      env.DB.prepare(
        "SELECT id,snapshot_id AS snapshotId,kind,text,created_at AS createdAt FROM events ORDER BY created_at DESC LIMIT 150",
      ),
      EventView,
    ),
    all(
      env.DB.prepare(
        "SELECT id,text,snapshot_id AS snapshotId,created_at AS createdAt FROM notes ORDER BY created_at DESC LIMIT 100",
      ),
      NoteView,
    ),
  ]);
  return {
    snapshot: latest
      ? Schema.decodeUnknownSync(Schema.parseJson(SnapshotSchema))(latest.parsed_json)
      : null,
    snapshots: snapshots.map((snapshot) =>
      snapshot.summary_json
        ? decodeSummary(snapshot.summary_json)
        : {
            id: snapshot.id,
            capturedAt: snapshot.captured_at,
            receivedAt: snapshot.received_at,
            status: snapshot.status === "processing" ? "pending" : snapshot.status,
            error: snapshot.error,
            partyNames: [],
            boxCount: 0,
          },
    ),
    devices,
    plans: plans.map((plan) => decodePlan(plan.data)),
    context: settings ? decodeContext(settings.data) : DEFAULT_CONTEXT,
    events,
    notes,
  };
}
