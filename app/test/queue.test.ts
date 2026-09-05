import assert from "node:assert/strict";
import test from "node:test";
import { consumeMessage } from "../src/server/queue.js";

function envelope(body: Message<unknown>["body"]) {
  const decisions: ("ack" | number)[] = [];
  const message: Message<unknown> = {
    id: "message-id",
    timestamp: new Date(),
    attempts: 1,
    body,
    ack: () => {
      decisions.push("ack");
    },
    retry: (options) => {
      decisions.push(options?.delaySeconds ?? 0);
    },
  };
  return { message, decisions };
}

await test("invalid queue envelopes are acknowledged without processing", async () => {
  for (const body of [null, { id: 23 }, "id"]) {
    const { message, decisions } = envelope(body);
    await consumeMessage(message, () => {
      assert.fail("Invalid message was processed");
    });
    assert.deepEqual(decisions, ["ack"]);
  }
});

await test("queue acknowledges only after processing succeeds", async () => {
  const { message, decisions } = envelope({ id: "snapshot-id" });
  await consumeMessage(message, (id) => {
    assert.equal(id, "snapshot-id");
    assert.deepEqual(decisions, []);
    return Promise.resolve();
  });
  assert.deepEqual(decisions, ["ack"]);
});

await test("queue infrastructure failure schedules a delayed retry without acknowledging", async () => {
  const { message, decisions } = envelope({ id: "snapshot-id" });
  await consumeMessage(message, () => Promise.reject(new Error("D1 unavailable")));
  assert.deepEqual(decisions, [60]);
});
