# Battle reference provenance

`app/public/data/battles.json` contains 54 encounter choices and 160 difficulty-specific rosters for Pokémon Unbound 2.1.1.1. These are documented community reference sets, not a runtime extraction from this user's game. The original workbooks are explicitly marked WIP. Every variant links its worksheet and row range; the application must select the exact difficulty or report that the roster is unavailable.

## Sources inspected and downloaded

Downloaded directly as XLSX exports on 2026-09-05 UTC:

| Difficulty | Original workbook | SHA-256 of inspected export |
| --- | --- | --- |
| Difficult | [2.1.1.1 Difficult Bosses](https://docs.google.com/spreadsheets/d/1_HF-bxEfamTW8S3q7tLjHWWPjo9E1QLS5dtMIhJHoeY/edit) | `016c0529353339811155ab4620483f79fdbd2b4345f49b7788f27b6f1a7c1efe` |
| Expert | [2.1.1.1 Expert Bosses](https://docs.google.com/spreadsheets/d/1yl1AXKfarFb8_8-iF8We9zmLB135kxJ82yOGQDoMHOs/edit) | `9daff6d7d480ba640e7503465ef8a8aa56f8690ca18ee91cd485f03d7985cae0` |
| Insane | [2.1.1.1 Insane Bosses](https://docs.google.com/spreadsheets/d/1pLTQKQkWTnSkev4_kcjHbY0AkBujbTUDybxXFNZ_aVY/edit) | `27694ef9a82b07ed5a6075babdea4fb0a754b57ca492b1cd97a78e0e47a6f8aa` |

The workbooks were discovered through the [versioned source inventory](https://github.com/jimineybillybob1/pokemon-unbound-field-guide/blob/master/sources/source-inventory.md); records were read from the original Google exports, not that project's normalized data. The downloaded exports and one-off extraction script remain in ignored `.cache/battle-research/`. The shipped file contains factual teams and compact field/rule descriptions, not workbook artwork or formatting.

## Coverage and exclusions

- All eight gyms and the Maxima battle.
- Four Elite Four members and the initial Jax championship battle.
- Seven Team Shadow and five Team Light of Ruin encounters, including the documented postgame Aklove encounter.
- Thirteen scripted wild boss choices. The final Dynamax Hoopa entry is documented only in the Insane workbook; its other difficulty variants remain null.
- Five rival locations, each separated into the three **player's starter** branches. Rival teams must never be merged.
- Vanilla sets were not available in these source workbooks and were not established through further source search. `variants.Vanilla` is explicitly null throughout. Difficult is never treated as Vanilla.
- Ordinary trainers, repeatable Mega trainers, Battleground and title-defense variants are outside this initial curated collection. There is no assertion that this covers every optional or postgame boss.

`order` is a stable catalogue order, **not a verified chronological story timeline**. `gymNumber` is the badge sequence. Encounter selection remains user-confirmed; a save's approximate badge count cannot establish which intervening boss is next. Gym town names are basic orientation labels; `sourceSheet`/`sourceRow` and the source's event description identify the precise source record.

## Parsing safeguards

Trainer opponents occupy workbook columns B:G. Partner teams begin at I and are excluded. The stray Terrakion note in H125 is excluded: Difficult and Expert Big Mo each have five opponents, Insane has six. Wild boss opponents occupy B:C; partner columns E:G in the Crystal Peak encounter are excluded, as are aura-reference lists elsewhere in the sheet. The two boss creatures in sequential events are shown together as encounter opposition, not asserted to be a simultaneous double battle.

Names retain Mega, regional and other form qualifiers. National Dex IDs are separate from internal species IDs. Types come from the pinned PUSE-derived species catalogue already used by the save parser, with form matching. Shadow Warrior has no established catalogue match and remains `dexId: null, types: []`; its defensive matchups must be shown unknown, never neutral. Notes retain source lead designations, pre-burn and stat-boost information.

Move names are matched to the existing verified numeric Unbound ROM metadata. Explicit aliases reconcile compact in-game names (for example Dazzle Gleam / Dazzling Gleam, Bad Tantrum / Stomping Tantrum). No generic-generation move table is substituted. Definite source Hidden Power types are preserved. The source's uncertain `Hidden Power (Water?)` and unspecified `default moveset` stay unknown. Missing moves cannot be interpreted as absence of offensive coverage.

Reference levels retain `levelBasis` (for example Level at Cap or Minimum Level). These are **not predicted current opponent levels**: battle scaling and game settings can differ. Blank items and abilities are null, not inferred. Full EV/nature/IV simulation is outside this dataset.

## Battle rules and analysis limits

Rules are variant-specific. The UI must use `variant.rules`, not infer all rules from a gym's advertised focus type. Mel is inverse; Tessy uses Camomons. For Tessy, `baseTypes` records the usual species typing and `types` is derived from the first two documented move types for this battle.

The rule text also preserves fog, negative energy, strong winds, Electric/Steel Magnet Rise, heavy rain, weight-based turn ordering, the Insane Big Mo Fairy-move ban, tag partners and wild aura/shield notes. An ordinary type chart does not model these rules, damage, AI, accuracy, speed, abilities, held items, stat boosts or partner behavior. Recommendations are type-coverage leads to investigate, not promises of a safe switch or a guaranteed counter. The full drill-down should show source notes and allow the player to verify conditions before fighting.

## Validation

`node --test app/test/battle-data.test.js` checks exact difficulty availability, all eight gyms, form typing, Camomons derivation, move metadata, reference-level labels, rival branch separation, and exclusion of partner/side-note Pokémon. Inspect and update the source version and export hashes before replacing data from a newer workbook.
