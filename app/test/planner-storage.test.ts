import assert from "node:assert/strict";
import test from "node:test";
import { readPlannerDraft, writePlannerDraft } from "../src/client/planner-storage.js";

import type { PlannerDraft } from "../src/client/contracts";
const draft: PlannerDraft = {
  version: 2,
  hard: false,
  shortlist: ["a", "b"],
  members: [{ kind: "owned", pokemonId: "a" }],
  inverse: false,
  limit: 3,
  name: "My plan",
  activePlan: null,
};

await test("planner storage round trips existing drafts", () => {
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
  assert.equal(readPlannerDraft(storage), null);
  assert.equal(writePlannerDraft(draft, storage), true);
  assert.deepEqual(readPlannerDraft(storage), draft);
});

await test("invalid drafts and unavailable browser storage leave the app usable", () => {
  for (const value of ["{", "null", '{"selected":"not-an-array"}']) {
    assert.equal(readPlannerDraft({ getItem: () => value, setItem: () => {} }), null);
  }
  const unavailable = {
    getItem: (): string => {
      throw new Error("Blocked");
    },
    setItem: (): void => {
      throw new Error("Quota exceeded");
    },
  };
  assert.equal(readPlannerDraft(unavailable), null);
  assert.equal(writePlannerDraft(draft, unavailable), false);
});

await test("readable legacy draft remains available when migration cannot write storage", () => {
  const old = JSON.stringify({
    shortlist: ["missing"],
    selected: ["missing"],
    inverse: true,
    limit: 2,
    name: "Keep me",
    activePlan: null,
  });
  const restored = readPlannerDraft({
    getItem: (key) => (key === "borrius-planner" ? old : null),
    setItem: () => {
      throw Error("Quota exceeded");
    },
  });
  assert.equal(restored?.name, "Keep me");
  assert.deepEqual(restored?.members, [{ kind: "owned", pokemonId: "missing" }]);
});
