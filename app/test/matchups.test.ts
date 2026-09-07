import test from "node:test";
import assert from "node:assert/strict";
import { matchupAttacks } from "../src/shared/matchups";
import { matchupGrid } from "../src/client/features/matchup-grid";
import type { Combatant } from "../src/shared/types";
const player: Combatant = {
  types: ["electric"],
  moves: [{ name: "Thunderbolt", type: "electric", category: "special", pp: 10 }],
};
const foe = {
  name: "Hidden opponent",
  dexId: 1,
  types: ["ground", "flying"],
  moves: [{ name: "Secret Earthquake", type: "ground", category: "physical" }],
};
await test("grid attacks retain immunities, resistance, neutral and unknown instead of fabricating coverage", () => {
  assert.equal(matchupAttacks(player, foe, {})[0]?.multiplier, 0);
  assert.equal(matchupAttacks(player, foe, { inverse: true })[0]?.multiplier, 1);
  assert.equal(matchupAttacks(player, { types: ["electric"] }, {})[0]?.multiplier, 0.5);
  assert.equal(matchupAttacks(player, { types: ["water", "flying"] }, {})[0]?.multiplier, 4);
  assert.deepEqual(matchupAttacks(player, { types: ["unknown"] }, {}), []);
  assert.deepEqual(
    matchupAttacks(
      {
        types: [],
        moves: [
          { name: "Seismic Toss", type: "fighting", category: "physical" },
          { name: "Thunderbolt", type: "electric", category: "special", pp: 0 },
          { name: "Growl", type: "normal", category: "status" },
        ],
      },
      foe,
      {},
    ),
    [],
  );
  assert.equal(
    matchupAttacks(
      { types: [], moves: [{ name: "Flamethrower", type: "fire", category: "special" }] },
      { types: ["grass"] },
      { notes: ["heavy rain"] },
    )[0]?.multiplier,
    0,
  );
});
await test("grid spoiler tiers suppress opponents and return threats from markup", () => {
  const team = [{ name: "Player", combatant: player }];
  const selected = { player: 0, enemy: 0 };
  const hints = matchupGrid(team, [foe], {}, "types", selected);
  assert.doesNotMatch(hints, /Hidden opponent|Secret Earthquake|matchup-cell|matchup-risk/);
  const revealed = matchupGrid(team, [foe], {}, "team", selected);
  assert.match(revealed, /Hidden opponent/);
  assert.doesNotMatch(revealed, /Secret Earthquake|matchup-risk|Documented return attacks/);
  const full = matchupGrid(team, [foe], {}, "full", selected);
  assert.match(full, /Secret Earthquake/);
  assert.match(full, /matchup-risk/);
  assert.match(full, /0×/);
  assert.match(matchupGrid(team, [foe], {}, "full", { player: 8, enemy: 8 }), /Select a pairing/);
});
await test("coverage summary counts distinct team answers and keeps unknown pairings explicit", () => {
  const water = { ...foe, types: ["water"] };
  const html = matchupGrid(
    [
      { name: "A", combatant: player },
      { name: "B", combatant: player },
      { name: "Missing", combatant: { types: [], moves: [] } },
    ],
    [water],
    {},
    "team",
    null,
  );
  assert.match(html, /<strong>1 \/ 1<\/strong> targets with backup answers/);
  assert.match(html, /unknown or have no usable ordinary attack/);
  assert.match(html, /class="matchup-cell unknown"/);
});
