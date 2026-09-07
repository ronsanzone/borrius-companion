# Pokédex strategy workspace

Implementation branch: `codex/pokedex-strategy-workspace-restart`. Approved scope: [audited design contract](../design/approved-strategy-workspace.md). That document preserves historical handoff notes; this page describes the implementation.

## Architecture and behavior

`main.ts` owns one `PlannerDraft` and one in-memory workspace session. The Dex, player team, saved teams, reference builds, encounter selection and inspector are composed by `features/strategy-workspace.ts`. `#dex` is the primary route; old `#lab` and `#prepare` bookmarks open it. The duplicate planner and Battle Prep renderers and planner arithmetic module are removed. Camp, collection, favorites, shortlist, Type Desk, Journal, pairing, imports and settings remain available.

The session retains selected side/form, encounter/difficulty/starter/stage and Dex search/filter/page through in-app navigation and explicit refresh. Browser draft storage retains team proposals and settings across reloads. Encounter/reveal settings persist through the explicit save button. Ordinary background refresh remains paused while tools are open, preventing drafts being remounted unexpectedly. All listeners and outstanding reference fetches are cleaned up on navigation.

`TeamMember` is a discriminated union: owned `pokemonId`, or hypothetical `speciesId`, ordered nullable `moveIds`, proposed ability/item/notes. No reference Pokémon is assigned an owned ID. Unknown move slots stay in position, which matters for Camomons. Owned moves come from the latest matched individual. Missing individuals remain visible and replaceable; missing shortlist entries can be removed explicitly. Six active members and 24 shortlisted owned identities are enforced. Server writes reject duplicate owned individuals or proposed nonempty move IDs. The save operation locks team controls until completion, preventing a response from attaching a saved ID to a different draft.

`strategy-inspector.ts` presents either side using the same pinned Dex reference, defensive calculations, stat bars and learnset/evolution detail. Actual saved stats, species base stats, known moves, documented enemy moves and hypothetical proposals are labeled separately. Standard species artwork is explicitly distinguished from exact form stats. `foe-forms.ts` maps source names to pinned internal symbols; tests resolve every documented foe except the explicitly unknown Shadow Warrior. Minior exposes Shield/Core reference previews because its source does not establish state.

`scouting.ts` provides transparent reference heuristics, not calculated combat stats. Base Speed ≥100 is fast, <60 slow. Offense counts documented ordinary physical/special attacks. Physical and special bulk are HP×Defense and HP×Sp.Def, with ≥9000 flagged as stronger reference bulk. Wall potential additionally requires a documented recovery move; tank potential requires ordinary attacks. Missing set evidence remains uncertain. These cutoffs are a documented UI heuristic, not authoritative game labels. Levels, EVs, IVs, nature, priority, abilities, items and scripts can change the result.

`fight-analysis.ts` is the shared source for ordinary damaging move coverage, unknown typing and supported field rules. It preserves inverse per-factor arithmetic, Camomons first-two-move order, Strong Winds, documented Electric/Steel Magnet Rise, heavy-rain Fire blocking and Fairy-move restrictions. No damage or turn-order simulation is claimed. `team-analysis.ts` ranks known-move bench candidates and applies the saved weakness threshold. Unknown typing is never treated as neutral or safe.

## Spoilers

Typing hints render no enemy identities, sprites, opponent inspection, set-based scouting, phase names or source links. Team reveal allows identities/reference profiles and matchup cards; full reveal additionally allows documented sets, scouting, incoming threats, field notes and sources. Tightening reveal clears the enemy inspector. Changing fight, stage, starter or difficulty also clears it. The global Settings choice explicitly resets encounter reveal to hints/full; afterward the encounter control can choose the more granular team tier. Selecting a new opponent never changes the player draft.

## Persistence migration and recovery

`0003_strategy_teams.sql` migrates JSON rows before the new decoder runs. It preserves plan IDs, names, ordered membership, shortlist order, inverse/threshold/hard settings and timestamps. Older plans lacking a shortlist get their original member list as shortlist. Context retains checkpoint, favorites, difficulty and cap, with explicit `nextBattleId` and `fightReveal` defaults. Existing roster IDs are unchanged; the encounter manifest maps them into groups/stages at read time. SQL guards make repeated direct application safe. Migration history is retained for fresh databases; runtime schemas contain no legacy fallback reader.

Browser migration is isolated in `draft-migration.ts`. The old `borrius-planner` draft is read once when `borrius-strategy-v2` is absent. Ordered membership, missing identities, shortlist, name and settings survive. The original key remains as a recovery copy; it is not read when the new key exists. A quota failure still returns the migrated draft in memory. Corrupt/unreadable browser storage cannot prevent app loading; account persistence remains available.

Before an eventual authorized production rollout:

1. Stop owner plan/context writes for the deployment window. Export D1 to a dated backup using the existing production environment, and keep that private backup outside Git.
2. Verify the backup opens and contains the expected `plans` and `settings` rows. Record counts and a hash in the private operations log.
3. Apply migrations, inspect counts and representative migrated rows, then deploy the matching app version. Do not run old app writers against migrated data.
4. If verification fails, stop writes and restore the pre-migration backup together with the pre-feature app version. Do not roll back only the code, since the JSON contract changed.

No production migration, merge or deployment was performed during this build.

## Verification ledger

- Strict TypeScript and lint pass during implementation.
- Existing unit suite passes; new tests cover forms, scouting evidence, six-slot replacement, inverse/unknown typing, chronology mapping, missing slots and browser draft migration.
- Playwright exercises the real local Worker/D1/R2/Queue using synthetic saves. Startup applies the actual SQL migration to legacy rows twice before the new state decoder runs. The tests check preserved data, load/update/reload and explicit missing identities.
- Eleven browser tests passed after final review fixes: mixed team proposals; exact difficulty and starter; spoiler DOM boundaries; migrations; 360/390/1440px layouts; keyboard focus and 200% text; Type Desk/Journal/Settings; proposal retention and save locking; settings tightening; failed-save/fetch states; and delayed save completion after navigation.
- Phone/desktop captures are generated under ignored `app/test-results`; visual review uses those actual browser captures. Learnsets are collapsed and search is at the top to keep the phone workspace compact.
- Final root `npm run check` passed: strict types, lint, formatting and 59 passing unit tests (one optional private-save test skipped). `npm run build` passed, including Worker dry-run bundling. `npm run test:e2e` passed all 11 tests.
- Independent cross-review covered type arithmetic, spoiler boundaries, migration and async lifecycle behavior. All findings were resolved; the final targeted recheck reported no remaining actionable findings. Review was read-only; test results above are from the implementation run.
