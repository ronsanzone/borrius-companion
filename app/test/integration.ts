import { readFile } from "node:fs/promises";
import { exerciseSavePipeline } from "./support/integration.js";
import { fixture } from "./fixtures/save.js";

const savePath = process.env.BORRIUS_TEST_SAVE;
const bytes = savePath ? new Uint8Array(await readFile(savePath)) : fixture({ fullRoster: true });
const snapshot = await exerciseSavePipeline(bytes);
console.log(
  `PASS: pairing, upload, queue parsing, corruption and duplicate protection, ordering, revocation, plans, context, origin checks (${snapshot.party.length} party Pokémon).`,
);
