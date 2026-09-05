# Native Pokédex provenance

The native `#dex` tab takes inspiration from [Yda's Unbound Pokédex](https://ydarissep.github.io/Unbound-Pokedex/), but does not embed that website or copy its UI code. Browsing sends only authenticated same-origin requests for static reference JSON and existing sprites. Collection matching happens locally; it does not transmit owned Pokémon to the external reference.

## Data

- Species names, national IDs, types, base stats and ability slots: existing `app/src/vendor/catalog-data.js`, MIT PUSE at pinned `eb1ac0094c97f9c406fdd26066b4638676fbd3c3`. License retained at `app/public/data/dex-PUSE-LICENSE.txt`.
- Level-up, egg, TM/HM and tutor compatibility, regular evolution methods: [Skeli789 Dynamic Pokémon Expansion, Unbound branch](https://github.com/Skeli789/Dynamic-Pokemon-Expansion/tree/fe058e0e3ac23cf968cf950de43332135bc1549d), pinned `fe058e0e3ac23cf968cf950de43332135bc1549d`. DPE license retained verbatim at `app/public/data/dex-DPE-LICENSE.txt`. Source `src/Learnsets.c`, `src/Egg_Moves.c`, `src/Evolution Table.c`, `src/tm_compatibility/*`, `src/tutor_compatibility/*`, constants in `include/species.h`, `include/moves.h`.
- This is the same upstream expansion branch Yda Dex fetches, as observed in Yda repository commit `abc2ccc0985bb5b31dac2d60118d54c310a15821`, `src/global.js` and `src/species/fetchSpecies.js`. Yda's code is not redistributed.
- Move name/metadata: existing catalog + verified owner's 2.1.1.1 numeric ROM move metadata, already documented in vendor README. No ROM bytes are included in static data.

## Coverage and limits

1121 species/forms mapping to National Dex 1–809. Standard species sprites are reused for forms, explicitly disclosed. Level-up sets resolve by source pointer table; compatibility lists resolve explicit species symbols. Egg and regular evolution records retained. Mega, Gigantamax and Primal transformation entries are omitted from the regular evolution section.

The pinned expansion source is an Unbound reference, not independently proven identical to the owner's installed 2.1.1.1 learnsets. UI labels this uncertainty. Reference inclusion makes no encounter/availability/randomizer claim. Type/ability listings do not simulate mechanics. Learnable moves are separate from moves currently known in the save; item or tutor compatibility does not imply ownership or access.

## Rebuild

Clone `https://github.com/Skeli789/Dynamic-Pokemon-Expansion.git` into ignored `.cache/DPE`, checkout exact commit above, then run `node scripts/dex-build.mjs` at repository root. Output `app/public/data/dex.json` is deterministic for pinned sources. Test with `node --test app/test/dex.test.js`.

## Integration

`mountDex(container, { owned: ownedPokemonArray, query: optionalInitialSearch })` in `app/public/dex.mjs` returns cleanup. Call cleanup when leaving/replacing the tab. Include `dex.css`. The mount owns scoped listeners and an AbortController; all search, selection, and pagination happen without global application rerendering.
