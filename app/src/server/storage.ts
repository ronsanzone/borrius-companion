import { Schema } from "effect";

/** D1's generic return type is not validation: decode persisted rows at the boundary. */
export async function first<A, I>(
  statement: D1PreparedStatement,
  schema: Schema.Schema<A, I>,
): Promise<A | null> {
  const row = await statement.first<unknown>();
  return row === null ? null : Schema.decodeUnknownSync(schema)(row);
}

export async function all<A, I>(
  statement: D1PreparedStatement,
  schema: Schema.Schema<A, I>,
): Promise<readonly A[]> {
  const result = await statement.all<unknown>();
  return Schema.decodeUnknownSync(Schema.Array(schema))(result.results);
}

export const IdRow = Schema.Struct({ id: Schema.String });
export const JsonDataRow = Schema.Struct({ data: Schema.String });
export const ParsedRow = Schema.Struct({ parsed_json: Schema.String });
export const ReceiptRow = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  error: Schema.NullOr(Schema.String),
});
export const CaptureRow = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  hash: Schema.String,
  device_sequence: Schema.Number,
});
export const SnapshotRow = Schema.Struct({
  id: Schema.String,
  device_id: Schema.String,
  device_sequence: Schema.Number,
  captured_at: Schema.String,
  received_at: Schema.String,
  hash: Schema.String,
  filename: Schema.String,
  game_version: Schema.String,
  parsed_json: Schema.NullOr(Schema.String),
});
export type SnapshotRow = Schema.Schema.Type<typeof SnapshotRow>;
