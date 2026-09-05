import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Schema } from "effect";
import { BattlesSchema } from "../src/client/features/battle-data";
import { DexSchema } from "../src/client/features/dex-data";

void test("all shipped battle reference records decode including unknown moves and absent gym numbers", () => {
  const battles = Schema.decodeUnknownSync(Schema.parseJson(BattlesSchema))(
    readFileSync(new URL("../public/data/battles.json", import.meta.url), "utf8"),
  );
  assert.equal(battles.length, 54);
  assert(
    battles.some((battle) =>
      Object.values(battle.variants).some((variant) =>
        variant?.team.some((foe) => foe.moves.some((move) => move.category === null)),
      ),
    ),
  );
});
void test("all shipped dex species and move metadata decode before rendering", () => {
  const dex = Schema.decodeUnknownSync(Schema.parseJson(DexSchema))(
    readFileSync(new URL("../public/data/dex.json", import.meta.url), "utf8"),
  );
  assert.equal(dex.species.length, 1121);
});
