import assert from "node:assert/strict";
import test from "node:test";
import { Schema } from "effect";
import { request } from "../src/client/api.js";

const Reply = Schema.Struct({ ok: Schema.Boolean });

await test("client boundary decodes success and rejects malformed server responses", async (context) => {
  const fetch = context.mock.method(globalThis, "fetch", () =>
    Promise.resolve(Response.json({ ok: true })),
  );
  assert.deepEqual(await request(Reply, "/plans"), { ok: true });
  fetch.mock.mockImplementation(() => Promise.resolve(Response.json({ ok: "not a boolean" })));
  await assert.rejects(request(Reply, "/plans"), /invalid response/);
  fetch.mock.mockImplementation(() =>
    Promise.resolve(Response.json({ error: "Access denied" }, { status: 403 })),
  );
  await assert.rejects(request(Reply, "/plans"), /Access denied/);
});

await test("cartridge import retains byte body and Android-compatible capture metadata", async (context) => {
  const calls: RequestInit[] = [];
  context.mock.method(globalThis, "fetch", (_url: string, init: RequestInit) => {
    calls.push(init);
    return Promise.resolve(Response.json({ ok: true }));
  });
  const bytes = new ArrayBuffer(131072);
  await request(Reply, "/import", "POST", bytes, "Pokémon Unbound.srm");
  const init = calls[0];
  assert.ok(init);
  assert.equal(init.body, bytes);
  const headers = new Headers(init.headers);
  assert.equal(headers.get("X-Game-Version"), "2.1.1.1");
  assert.equal(decodeURIComponent(headers.get("X-Save-Name") ?? ""), "Pokémon Unbound.srm");
  assert.match(headers.get("X-Capture-Id") ?? "", /^[a-z0-9-]{36}$/);
});
