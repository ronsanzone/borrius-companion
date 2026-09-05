import assert from "node:assert/strict";
import test from "node:test";
import { Schema } from "effect";
import { HttpError, json, readBody, readJson, respond } from "../src/server/http.js";
import { ContextRequest, PlanRequest, QueueMessage } from "../src/server/schemas.js";
import { requireOrigin } from "../src/server/security.js";

const request = (body: string): Request =>
  new Request("https://example.test/api/plans", { method: "POST", body });

await test("HTTP schema boundary rejects valid JSON with invalid structures", async () => {
  for (const body of ["null", "[]", '{"name":23}', "{"]) {
    await assert.rejects(
      readJson(request(body), PlanRequest),
      (error) => error instanceof HttpError && error.status === 400,
    );
  }
});

await test("upload body rejects both announced and streamed oversize input", async () => {
  const announced = new Request("https://example.test/api/import", {
    method: "POST",
    headers: { "content-length": "9" },
    body: "abc",
  });
  await assert.rejects(
    readBody(announced, 3),
    (error) => error instanceof HttpError && error.status === 413,
  );
  await assert.rejects(
    readBody(request("1234"), 3),
    (error) => error instanceof HttpError && error.status === 413,
  );
  assert.deepEqual(await readBody(request("123"), 3), new TextEncoder().encode("123"));
});

await test("HTTP Effect boundary exposes expected messages and hides internal failures", async () => {
  const expected = await respond(() =>
    Promise.reject(new HttpError({ status: 409, message: "Capture conflict" })),
  );
  assert.equal(expected.status, 409);
  assert.deepEqual(await expected.json(), { error: "Capture conflict" });
  const unexpected = await respond(() => Promise.reject(new Error("secret database details")));
  assert.equal(unexpected.status, 500);
  assert.deepEqual(await unexpected.json(), { error: "Request failed. Please retry." });
  const success = await respond(() => Promise.resolve(json({ ok: true })));
  assert.equal(success.headers.get("cache-control"), "no-store");
  assert.equal(success.headers.get("x-frame-options"), "DENY");
});

await test("context schema supports omitted legacy fight fields while rejecting invalid spoilers", () => {
  const context = { difficulty: "Difficult", spoilerMode: "hints", levelCap: null };
  assert.equal(Schema.decodeUnknownEither(ContextRequest)(context)._tag, "Right");
  assert.equal(
    Schema.decodeUnknownEither(ContextRequest)({ ...context, fightReveal: "surprise" })._tag,
    "Left",
  );
  assert.equal(
    Schema.decodeUnknownEither(ContextRequest)({ ...context, levelCap: 101 })._tag,
    "Left",
  );
  assert.equal(Schema.decodeUnknownEither(QueueMessage)({ id: 23 })._tag, "Left");
});

await test("owner mutation origin check rejects missing and foreign origins", () => {
  for (const origin of ["", "https://attacker.test"]) {
    assert.throws(
      () => requireOrigin(new Request("https://example.test/api/plans", { headers: { origin } })),
      HttpError,
    );
  }
  assert.doesNotThrow(() =>
    requireOrigin(
      new Request("https://example.test/api/plans", {
        headers: { origin: "https://example.test" },
      }),
    ),
  );
});

await test("local owner bypass is restricted to explicit local mode and loopback hostnames", async () => {
  const { localRequest, requireOwner } = await import("../src/server/security.js");
  for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
    const local = new Request(`http://${host}/api/state`);
    assert.equal(localRequest(local, { DEPLOYMENT_MODE: "local" }), true);
    assert.equal(localRequest(local, { DEPLOYMENT_MODE: "production" }), false);
    await requireOwner(local, { DEPLOYMENT_MODE: "local" });
  }
  const remote = new Request("https://borrius.ronsanzone.dev/api/state");
  assert.equal(localRequest(remote, { DEPLOYMENT_MODE: "local" }), false);
  await assert.rejects(
    requireOwner(remote, { DEPLOYMENT_MODE: "local" }),
    (error) => error instanceof HttpError && error.status === 503,
  );
  await assert.rejects(
    requireOwner(remote, {
      DEPLOYMENT_MODE: "production",
      ACCESS_AUD: "f75d395d641cdd357df523a289bdbaaff3758ef52d737868c558ab0b1c0f3a6a",
      ACCESS_TEAM_DOMAIN: "https://ronsanzone.cloudflareaccess.com",
      ACCESS_ALLOWED_EMAIL: "ron.sanzone1@gmail.com",
    }),
    (error) => error instanceof HttpError && error.status === 403,
  );
});
