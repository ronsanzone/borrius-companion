import assert from "node:assert/strict";
import { Schema } from "effect";
import {
  StateSchema,
  PlanSchema,
  ContextSchema,
  PairingSchema,
} from "../../src/client/contracts.js";
import { SnapshotSchema } from "../../src/shared/types.js";

const DeviceSchema = Schema.Struct({ deviceId: Schema.String, token: Schema.String });
const UploadSchema = Schema.Struct({
  id: Schema.String,
  status: Schema.String,
  duplicate: Schema.Boolean,
});
const ReceiptSchema = Schema.Struct({ status: Schema.String });

/** Run only against local Wrangler storage, never a live playthrough. */
export async function exerciseSavePipeline(bytes: Uint8Array, origin = "http://127.0.0.1:8787") {
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
  async function send(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Origin", origin);
    return fetch(origin + path, { ...init, headers });
  }
  async function read<A, I>(path: string, schema: Schema.Schema<A, I>, init: RequestInit = {}) {
    const response = await send(path, init);
    assert.ok(
      response.ok,
      `${path}: ${response.status} ${response.ok ? "" : await response.text()}`,
    );
    return Schema.decodeUnknownSync(Schema.parseJson(schema))(await response.text());
  }
  const post = (body: string): RequestInit => ({
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
  const state = () => read("/api/state", StateSchema);
  const pairing = await read("/api/pairings", PairingSchema, post("{}"));
  const device = await read(
    "/api/device/pair",
    DeviceSchema,
    post(JSON.stringify({ code: pairing.code, name: "End-to-end Courier" })),
  );
  assert.equal(
    (await send("/api/device/pair", post(JSON.stringify({ code: pairing.code })))).status,
    400,
  );
  assert.equal(
    (await send("/api/device/upload", { method: "POST", body: new Uint8Array(bytes) })).status,
    401,
  );
  const headers = {
    Authorization: `Bearer ${device.token}`,
    "X-Capture-Id": crypto.randomUUID(),
    "X-Device-Sequence": "2",
    "X-Game-Version": "2.1.1.1",
    "Content-Type": "application/octet-stream",
  };
  const upload = (data: Uint8Array, captureHeaders = headers) =>
    read("/api/device/upload", UploadSchema, {
      method: "POST",
      body: new Uint8Array(data),
      headers: captureHeaders,
    });
  const waitFor = async (id: string) => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const receipt = await read(`/api/device/receipts/${id}`, ReceiptSchema, { headers });
      if (receipt.status !== "pending") return receipt.status;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Snapshot ${id} did not finish processing`);
  };
  const first = await upload(bytes);
  assert.equal((await upload(bytes)).duplicate, true);
  assert.equal(await waitFor(first.id), "ready");
  const snapshot = await read(`/api/snapshots/${first.id}`, SnapshotSchema);
  assert.ok(snapshot.party.length > 0);
  const corrupt = new Uint8Array(bytes);
  corrupt[0] ^= 1;
  assert.equal(
    (await send("/api/device/upload", { method: "POST", body: corrupt, headers })).status,
    409,
  );
  const invalid = await upload(corrupt, {
    ...headers,
    "X-Capture-Id": crypto.randomUUID(),
    "X-Device-Sequence": "3",
  });
  assert.equal(await waitFor(invalid.id), "failed");
  assert.equal((await state()).snapshot?.id, first.id);
  const late = await upload(bytes, {
    ...headers,
    "X-Capture-Id": crypto.randomUUID(),
    "X-Device-Sequence": "1",
  });
  assert.equal(await waitFor(late.id), "ready");
  assert.equal((await state()).snapshot?.id, first.id);
  const otherPairing = await read("/api/pairings", PairingSchema, post("{}"));
  const other = await read(
    "/api/device/pair",
    DeviceSchema,
    post(JSON.stringify({ code: otherPairing.code, name: "Isolation check" })),
  );
  assert.equal(
    (
      await send(`/api/device/receipts/${first.id}`, {
        headers: { Authorization: `Bearer ${other.token}` },
      })
    ).status,
    404,
  );
  await send(`/api/devices/${device.deviceId}/revoke`, post("{}"));
  assert.equal((await send(`/api/device/receipts/${first.id}`, { headers })).status, 401);
  await send(`/api/devices/${other.deviceId}/revoke`, post("{}"));
  const memberIds = snapshot.party.map((pokemon) => pokemon.id);
  const shortlistIds = [
    ...memberIds,
    ...snapshot.boxes
      .flatMap((box) => box.pokemon)
      .slice(0, 4)
      .map((pokemon) => pokemon.id),
  ];
  const plan = await read(
    "/api/plans",
    PlanSchema,
    post(
      JSON.stringify({
        name: "Integration team",
        memberIds,
        shortlistIds,
        inverse: false,
        weaknessLimit: 3,
        hardLimit: false,
      }),
    ),
  );
  assert.equal(
    (await state()).plans.find((candidate) => candidate.id === plan.id)?.shortlistIds?.length,
    shortlistIds.length,
  );
  assert.equal(
    (await send("/api/plans", post(JSON.stringify({ ...plan, shortlistIds: [] })))).status,
    400,
  );
  await send(`/api/plans/${plan.id}`, { method: "DELETE" });
  assert.equal(
    (await state()).plans.some((candidate) => candidate.id === plan.id),
    false,
  );
  assert.equal(
    (
      await fetch(origin + "/api/pairings", {
        method: "POST",
        headers: { Origin: "https://attacker.example" },
      })
    ).status,
    403,
  );
  const context = (await state()).context;
  const savedContext = await read("/api/context", ContextSchema, {
    ...post(
      JSON.stringify({
        ...context,
        difficulty: "Difficult",
        nextBattleId: "gym-mel",
        fightReveal: "types",
      }),
    ),
    method: "PUT",
  });
  const { nextBattleId: _nextBattleId, fightReveal: _fightReveal, ...legacy } = savedContext;
  assert.equal(
    (await read("/api/context", ContextSchema, { ...post(JSON.stringify(legacy)), method: "PUT" }))
      .nextBattleId,
    "gym-mel",
  );
  assert.equal(
    (
      await send("/api/context", {
        ...post(JSON.stringify({ ...savedContext, fightReveal: "invalid" })),
        method: "PUT",
      })
    ).status,
    400,
  );
  const browserResponse = await fetch(origin);
  assert.match(
    browserResponse.headers.get("content-security-policy") ?? "",
    /frame-ancestors 'none'/,
  );
  return snapshot;
}
