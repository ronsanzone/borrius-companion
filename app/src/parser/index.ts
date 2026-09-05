interface PokemonBox {
  box: number;
  pokemon: Pokemon[];
}
interface MutableProgress {
  badges: number;
  isChampion: boolean;
  money: number;
  heartScales: number | null;
  ownedTms: string[];
  provenance: string;
  difficulty: null;
  levelCap: null;
}
import type { ParsedSave, Pokemon, Catalog } from "../shared/types";
import data from "../vendor/catalog-data.js";
import { ru32 } from "../vendor/binary.js";
import {
  resolveQuickPockets,
  mapPocketFromAnchor,
  collectOwnedTmhmItemIds,
} from "../vendor/bag.js";
import { activeBank, sectionOffset } from "./banks";
import { readMon } from "./pokemon";
import { fail } from "./errors";
const VERSION = "unbound-readonly-3";
export function getCatalog(): Catalog {
  return {
    species: Object.values(data.species).map(({ speciesId, dexId, name, types, baseStats }) => ({
      speciesId,
      dexId: dexId ?? null,
      name,
      types,
      baseStats,
    })),
  };
}
export function parseSave(
  input: Uint8Array,
  { gameVersion = "2.1.1.1" }: { gameVersion?: string } = {},
): ParsedSave {
  if (gameVersion !== "2.1.1.1") fail("only explicitly selected Unbound 2.1.1.1 is supported");
  if (!(input instanceof Uint8Array) || input.length !== 131072)
    fail("expected a 128 KiB cartridge save, not a save state");
  const b = new Uint8Array(input),
    sections = activeBank(b),
    trainer = sectionOffset(sections, 1),
    count = ru32(b, trainer + 0x34);
  if (count < 1 || count > 6) fail("party count must be 1–6");
  const party = Array.from({ length: count }, (_, i) =>
    readMon(b.subarray(trainer + 0x38 + i * 100, trainer + 0x38 + (i + 1) * 100), {
      kind: "party",
      slot: i + 1,
    }),
  );
  const stream = new Uint8Array(8 * 0xff0);
  for (let id = 5; id <= 12; id++)
    stream.set(
      b.subarray(sectionOffset(sections, id) + 4, sectionOffset(sections, id) + 0xff4),
      (id - 5) * 0xff0,
    );
  const boxes = Array.from({ length: 25 }, (_, i): PokemonBox => ({
    box: i + 1,
    pokemon: [],
  }));
  for (let off = 0, index = 0; off + 58 <= stream.length; off += 58, index++) {
    const raw = stream.subarray(off, off + 58);
    if (raw.every((x) => x === 0)) continue;
    const box = Math.floor(index / 30) + 1;
    boxes[box - 1].pokemon.push(readMon(raw, { kind: "box", box, slot: (index % 30) + 1 }));
  }
  const warnings = [
    "Game version 2.1.1.1 is supplied by the uploader; it is not detected from save contents.",
    "Box inventory is provisional: only boxes 1–18 and slots 1–22 of box 19 are supported. Later storage is not decoded; empty lists there do not establish that those boxes are empty.",
    "Box current PP and battle stats are unknown. Move metadata is extracted from the owner’s verified 2.1.1.1 ROM; dynamic power/types, ability changes and battle effects are not simulated. Accuracy null denotes a bypass/special accuracy rule; power null denotes variable/fixed damage.",
    "Progress and inventory are experimental. Difficulty, level cap, location and next objective are not inferred.",
    "Candidate identity uses original-trainer ID and personality; duplicates are marked ambiguous. This is not a guaranteed permanent identity.",
    "Sector checksums verified. This Unbound layout does not store a standard per-Pokémon checksum; expanded data outside the documented checksum lengths is not independently verified.",
  ];
  const all = [...party, ...boxes.flatMap((x) => x.pokemon)],
    counts = new Map();
  for (const m of all) counts.set(m.id, (counts.get(m.id) || 0) + 1);
  for (const m of all)
    if (counts.get(m.id) > 1) {
      const box = m.location.kind === "box" ? m.location.box : 0;
      const index = all.indexOf(m);
      all[index] = {
        ...m,
        identityConfidence: "ambiguous",
        id: `${m.id}-${m.location.kind}-${box}-${m.location.slot}`,
      };
    }
  const flag = (id: number) => {
    let off = 0xee0 + Math.floor(id / 8),
      section = 1;
    while (off >= 0xff0) {
      off -= 0xff0;
      section++;
    }
    return Boolean(b[sectionOffset(sections, section) + off] & (1 << (id % 8)));
  };
  const progress: MutableProgress = {
    badges: Array.from({ length: 8 }, (_, i) => flag(0x820 + i)).filter(Boolean).length,
    isChampion: flag(0x82c),
    money: ru32(b, trainer + 0x290),
    heartScales: null,
    ownedTms: [],
    provenance: "experimental",
    difficulty: null,
    levelCap: null,
  };
  // Restrict experimental inventory scans to the selected bank to avoid stale items.
  const selected = new Uint8Array(b.length);
  for (const off of sections.values()) selected.set(b.subarray(off, off + 4096), off);
  try {
    const pockets = resolveQuickPockets(selected),
      main = pockets.main;
    if (main && Number.isInteger(main.anchor_offset))
      progress.heartScales = mapPocketFromAnchor(selected, main.anchor_offset, new Map())
        .filter((x) => x.id === 111)
        .reduce((sum, x) => sum + x.qty, 0);
    const ids = collectOwnedTmhmItemIds(selected).owned_tmhm_item_ids;
    progress.ownedTms = ids.map((id) => data.items[id] || `Item ${id}`);
  } catch {
    warnings.push("Experimental bag reader could not establish inventory.");
  }
  return {
    party: all.filter((m) => m.location.kind === "party"),
    boxes: boxes.map((box) => ({
      ...box,
      pokemon: all.filter((m) => m.location.kind === "box" && m.location.box === box.box),
    })),
    progress,
    warnings,
    parserVersion: VERSION,
    gameVersion,
  };
}
