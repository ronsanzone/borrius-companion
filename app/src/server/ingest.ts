import { HttpError, json, now, readBody } from "./http.js";
import { hash, rateLimit } from "./security.js";
import { first, CaptureRow } from "./storage.js";
import { cleanText, idPattern } from "./schemas.js";

export async function ingest(request: Request, env: Env, deviceId: string) {
  await rateLimit(env, "upload:" + deviceId, 30);
  const bytes = await readBody(request, 131072);
  if (bytes.length !== 131072)
    throw new HttpError({
      status: 400,
      message: "Choose a 128 KiB Unbound cartridge save (.srm or .sav), not a save state",
    });
  const version = request.headers.get("x-game-version");
  if (version !== "2.1.1.1")
    throw new HttpError({ status: 400, message: "Select supported Unbound version 2.1.1.1" });
  const captureId = request.headers.get("x-capture-id") || crypto.randomUUID();
  if (!idPattern.test(captureId))
    throw new HttpError({ status: 400, message: "Invalid capture identifier" });
  const sequence = Number(request.headers.get("x-device-sequence") || Date.now());
  if (!Number.isSafeInteger(sequence) || sequence < 0)
    throw new HttpError({ status: 400, message: "Invalid capture sequence" });
  const supplied = request.headers.get("x-captured-at");
  const captured = supplied ? new Date(supplied) : new Date();
  if (!Number.isFinite(captured.getTime()))
    throw new HttpError({ status: 400, message: "Invalid capture time" });
  let filename = "Unbound.srm";
  try {
    filename = cleanText(
      decodeURIComponent(request.headers.get("x-save-name") || "Unbound.srm"),
      180,
    );
  } catch {
    throw new HttpError({ status: 400, message: "Invalid save name" });
  }
  const digest = await hash(bytes);
  let existing = await first(
    env.DB.prepare(
      "SELECT id,status,hash,device_sequence FROM snapshots WHERE device_id=? AND capture_id=?",
    ).bind(deviceId, captureId),
    CaptureRow,
  );
  if (existing) {
    if (existing.hash !== digest || existing.device_sequence !== sequence)
      throw new HttpError({
        status: 409,
        message: "Capture identifier already used for different data",
      });
    return json({
      id: existing.id,
      status: existing.status === "processing" ? "pending" : existing.status,
      duplicate: true,
    });
  }
  // Only raw copies enter object storage; the device original is never written.
  await env.SAVES.put(`raw/${digest}`, bytes, {
    httpMetadata: { contentType: "application/octet-stream" },
  });
  const id = crypto.randomUUID();
  const received = now();
  await env.DB.prepare(
    "INSERT OR IGNORE INTO snapshots(id,device_id,capture_id,device_sequence,captured_at,received_at,hash,filename,game_version) VALUES (?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      id,
      deviceId,
      captureId,
      sequence,
      captured.toISOString(),
      received,
      digest,
      filename,
      version,
    )
    .run();
  existing = await first(
    env.DB.prepare(
      "SELECT id,status,hash,device_sequence FROM snapshots WHERE device_id=? AND capture_id=?",
    ).bind(deviceId, captureId),
    CaptureRow,
  );
  if (!existing) throw new Error("Snapshot insertion returned no row");
  if (existing.hash !== digest || existing.device_sequence !== sequence)
    throw new HttpError({
      status: 409,
      message: "Capture identifier already used for different data",
    });
  if (deviceId !== "browser")
    await env.DB.prepare("UPDATE devices SET last_seen_at=? WHERE id=?")
      .bind(received, deviceId)
      .run();
  try {
    await env.INGEST.send({ id: existing.id });
  } catch {
    console.error(JSON.stringify({ event: "queue.pending", id: existing.id }));
  }
  return json(
    {
      id: existing.id,
      status: existing.status === "processing" ? "pending" : existing.status,
      duplicate: existing.id !== id,
    },
    202,
  );
}
