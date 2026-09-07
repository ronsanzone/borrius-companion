import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Schema } from "effect";
import { DexSchema } from "../src/client/features/dex-data";
import { BattlesSchema } from "../src/client/features/battle-data";
import { foeFormSymbols } from "../src/shared/foe-forms";
import { scout } from "../src/shared/scouting";
import { editTeam } from "../src/shared/team";
import { encounters, encounterForRoster, rosterId } from "../src/shared/encounters";
import { battleMultiplier } from "../src/shared/fight-analysis";
import { inspector } from "../src/client/features/strategy-inspector";
import { migrateDraft } from "../src/client/draft-migration";
const dex = Schema.decodeUnknownSync(Schema.parseJson(DexSchema))(
  readFileSync(new URL("../public/data/dex.json", import.meta.url), "utf8"),
);
const battles = Schema.decodeUnknownSync(Schema.parseJson(BattlesSchema))(
  readFileSync(new URL("../public/data/battles.json", import.meta.url), "utf8"),
);
await test("every sourced foe resolves exact symbols or explicitly unknown Shadow Warrior", () => {
  for (const battle of battles)
    for (const variant of Object.values(battle.variants))
      for (const foe of variant?.team ?? []) {
        const symbols = foeFormSymbols(foe.name);
        assert.ok(symbols.length || foe.name === "Shadow Warrior", foe.name);
        for (const symbol of symbols)
          assert.ok(
            dex.species.some((s) => s.symbol === symbol),
            `${foe.name}: ${symbol}`,
          );
      }
  assert.notDeepEqual(foeFormSymbols("Mega Altaria"), foeFormSymbols("Altaria"));
});
await test("scouting distinguishes set evidence and Minior state, not Defense alone", () => {
  const forms = foeFormSymbols("Minior").map((symbol) =>
    dex.species.find((s) => s.symbol === symbol),
  );
  assert.equal(scout(forms[0]?.baseStats ?? [], [])?.speed, "Mid-speed");
  assert.equal(scout(forms[1]?.baseStats ?? [], [])?.speed, "Fast");
  const base = [100, 80, 120, 80, 100, 40];
  assert.equal(scout(base, [])?.role, "Role uncertain");
  assert.equal(scout(base, [{ name: "Roost", category: "status" }])?.role, "Wall potential");
  assert.equal(
    scout(base, [{ name: "Body Slam", type: "normal", category: "physical" }])?.role,
    "Tank potential",
  );
  assert.equal(scout([], []), null);
});
await test("team cap and explicit replacement preserve order and reject duplicate individuals", () => {
  const members = Array.from({ length: 6 }, (_, i) => ({
    kind: "owned" as const,
    pokemonId: `id-${i}`,
  }));
  assert.throws(() => editTeam(members, { kind: "owned", pokemonId: "new" }), /six/);
  const next = editTeam(
    members,
    { kind: "build", speciesId: 1, moveIds: [], ability: "", item: "", notes: "" },
    2,
  );
  assert.equal(next.length, 6);
  assert.deepEqual(next[0], members[0]);
  assert.equal(next[2]?.kind, "build");
  assert.throws(() => editTeam(members, members[1], 0), /already/);
});
await test("unknown and duplicate typing propagate correctly; inverse flips each factor", () => {
  assert.equal(battleMultiplier("fire", { types: ["grass", "unknown"] }), null);
  assert.equal(battleMultiplier("unknown", { types: ["grass"] }), null);
  assert.equal(battleMultiplier("fire", { types: ["grass", "grass"] }), 2);
  assert.equal(battleMultiplier("electric", { types: ["ground", "flying"] }, { inverse: true }), 1);
  assert.equal(battleMultiplier("ghost", { types: ["normal", "dark"] }, { inverse: true }), 4);
});
await test("timeline maps every roster, branches require starter, and ordered sequences stay distinct", () => {
  for (const b of battles) assert.ok(encounterForRoster(b.id), b.id);
  const rival = encounters.find((e) => e.id === "rival-5");
  assert.ok(rival);
  assert.equal(rosterId(rival, 0, ""), undefined);
  assert.equal(rosterId(rival, 0, "beldum"), "rival-5-beldum");
  assert.ok(
    encounters.findIndex((e) => e.id === "shadow-1") <
      encounters.findIndex((e) => e.id === "gym-vega"),
  );
  assert.deepEqual(encounters.find((e) => e.id === "void-beasts")?.stages, [
    "wild-3",
    "wild-4",
    "wild-5",
  ]);
  assert.ok(
    encounters
      .filter((e) => e.id.match(/^league-[1-4]$/))
      .every((e) => e.group === "player-order" && e.position === 1),
  );
  assert.equal(encounterForRoster("wild-13")?.id, "peak-finale");
});
await test("team-only inspector excludes documented sets, roles and source field notes", () => {
  const species = dex.species[0];
  const html = inspector(
    dex,
    species,
    [],
    { notes: ["Secret field rule"] },
    undefined,
    {
      name: species.name,
      dexId: species.dexId,
      types: species.types,
      moves: [{ name: "Secret move", category: "physical", type: "normal" }],
      ability: "Secret ability",
      item: "Secret item",
    },
    false,
  );
  for (const secret of [
    "Secret field rule",
    "Secret move",
    "Secret ability",
    "Secret item",
    "Estimated role",
  ])
    assert.ok(!html.includes(secret));
});
await test("browser migration preserves missing identities, shortlist order and settings", () => {
  const draft = migrateDraft(
    JSON.stringify({
      selected: ["missing-b", "missing-a"],
      shortlist: ["missing-a", "missing-b", "bench"],
      name: "My team",
      inverse: true,
      limit: 2,
      activePlan: "saved-plan",
    }),
  );
  assert.deepEqual(draft.members, [
    { kind: "owned", pokemonId: "missing-b" },
    { kind: "owned", pokemonId: "missing-a" },
  ]);
  assert.deepEqual(draft.shortlist, ["missing-a", "missing-b", "bench"]);
  assert.equal(draft.name, "My team");
  assert.equal(draft.inverse, true);
});

await test("unknown proposed slots preserve order for Camomons", async () => {
  const { memberView } = await import("../src/client/features/strategy-team");
  const thunderbolt = Object.entries(dex.moves).find(([, m]) => m.name === "Thunderbolt");
  assert.ok(thunderbolt);
  const view = memberView(
    {
      kind: "build",
      speciesId: 1,
      moveIds: [null, Number(thunderbolt[0])],
      ability: "",
      item: "",
      notes: "",
    },
    [],
    dex,
  );
  assert.equal(view.combatant.moves?.length, 2);
  assert.equal(battleMultiplier("ground", view.combatant, { notes: ["Camomons"] }), null);
});
