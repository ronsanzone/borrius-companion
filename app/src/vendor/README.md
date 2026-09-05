# Read-only upstream provenance

Layout and static catalogs derived from https://github.com/Zannael/PUSE at commit `eb1ac0094c97f9c406fdd26066b4638676fbd3c3` (MIT; full license in PUSE-LICENSE).

`catalog-data.js` is generated from frontend public items/pokemon/TM/move_table_from_rom catalogs plus core speciesTypes, speciesBaseStats, speciesGrowthRates, speciesAbilitiesMeta, abilitiesCatalog and pokedexSpeciesMap. It deliberately keeps internal Unbound species IDs separate from National Dex IDs. PUSE move table supplies names/PP; move-metadata.js separately supplies bounded numeric ROM metadata described below. Generic duplicate-name "Form 1" labels are not invented.

`growth.js` retains upstream growth calculations; `bag.js` retains upstream experimental readers only, truncating before writeSlot. `sections.js` contains section readers; `binary.js` contains unsigned readers only. No editor, mutation, save-export, global fetch override or network operation is included.

Parser uses complete newest 14-section bank only; checks signature, section IDs and one consistent counter; refuses torn newest bank instead of showing older data. Checksum lengths: 0=0xADC, 1–3=0xFF0, 4=0xD98, 5–12=0xFF4, 13=0x450. These are checksum-covered regions, not all physical bytes. Unbound party records use plain B/A/D/C fields rather than encrypted shuffled vanilla Gen3 records. 0x1C is a runtime species override, not a usable stored Pokémon checksum. Packed PC records have no independent checksum. There is no claim of full-file corruption detection or intrinsic game-version detection.

PC support is limited to the contiguous stream (562 records): boxes 1–18 and first 22 slots of box 19. Remaining tail bytes and PUSE's guessed absolute fallback layouts are not treated as owned Pokémon. Warnings surface this partial coverage on every snapshot. All 85 Pokémon in the current private sample are in supported boxes 1–4. Box current PP and battle stats are not stored in this compact layout and remain null. Expanded slots require a separately validated map before inventory completeness can be claimed.

Bag readers use upstream heuristics, restricted to the active bank. Progress is always experimental; unknown difficulty and cap remain null. The initial party screen observations for some non-Gliscor HP values differ from initial saved bytes; only Gliscor detailed fields were independently verified.

## Move metadata from this device's ROM

`move-metadata.js` holds only numeric type/power/accuracy/category facts for IDs 1–922. The full ROM remains in ignored `.cache/unbound-device.gba`; it is never included in app assets or uploaded. `extract-move-metadata.py` reproduces the small table only after checking the exact 32 MiB ROM SHA-256 `7aa25bbf568f7cfcf6ee1cf2e9e6ff637350b3d0705c2375cabb6baa7d9739f7`.

The device ROM's CRC32 `4B3D4957`, MD5 `9CAD8E771940E7F7094D13911552CEF0`, and SHA-1 `B4776B82A4C7915D0FADEAA27E013523F99DFD94` all match the libretro database entry naming Unbound 2.1.1.1: https://github.com/libretro/libretro-database/blob/master/metadat/hacks/Nintendo%20-%20Game%20Boy%20Advance.dat . This establishes the inspected device ROM's version confidence, not autonomous save-file version detection.

Primary CFRU struct source: https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/pokemon.h (`BattleMove`, 12 u8/s8 fields). Type constants: https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/constants/pokemon.h (Fairy=23, mystery=9). Category constants: https://github.com/Skeli789/Complete-Fire-Red-Upgrade/blob/master/include/battle.h (physical=0/special=1/status=2). All table records validate type domain, accuracy ≤100, split domain, and PP against all 922 pinned PUSE name/PP records. The ROM pointer at 0x1CC points to 0x08A769AF; the table starts at file offset 0xA769AF, stride 12. A stale table at 0x900000 was excluded because 266 PP records disagree; this prevents accidentally importing old vanilla values.

Power=1 is a variable/fixed damage sentinel and becomes null. Power=0 remains 0 (typically status). Accuracy=0 becomes null because it denotes bypass/special accuracy behavior, not a zero-percent hit chance. Unknown/mystery type=9 becomes null. Dynamic type/power rules and ability/field/target effects are not simulated. In particular Acrobatics base power 55 does not model its conditional doubling. These are ROM table facts, not a complete battle engine.

Western nickname decoding uses the single-byte character assignments in https://github.com/pret/pokefirered/blob/master/charmap.txt . In particular 0x1B is é; the current box 1 slot 12 stores `C0 E0 D5 D6 1B D6 1B FF` (Flabébé). The corrupted upstream literal `Flab?b?` is normalized to Flabébé in the bundled species names. End marker 0xFF terminates decoding. Japanese-language text tables/control sequences are not supported.
