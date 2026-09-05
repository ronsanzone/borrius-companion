import { Schema } from "effect";
import { getCatalog } from "../parser/index.js";
import { SnapshotSchema } from "../shared/types.js";
import { HttpError, json, now, readJson } from "./http.js";
import { hashText, randomToken, rateLimit, requireOrigin } from "./security.js";
import { first } from "./storage.js";
import { cleanText, NoteRequest } from "./schemas.js";
import { ingest } from "./ingest.js";
import { readState } from "./state.js";
import { saveContext, savePlan } from "./planning.js";

export async function browserRoutes(request: Request, env: Env, url: URL): Promise<Response> {
  const route = url.pathname;
  const method = request.method;
  if (!["GET", "HEAD"].includes(method)) requireOrigin(request);
  if (route === "/api/state" && method === "GET") return json(await readState(env));
  if (route === "/api/catalog" && method === "GET") return json(getCatalog());
  if (route === "/api/import" && method === "POST") return ingest(request, env, "browser");
  if (route === "/api/pairings" && method === "POST") {
    await rateLimit(env, "owner-pair", 10, 600);
    const raw = randomToken().slice(0, 12).toUpperCase();
    const expiresAt = new Date(Date.now() + 600000).toISOString();
    await env.DB.prepare("INSERT INTO pairings(code_hash,expires_at,created_at) VALUES (?,?,?)")
      .bind(await hashText(raw), expiresAt, now())
      .run();
    return json({
      code: `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`,
      expiresAt,
      uploadUrl: env.UPLOAD_ORIGIN,
    });
  }
  const snapshot = route.match(/^\/api\/snapshots\/([\w-]+)$/);
  if (snapshot && method === "GET") {
    const row = await first(
      env.DB.prepare("SELECT parsed_json,status,error FROM snapshots WHERE id=?").bind(snapshot[1]),
      Schema.Struct({
        parsed_json: Schema.NullOr(Schema.String),
        status: Schema.String,
        error: Schema.NullOr(Schema.String),
      }),
    );
    if (!row) throw new HttpError({ status: 404, message: "Snapshot not found" });
    if (!row.parsed_json)
      throw new HttpError({ status: 409, message: row.error || "Snapshot is still processing" });
    return json(Schema.decodeUnknownSync(Schema.parseJson(SnapshotSchema))(row.parsed_json));
  }
  if (route === "/api/context" && method === "PUT") return saveContext(request, env);
  if (route === "/api/plans" && method === "POST") return savePlan(request, env);
  const plan = route.match(/^\/api\/plans\/([\w-]+)$/);
  if (plan && method === "DELETE") {
    await env.DB.prepare("DELETE FROM plans WHERE id=?").bind(plan[1]).run();
    return json({ ok: true });
  }
  if (route === "/api/notes" && method === "POST") {
    const body = await readJson(request, NoteRequest);
    const content = cleanText(body.text, 2000);
    if (!content) throw new HttpError({ status: 400, message: "Write a short note" });
    const note = {
      id: crypto.randomUUID(),
      text: content,
      snapshotId: cleanText(body.snapshotId ?? "", 80) || null,
      createdAt: now(),
    };
    await env.DB.prepare("INSERT INTO notes(id,text,snapshot_id,created_at) VALUES (?,?,?,?)")
      .bind(note.id, note.text, note.snapshotId, note.createdAt)
      .run();
    return json(note);
  }
  const revoke = route.match(/^\/api\/devices\/([\w-]+)\/revoke$/);
  if (revoke && method === "POST") {
    await env.DB.prepare("UPDATE devices SET revoked_at=? WHERE id=?").bind(now(), revoke[1]).run();
    return json({ ok: true });
  }
  throw new HttpError({ status: 404, message: "Not found" });
}
