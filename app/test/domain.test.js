import test from "node:test";
import assert from "node:assert/strict";
import { hasOrdinaryTypeDamage, multiplier, opportunities } from "../src/shared/domain.ts";

test("special damage moves are never ranked as ordinary super-effective coverage", () => {
  const special = [
    "Counter",
    "Mirror Coat",
    "Metal Burst",
    "Bide",
    "Seismic Toss",
    "Night Shade",
    "Sonic Boom",
    "Dragon Rage",
    "Super Fang",
    "Endeavor",
    "Final Gambit",
    "Nature’s Madness",
    "Ruination",
    "Psywave",
    "Guardian of Alola",
    "Fissure",
    "Guillotine",
    "Horn Drill",
    "Sheer Cold",
    "Comeuppance",
  ];
  for (const name of special)
    assert.equal(
      hasOrdinaryTypeDamage({
        name,
        type: "fighting",
        category: "physical",
        power: null,
      }),
      false,
      name,
    );
  // Counter is nominally Fighting, but its damage is not a 2× Normal matchup.
  const counter = {
    name: "Counter",
    type: "fighting",
    category: "physical",
    power: null,
  };
  const kick = {
    name: "Low Kick",
    type: "fighting",
    category: "physical",
    power: null,
  };
  const ranked = [counter, kick].filter(
    (m) => hasOrdinaryTypeDamage(m) && multiplier(m.type, ["normal"]) > 1,
  );
  assert.deepEqual(
    ranked.map((m) => m.name),
    ["Low Kick"],
  );
});

test("ordinary variable-power attacks remain eligible; status and unknown metadata do not", () => {
  assert.equal(
    hasOrdinaryTypeDamage({
      name: "Acrobatics",
      type: "flying",
      category: "physical",
      power: 55,
    }),
    true,
  );
  assert.equal(
    hasOrdinaryTypeDamage({
      name: "Will-O-Wisp",
      type: "fire",
      category: "status",
      power: 0,
    }),
    false,
  );
  assert.equal(
    hasOrdinaryTypeDamage({
      name: "Unknown",
      type: null,
      category: "unknown",
      power: null,
    }),
    false,
  );
});

test("Acrobatics empty-item reminder preserves an intentional build", () => {
  const mon = {
    name: "Gliscor",
    item: "None",
    level: 37,
    moves: [{ name: "Acrobatics", pp: 12, maxPp: 15 }],
  };
  assert.match(opportunities([mon], null)[0].text, /Acrobatics benefits from an empty item slot/);
  assert.equal(opportunities([{ ...mon, item: "Berry" }], null).length, 0);
});
