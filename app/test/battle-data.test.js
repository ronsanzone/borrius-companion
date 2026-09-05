import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const BATTLES = JSON.parse(
  readFileSync(new URL("../public/data/battles.json", import.meta.url), "utf8"),
);

const battle = (id) => BATTLES.find((x) => x.id === id);
const types = new Set([
  "normal",
  "fire",
  "water",
  "electric",
  "grass",
  "ice",
  "fighting",
  "poison",
  "ground",
  "flying",
  "psychic",
  "bug",
  "rock",
  "ghost",
  "dragon",
  "dark",
  "steel",
  "fairy",
]);

test("curated records retain exact source/difficulty availability", () => {
  assert.equal(BATTLES.length, 54);
  assert.equal(new Set(BATTLES.map((x) => x.id)).size, BATTLES.length);
  assert.deepEqual(
    BATTLES.filter((x) => x.kind === "gym").map((x) => x.gymNumber),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(BATTLES.flatMap((x) => Object.values(x.variants).filter(Boolean)).length, 160);
  for (const b of BATTLES) {
    assert.equal(b.variants.Vanilla, null);
    for (const [difficulty, v] of Object.entries(b.variants)) {
      if (!v) continue;
      assert.equal(v.version, "2.1.1.1");
      assert.equal(v.confidence, "documented");
      assert.match(v.source, /^https:\/\/docs.google.com\/spreadsheets\/d\//);
      assert.ok(v.sourceSheet && v.sourceRow > 0);
      assert.ok(v.team.length > 0 && v.team.length <= 6, `${b.id} ${difficulty}`);
      for (const p of v.team) {
        assert.ok(p.name && p.levelBasis);
        assert.ok(p.types.every((t) => types.has(t)));
        for (const m of p.moves) {
          assert.ok(m.name);
          assert.ok(m.type === null || types.has(m.type));
          assert.ok(m.category === null || ["physical", "special", "status"].includes(m.category));
        }
      }
    }
  }
  assert.equal(battle("wild-13").variants.Difficult, null);
  assert.equal(battle("wild-13").variants.Expert, null);
  assert.equal(battle("wild-13").variants.Insane.team[0].name, "Hoopa Unbound");
});

test("source side notes and allied Pokémon do not enter enemy rosters", () => {
  assert.equal(battle("gym-big-mo").variants.Difficult.team.length, 5);
  assert.equal(battle("gym-big-mo").variants.Expert.team.length, 5);
  assert.equal(battle("gym-big-mo").variants.Insane.team.length, 6);
  assert.deepEqual(
    battle("wild-11").variants.Insane.team.map((x) => x.name),
    ["Zekrom", "Reshiram"],
  );
  assert.ok(!battle("shadow-1").variants.Difficult.team.some((x) => x.name === "Staravia"));
  assert.equal(battle("shadow-1").variants.Difficult.rules.format, "tag");
});

test("form typing, inverse rules, and Camomons are represented distinctly", () => {
  assert.ok(battle("gym-mel").variants.Difficult.rules.inverse);
  const pinsir = battle("gym-alice").variants.Insane.team.find((x) => x.name === "Mega Pinsir");
  assert.deepEqual(pinsir.types, ["bug", "flying"]);
  for (const p of battle("gym-tessy").variants.Insane.team) {
    assert.ok(p.baseTypes);
    assert.deepEqual(p.types, [...new Set(p.moves.slice(0, 2).map((x) => x.type))]);
  }
  assert.match(battle("gym-big-mo").variants.Insane.rules.notes.join(" "), /Fairy-type moves ban/);
});

test("unknown species/moves and reference levels remain explicit", () => {
  const shadow = battle("wild-1").variants.Difficult.team[0];
  assert.equal(shadow.name, "Shadow Warrior");
  assert.equal(shadow.dexId, null);
  assert.deepEqual(shadow.types, []);
  const allMons = BATTLES.flatMap((b) =>
    Object.values(b.variants)
      .filter(Boolean)
      .flatMap((v) => v.team),
  );
  const uncertain = allMons.flatMap((p) => p.moves).find((m) => m.name === "Hidden Power (Water?)");
  assert.equal(uncertain.type, null);
  const gleam = allMons.flatMap((p) => p.moves).find((m) => m.name === "Dazzling Gleam");
  assert.equal(gleam.type, "fairy");
  assert.equal(gleam.category, "special");
  assert.equal(battle("gym-mirskle").variants.Difficult.team[0].levelBasis, "Level at Cap");
});

test("rival branches identify the player starter rather than merging teams", () => {
  assert.equal(battle("rival-1-gible").starter, "Gible");
  assert.equal(battle("rival-1-gible").variants.Difficult.team[0].name, "Larvitar");
  assert.equal(battle("rival-1-beldum").variants.Difficult.team[0].name, "Gible");
  assert.equal(battle("rival-1-larvitar").variants.Difficult.team[0].name, "Beldum");
});
