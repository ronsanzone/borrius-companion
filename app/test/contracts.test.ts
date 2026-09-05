import test from "node:test";
import assert from "node:assert/strict";
import { Schema } from "effect";
import { ParsedSaveSchema, PlanSchema, TrainerContextSchema } from "../src/shared/types";
import { parseSave } from "../src/parser/index";
import { fixture } from "./fixtures/save";

await test("parsed synthetic full roster satisfies the shared persisted/client schema", () => {
  const parsed = parseSave(fixture({ fullRoster: true }));
  assert.deepEqual(Schema.decodeUnknownSync(ParsedSaveSchema)(parsed), parsed);
  assert.equal(parsed.party.length, 6);
  assert.equal(parsed.boxes[0].pokemon.length, 4);
});

await test("older plan and context payloads need no migration for optional planning fields", () => {
  const plan = {
    id: "existing-plan",
    name: "Team",
    memberIds: [],
    inverse: false,
    weaknessLimit: 3,
    hardLimit: false,
    updatedAt: "2026-09-05T00:00:00Z",
  };
  const context = {
    difficulty: "Difficult",
    levelCap: 37,
    checkpoint: "Fallshore",
    spoilerMode: "hints",
    favorites: [],
  };
  assert.deepEqual(Schema.decodeUnknownSync(PlanSchema)(plan), plan);
  assert.deepEqual(Schema.decodeUnknownSync(TrainerContextSchema)(context), context);
});
