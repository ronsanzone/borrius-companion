# Type desk

Native client-only `/type-tools.mjs` module and scoped `/type-tools.css`. Mount after the parent route renders its container:

```js
const cleanup = mountTypeTools(container, { owned: owned(), active: team() });
```

`active` accepts Pokémon objects or IDs. Return value removes listeners; call when changing route or remounting. No calls leave the browser, no game or team data is modified. The owned chooser marks active Pokémon and can copy their defense types or known ordinary damaging move types.

Defense supports single/dual types. Attack coverage compares the best selected attack type (up to four) against 18 single typings or all 171 distinct single/dual combinations. These combinations are mathematical, not a claim that a matching species exists. Inverse delegates to the existing `domain.mjs` multiplier which flips each individual pairing, including immunity, before multiplying dual defenses. Type-only, without abilities, items, field effects, special move mechanics, damage, or PP enforcement.

The requested inspiration https://www.pkmn.help/defense/solo/ was inspected September 5, 2026. Its published navigation includes solo/team defense, single/dual offense and inverse rules. This implementation is independent native markup and uses this project's existing chart; it does not embed that site's app, source, tracking, or assets. Citation is in the UI.

Run `node --test test/type-tools.test.js` from `app/`. Tests cover dual weakness and quarter resistance, standard immunity and component-wise inverse immunity, best-of offensive coverage, complete combination uniqueness and empty/invalid selection.
