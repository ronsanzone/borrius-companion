import { Schema } from "effect";
import { HttpError, json, now, readJson } from "./http.js";
import { hashText, randomToken, rateLimit, requireDevice } from "./security.js";
import { first, ReceiptRow } from "./storage.js";
import { cleanText, PairRequest } from "./schemas.js";
import { ingest } from "./ingest.js";

export async function deviceRoutes(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/device/pair" && request.method === "POST") {
    await rateLimit(env, `pair:${request.headers.get("cf-connecting-ip")}`, 10, 600);
    const body = await readJson(request, PairRequest);
    const code = cleanText(body.code, 80).toUpperCase().replace(/[-\s]/g, "");
    if (!/^[A-F0-9]{12}$/.test(code))
      throw new HttpError({ status: 400, message: "Pairing code is invalid or expired" });
    const claimed = await first(
      env.DB.prepare(
        "UPDATE pairings SET claimed_at=? WHERE code_hash=? AND expires_at>? AND claimed_at IS NULL RETURNING code_hash",
      ).bind(now(), await hashText(code), now()),
      Schema.Struct({ code_hash: Schema.String }),
    );
    if (!claimed)
      throw new HttpError({ status: 400, message: "Pairing code is invalid or expired" });
    const token = randomToken();
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO devices(id,name,token_hash,created_at) VALUES (?,?,?,?)")
      .bind(id, cleanText(body.name, 80) || "Retroid Classic", await hashText(token), now())
      .run();
    return json({ deviceId: id, token, uploadUrl: env.UPLOAD_ORIGIN });
  }
  const device = await requireDevice(request, env);
  if (url.pathname === "/api/device/upload" && request.method === "POST")
    return ingest(request, env, device.id);
  const receipt = url.pathname.match(/^\/api\/device\/receipts\/([a-zA-Z0-9_-]+)$/);
  if (receipt && request.method === "GET") {
    await rateLimit(env, `receipt:${device.id}`, 120);
    const row = await first(
      env.DB.prepare("SELECT id,status,error FROM snapshots WHERE id=? AND device_id=?").bind(
        receipt[1],
        device.id,
      ),
      ReceiptRow,
    );
    if (!row) throw new HttpError({ status: 404, message: "Receipt not found" });
    return json({ ...row, status: row.status === "processing" ? "pending" : row.status });
  }
  throw new HttpError({ status: 404, message: "Not found" });
}
