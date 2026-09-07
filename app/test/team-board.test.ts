import test from "node:test";
import assert from "node:assert/strict";
import { Schema } from "effect";
import { boardCandidates, changeActiveTeam, teamBoard } from "../src/client/features/team-board";
import { PlannerDraftSchema } from "../src/client/contracts";
import { PlanRequest } from "../src/server/schemas";
import type { PlannerDraft } from "../src/client/contracts";
import type { TeamMember } from "../src/shared/types";
import { readPlannerDraft, writePlannerDraft } from "../src/client/planner-storage";
const build: Extract<TeamMember, { kind: "build" }> = {
  kind: "build",
  speciesId: 1,
  moveIds: [null, 2],
  ability: "Test ability",
  item: "Test item",
  notes: "Keep this",
};
const draft: PlannerDraft = {
  version: 2,
  members: [build],
  shortlist: ["owned"],
  benchBuilds: [],
  name: "Test",
  activePlan: null,
  inverse: false,
  hard: false,
  limit: 2,
};
await test("bench and activate preserve an uncaught proposal and owned candidate pool", () => {
  const benched = changeActiveTeam(draft, []);
  assert.deepEqual(benched.benchBuilds, [build]);
  assert.equal(boardCandidates(benched).length, 2);
  const restored = changeActiveTeam(benched, [build]);
  assert.deepEqual(restored.members, [build]);
  assert.deepEqual(restored.benchBuilds, []);
  const replaced = changeActiveTeam(restored, [{ kind: "owned", pokemonId: "owned" }]);
  assert.deepEqual(replaced.benchBuilds, [build]);
  assert.deepEqual(replaced.shortlist, ["owned"]);
  assert.deepEqual(boardCandidates(replaced), [build]);
});
await test("bench proposals roundtrip browser and API boundaries without breaking old drafts", () => {
  let value: string | null = null;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
  const next = changeActiveTeam(draft, []);
  assert.equal(writePlannerDraft(next, storage), true);
  assert.deepEqual(readPlannerDraft(storage), next);
  const request = Schema.decodeUnknownSync(PlanRequest)({
    name: "Test",
    members: [],
    shortlistIds: [],
    weaknessLimit: 2,
    benchBuilds: [build],
  });
  assert.deepEqual(request.benchBuilds, [build]);
  const { benchBuilds: _bench, ...old } = draft;
  assert.ok(Schema.decodeUnknownSync(PlannerDraftSchema)(old));
  assert.throws(() =>
    Schema.decodeUnknownSync(PlanRequest)({ ...request, benchBuilds: Array(25).fill(build) }),
  );
});
await test("all type rows count only active members and keep missing identities unknown", () => {
  const html = teamBoard(
    {
      ...draft,
      members: [{ kind: "owned", pokemonId: "missing" }],
      shortlist: ["missing"],
      benchBuilds: [build],
    },
    [],
    { species: [], moves: {}, source: { notice: "", url: "" } },
    false,
  );
  assert.equal((html.match(/<th scope="row">/g) || []).length, 18);
  assert.match(html, /0 weak, 0 resistant, 0 immune, 1 unknown/);
  assert.match(html, /bench; not counted/);
  assert.match(html, /Uncaught build/);
});
