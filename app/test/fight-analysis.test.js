import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeFight,
  offensiveOptions,
  battleMultiplier,
  incomingExposure,
} from "../src/shared/fight-analysis.ts";
const mon = (id, type, move, pp = 10) => ({
  id,
  name: id,
  level: 30,
  types: [type],
  moves: [{ name: move, type, category: "physical", power: 70, pp }],
});
test("current moves and PP determine coverage, with missing coverage prioritized", () => {
  const active = [mon("a", "water", "Surf")],
    bench = [mon("b", "electric", "Spark")],
    foes = [
      { name: "fire", types: ["fire"] },
      { name: "water", types: ["water"] },
    ];
  const a = analyzeFight(active, [...active, ...bench], foes);
  assert.equal(a.uncovered[0].foe.name, "water");
  assert.deepEqual(a.candidates[0].fills, [1]);
  assert.equal(offensiveOptions(mon("c", "water", "Surf", 0), foes[0]).length, 0);
});
test("source field restrictions alter recommendations without pretending full simulation", () => {
  assert.equal(
    battleMultiplier(
      "ground",
      { types: ["electric"] },
      { notes: ["Permanent Magnet Rise for Electric- and Steel-types"] },
    ),
    0,
  );
  assert.equal(
    battleMultiplier("ice", { types: ["dragon", "flying"] }, { notes: ["Permanent Strong Winds"] }),
    2,
  );
  assert.equal(
    battleMultiplier("fairy", { types: ["fighting"] }, { notes: ["Fairy-type moves ban"] }),
    0,
  );
  assert.equal(
    battleMultiplier("fire", { types: ["grass"] }, { notes: ["Permanent Heavy Rain"] }),
    0,
  );
  assert.equal(battleMultiplier("ghost", { types: ["normal"] }, { inverse: true }), 2);
});
test("unknown typing remains unknown, never a neutral or coverage claim", () => {
  assert.equal(battleMultiplier("fire", { types: [] }), null);
  assert.equal(analyzeFight([], [], [{ name: "unknown", types: [] }]).uncovered.length, 0);
});
test("Camomons defensive matchups use first two move types, including status moves", () => {
  const defender = {
    types: ["grass", "poison"],
    moves: [
      { name: "Protect", type: "normal", category: "status" },
      { name: "Thunderbolt", type: "electric", category: "special" },
      { name: "Flamethrower", type: "fire", category: "special" },
    ],
  };
  const rules = { notes: ["Camomons Battle, Rain"] };
  assert.equal(battleMultiplier("ground", defender, rules), 2);
  assert.equal(battleMultiplier("ghost", defender, rules), 0);
  assert.equal(battleMultiplier("psychic", defender, rules), 1);
});
test("Camomons repeated move type is single typing, and incomplete typing remains unknown", () => {
  const rules = { notes: ["Camomons Battle, Permanent Heavy Rain"] };
  assert.equal(
    battleMultiplier(
      "ground",
      { types: ["flying"], moves: [{ type: "electric" }, { type: "electric" }] },
      rules,
    ),
    2,
  );
  assert.equal(
    battleMultiplier("ground", { types: ["electric"], moves: [{ type: "water" }, {}] }, rules),
    null,
  );
  assert.equal(battleMultiplier("ground", { types: ["electric"], moves: [] }, rules), null);
});
test("Camomons bench risk evaluation uses the same battle typing as direct calculations", () => {
  const defender = {
    types: ["flying"],
    moves: [
      { name: "Protect", type: "normal", category: "status" },
      { name: "Thunderbolt", type: "electric", category: "special" },
    ],
  };
  const foes = [
    {
      types: ["ground"],
      moves: [{ name: "Earthquake", type: "ground", category: "physical", power: 100 }],
    },
  ];
  assert.deepEqual(incomingExposure(defender, foes, { notes: ["Camomons Battle"] }), [
    { type: "ground", multiplier: 2 },
  ]);
  assert.deepEqual(incomingExposure(defender, foes), []);
});

test("Camomons unknown move typing is not classified as an uncovered opponent", () => {
  const foe = {
    name: "Unknown battle types",
    types: ["water"],
    moves: [{ type: "water" }, { type: null }],
  };
  const result = analyzeFight([], [], [foe], { notes: ["Camomons Battle"] });
  assert.equal(result.coverage.length, 1);
  assert.equal(result.uncovered.length, 0);
  assert.deepEqual(result.attackTypes, []);
  assert.equal(analyzeFight([], [], [foe]).uncovered.length, 1);
});
