# Borrius Pokédex strategy workspace — implementation handoff

## Task and authorization

The user approved the feature outline and asks you to perform the full build and verification in a NEW BRANCH, in a normal visible Codex session they can drive. Use Astra (`gpt-6-astra`) at medium effort. This is implementation authorization, not a request for another planning-only turn. Do not merge into main or deploy the live companion unless subsequently authorized. Keep the user updated and expose review artifacts they can access from their phone.

Repository: `/Users/sanzoner/code/pokemon-unbound-guide`.
IMPORTANT: the saved Codex project points to an obsolete Documents/ChatGPT path that no longer exists. Work in the actual repository above. At handoff it was clean on `main`, HEAD `5a9b656a1391a42adccad698613fa7210d48bb1f`. Recheck before starting. Create a dedicated branch such as `codex/pokedex-strategy-workspace` before editing. Prefer an isolated git worktree if convenient; do not overwrite a pre-existing branch or disturb unrelated changes. The parent session has not implemented production changes.

Production companion: https://borrius.ronsanzone.dev . This is the real app, not the older Sites templates “Borrius Team Lab” or “Pokémon Unbound Field Guide”. Never use production saves/services in tests.

## Completeness and precedence

This document was audited against the entire feature discussion after the user requested a completeness check. The build requirements and acceptance gates below stand alone; external artifacts provide visual evidence and source material, not missing instructions. Read the whole document, including the execution appendix.

Precedence: subsequent user instructions > final clean-migration direction and this approved feature scope > older design plan > prototype implementation choices. Mock thresholds, sample teams, partial fight selector and framework are examples, not requirements to preserve. Current repository source is authoritative about existing behavior; documentation can be historical.

A source-only snapshot of the approved mocks is at `/private/tmp/borrius-pokedex-handoff-assets/`, with a checksum manifest. It includes source, local sprites, licenses and locked package metadata, but no private game data, credentials, dependencies or generated output. Use it if the original temp checkout or private hosted page is unavailable. At implementation start, copy durable design notes into the new branch as appropriate so the build no longer depends on temporary files.

The attempted new-session creation was rejected. No implementation session has started and no feature branch has yet been created by this handoff. Do not assume another agent has done part of the work.

## Read these artifacts first

1. Repository `AGENTS.md` and relevant nested instructions.
2. `/private/tmp/borrius-dex-review/public/plan.md` — detailed research, module map, data sources, feature plan and verification cases.
3. Visual mock / review URL: https://borrius-dex-review.ron-sanzone.chatgpt.site . Owner-private; the user can open on their phone. Version 2 includes enemy scouting.
4. Mock source: `/private/tmp/borrius-dex-review/`. Primary files: `app/page.tsx`, `app/profiles.tsx`, `app/enemy-inspector.tsx`, `app/enemy-scout.ts`, `app/globals.css`, `app/mock-data.json`, `app/enemy-data.json`.
5. Repository `docs/build/maintainability.md`, `contracts.md`, `battle-sources.md`, `dex-sources.md`, `type-tools.md`, `theme.md`, and `operations.md` as needed.

Treat the mock as the approved visual/interaction direction, not production architecture. It is a standalone React/Vinext presentation. Implement within the existing strict-TypeScript companion architecture; do not introduce a second React application or change stacks merely to copy it. It uses illustrative species, not the user's saved Pokémon. Its selector intentionally contains only eight gyms plus Maxima, not the requested full catalogue.

## Authoritative changes after the written plan (override older artifacts)

The user explicitly said: “don’t worry too much about backwards compatibility, we prefer to do any migration necessary to keep the code clean. Don’t leave behind old code or patterns just to preserve that.”

Therefore disregard the earlier plan's recommendations for backward-compatible readers, optional legacy fields and long-lived format preservation. Define the clean final model, write explicit migrations preserving meaningful user data, switch every consumer, and REMOVE obsolete fields, fallback readers, duplicate implementations and outdated docs. Verify migrations rather than maintaining two generations of code. Existing unrelated ingestion, pairing and auth behavior must remain intact.

## Approved final build outline

### 1. Unify models and state

Define explicit models for owned Pokémon, hypothetical builds, sourced opponent sets, teams and encounters. Centralize team selection/loading/saving across the workspace. Browser interactions belong in client, persistence/migrations in server, shared contracts/calculations in shared. Migrate stored plans/context when necessary. Do not invent owned IDs for reference Pokémon. Use internal species/form identity, not National Dex ID alone.

### 2. One inspector for either side

Selecting from Dex search, your team OR enemy team opens the same in-page inspector. Show weaknesses, resistances, immunities, all six stats, abilities, items and moves. Keep species base stats, actual saved stats and estimated opponent/build stats explicitly distinct. Retain existing evolution and learnset functionality.

Enemy profiles MUST include useful explainable scouting: fast/mid/slow, physical/special/mixed offense, physical/special bulk, tank/wall potential. Use form-specific base stats and documented moves, including recovery/support; don't infer a wall from Defense alone. Exact enemy combat stats may be estimated, with visible assumptions. Never fabricate observed builds or guarantee turn order. Respect Mega/regional forms and changing states (Minior shield/core is demonstrated in the mock).

The prototype's speed/bulk thresholds are illustrative heuristics, not authoritative game annotations. Document and test the final approach. Show evidence behind labels and surface battle-rule caveats.

### 3. Team workspace on the Dex page

Load current party, saved team or hypothetical draft. Add/remove/replace/inspect members without leaving the page. Load the opposing encounter independently. Six-member cap on player team; enemy scripted sequences may require separate stages. Known owned moves and hypothetical proposed moves must be distinct from the full learnset.

Save teams/build proposals using existing authenticated server persistence, adapting the model cleanly. Maintain selection, draft state, scroll and focus. Desktop: team strips/analysis with persistent detail inspector. Phone: compact search, stacked teams, inspector inline beneath the selected side; tapping brings it into view. The user is reviewing remotely on a phone.

### 4. Chronological encounter catalogue

Reuse the sourced dataset, AUDIT it, and verify chronological progression. Interleave gyms, rival fights, story factions and scripted bosses. Rival events select the player's starter branch plus exact difficulty. Preserve sequences, partner distinctions, optional/postgame grouping and player-order encounters without inventing a mandatory sequence.

Maintain a completeness checklist for major story fights, League and named postgame content, investigating gaps. Source difficulty variants independently; missing Vanilla must never silently become Difficult. Preserve provenance, version, confidence and ordering evidence. Save progression is not reliable automatic next-fight detection. Preserve spoiler controls across names, sprites, scouting, analysis and source labels.

### 5. Strategy analysis

Shared team weaknesses, useful attacks against each foe, incoming threats and coverage gaps. Use known or explicitly proposed ordinary damaging moves, not every learnable move. Reuse/consolidate type calculations and supported variant-specific field mechanics. Unknown typing is unknown, not neutral. Full damage simulation and guaranteed counter/outspeed predictions are not part of this scope.

### 6. Consolidate and verify

Replace overlapping Dex/Planner/Battle Prep implementations with shared components and calculations. Remove redundant surfaces and obsolete code while retaining useful capabilities. Keep a clear single source of state, not duplicate planners.

## Existing code/data findings

Detailed paths and research are in the linked plan. Important facts to verify:

- Dex already has 1,121 species/forms and all six base stats; the new work surfaces defensive/offensive context and team integration.
- Battle dataset has 54 choices and 160 difficulty-specific rosters. Fifteen rival choices represent only five locations with three player-starter branches each.
- Existing `order` is explicitly catalogue order, NOT verified chronology. All Vanilla variants are currently null. Dataset does not prove complete optional/postgame coverage.
- `app/src/client/main.ts` owns team selection and saved plans; `mountDex` currently consumes owned/query only even though active data is passed.
- Existing shared `domain.ts`, `fight-analysis.ts`, `planner.ts` provide reusable arithmetic. Field support includes inverse, Camomons, Strong Winds, some Magnet Rise, heavy rain and Fairy restrictions. Do not regress these.
- Enemy mock references resolve 80 names via exact symbols, including Megas and regional forms; Minior has explicit state choices. Use this as useful reference, not an excuse to hand-edit production generated catalogues.
- Boss workbook exports were recorded by the project on September 5. Prior session used checked-in references, not a fresh extraction. Walkthrough index gives chapter sequence but still needs individual encounter audit.

## Technical best practices accepted by user

Follow AGENTS.md fully. In particular: strict TypeScript, Effect Schema at untrusted boundaries, Effect for typed async failures where useful, plain deterministic game functions, named feature modules and small explicit contracts. No `any`, broad lint suppressions, type assertions substituting for validation, speculative abstractions, or global mutable request state.

Read-only companion: never write to cartridge saves/emulator state. Keep ROMs, private saves, credentials, signing material and generated output out of Git. Preserve upstream licensing/provenance and rebuild generated data from recorded sources.

Use the existing authenticated app and server persistence. Do not weaken owner/device isolation or expose the localhost auth-bypassed Worker through a public tunnel. Feature mounts clean up listeners; background refresh must not interrupt drafts. Unknown data remains unknown.

AGENTS.md requires cross-review of changes to type arithmetic and spoiler controls (also auth/parsing/upload ordering if touched). Arrange the applicable review; review findings must be resolved, not merely collected.

## Verification / completion criteria

Run root `npm run check`, `npm run build`, `npm run test:e2e`. Real local Worker/D1/R2/Queue with synthetic saves only. Android checks are required only if Android changes; no Android work is expected.

Test meaningful behaviors: migrations and preserved saved information; six-slot replacement; saving/loading hypothetical and owned teams; missing snapshot members; exact forms; dual type 4x/quarter/zero and inverse arithmetic; supported field rules; unknown data; exact difficulty availability; starter variants; verified ordering constraints; partner exclusion; enemy inspector selection/reset; role estimate reasoning; spoiler boundaries.

End-to-end flow: search -> load enemy encounter -> load/change own team -> inspect either side -> save/reload without losing state. Browser verification on 360/390px and desktop, keyboard/focus/touch targets, long names, 200% text, overflow and error/empty/loading states. This session is explicitly asked to perform full build and verification, including browser testing.

Deliver completed branch, updated docs/migrations, verification results and accessible review artifacts. Don't stop after implementing only the stat panel or recycling the old non-chronological catalogue. Disclose real source gaps rather than guessing. No production deploy or main merge is requested at handoff.

## Suggested skills

- `create-plan` if a maintained execution plan helps this substantial build; do not turn it into another approval gate for already-authorized implementation.
- `cloudflare:workers-best-practices` (or equivalent local Workers skill) for Worker changes; `wrangler` before Wrangler commands.
- `local-code-review` for branch review; repository cross-review requirements also apply.
- Sites building/hosting only for the separate review artifact if necessary. Production companion is an existing Cloudflare app and should retain its architecture.
- `commit` when creating logical implementation commits. Do not use merge/deployment wrap-up skills without user authorization for those actions.

No production implementation exists yet. Previous work only created/published the separate design review, whose build/type checks passed. Treat this as a fresh implementation context with an approved direction.


## Execution appendix: concrete acceptance contract

The following is the completion checklist. Do not replace it with “looks similar to the mock” or passing only existing tests.

| Area | User-visible acceptance / verification |
| --- | --- |
| Dex lookup | Existing search across species, abilities and learnable moves, type/owned filters, pagination, evolution and learnset links still work. Selecting a result shows defensive matchups and six labeled stats on the Dex page. |
| Defensive data | Separate 4×/2× weaknesses, ½×/¼× resistances and 0× immunities; identify the chart/rules being shown. Unknown identities/typing never display misleading neutral coverage. |
| Offensive strengths | Explain which move types/moves hit foes effectively. Do not equate Pokémon type with a known attack. Proposed coverage uses explicit draft moves; actual coverage uses the selected owned individual's known moves. |
| Player team | Load party and named saved teams, create a draft, add/remove/replace members with max six, save/update/reload. Loading an enemy never overwrites the player team. Team edits update analysis and inspector consistently. |
| Enemy selection | Every revealed enemy slot is selectable. It opens that exact opponent/form's stats and sourced set, not a generic species page or the last player selection. Switching fight/difficulty resets stale enemy selection. Missing roster removes stale details. |
| Enemy scouting | Explain speed tier, offensive orientation and physical/special bulk. Qualify tank/wall potential based on the documented set and recovery/support. Clearly label estimation and evidence; distinguish base/reference values from assumed combat stats. |
| Alternate forms | Resolve Mega, regional and other distinct forms correctly. Minior shield/core estimates change as expected; an unspecified state is disclosed. Generic sprite art must not imply exact form art. |
| Encounter catalogue | Selected fight uses version + exact difficulty + player-starter branch where needed. Source-verified progression interleaves encounter kinds. Optional/player-order groups are labeled. A numeric catalogue ID is not treated as story order. |
| Scripted battles | Partner Pokémon are not enemies; consecutive phases do not become a simultaneous six-Pokémon team. Reveal controls cover phase names and associated analysis too. |
| Spoilers | Start from the existing preference. Typing hints do not leak identities through names, images, accessible labels, speed/role clues or source titles. Explicitly revealing teams/details unlocks the appropriate inspector content. |
| Save state | Persist plans to the existing owner account. Reload shows the saved plan. Missing owned identities after a snapshot change are disclosed and replaceable; no silent reassignment to another Pokémon of the same species. |
| Migrations | Pre-change stored plans/context migrate to the final model before new decoding. User team order/name/membership, shortlist intent and applicable settings survive; references are mapped where IDs change. No silent data wipe. Migration rerun is safe. |
| Desktop | Search, own team, enemy team and analysis are usable on one workspace with a persistent detail column. Keep original red/cream theme, sprites and readable labels. |
| Phone | At 360/390px, compact search and team strips remain usable. Tapping either side reveals/focuses its inline inspector; no navigation away or page-wide horizontal overflow. Avoid hiding the selected detail below a huge results list. |
| Resilience | Loading, missing roster, unknown form, empty team, failed save and failed data fetch have actionable states. Preserve deliberate draft edits through ordinary background refreshes; cleanup listeners on navigation. |
| Code finish | Shared contracts/calculations/state replace duplication; obsolete rendering/state/schema paths removed, docs updated, required verification and cross-review completed. |

### Product boundaries and defaults

- Required: a usable complete Dex strategy workspace with opponent inspection and the verified encounter catalogue; hypothetical draft support is in the approved outline, not an optional stretch goal.
- All six base/reference stats plus explainable qualitative enemy scouting satisfy the approved statistical direction. A numeric battle-stat calculator is not independently required. If you add numeric estimates, expose assumptions and support missing inputs rather than spending the build on a full simulator.
- Main-story major fights through the initial championship are the core catalogue. Audit existing scripted and named postgame fights and document gaps. The user wants all major fights; do not stop at the nine-entry mock or claim the current 54 choices are complete. Ordinary trainers/repeatable facilities are outside the agreed initial catalogue unless needed to resolve a named major-fight omission. Newly discovered ambiguity should be recorded and clarified without blocking independent UI work.
- Missing difficulty data is an allowed unavailable state, not permission to substitute a different team. Research real gaps; if a source cannot establish a roster, list exactly what remains unverified. Distinguish completed software from incomplete source coverage in the final report.
- Consolidating overlapping views does not authorize deleting useful unrelated collection, shortlist, journal, Camp, Type Desk, sync or settings capabilities. Remove duplicated implementation while retaining or relocating the useful behavior. Update navigation and tests to the clean final design rather than leaving a dead old view beside it.
- Use the existing red #b73538 / cream #fffdf4 / paper #f4eedf style as shown by mocks, local pixel sprites, clear stat bars, colored type chips and readable touch controls. No need for a visual redesign or new framework.

### Migration seam verified during handoff audit

Unlike the first handoff, the following persistence paths have now been directly inspected:

- `app/migrations/0001_initial.sql`: plans live in `plans(id, data TEXT, updated_at)`; context in `settings(id, data TEXT)` under id `context`. Stored payloads are JSON, so a contract change may need a data migration even when SQL columns stay the same.
- `app/src/server/planning.ts`: `savePlan` handles POST writes; defaults shortlist to member IDs, validates distinctness and inclusion, and upserts plan JSON. `saveContext` currently preserves omitted fight fields by reading `PreviousFightContext`. Replace old semantics deliberately with the final contract; don't mistake this legacy preservation for a required new pattern.
- `app/src/server/schemas.ts`: `PlanRequest`, `ContextRequest`, `PreviousFightContext` are server input boundaries. Current member cap is six and shortlist cap 24. Shared output/storage schemas are in `app/src/shared/types.ts`.
- `app/src/server/state.ts`: `readState` synchronously decodes all stored plan/context JSON using shared schemas. Merely changing the schemas without migrating existing JSON can break the whole state endpoint. Stage migration before relying on the new decoder.
- `app/src/server/browser-routes.ts`: routes `/api/plans`, `/api/plans/:id`, `/api/context` and state handling. Update producers, consumers and schemas together.
- `app/src/client/planner-storage.ts` and `app/test/planner-storage.test.ts`: browser draft storage also exists; do not overlook it when changing server-backed plan shapes. Inspect its version/key strategy. A one-time local draft migration or explicit obsolete-draft handling can keep the new runtime clean; do not silently lose a user's active draft.
- `app/src/client/main.ts`: active IDs, shortlist, selected plan and user-context mutations currently live here. Inventory subscriptions/events so the new workspace has one state owner and no stale duplicated state.

Implementation choices remain yours: final type names, exact module boundaries and SQL/typed migration mechanism were not dictated. Keep old-schema interpretation confined to migration tooling/tests, not every runtime read. Preserve source migration history for fresh database setup; “remove old code” does not mean deleting needed migration history or upstream vendor code. Include a recovery/backup procedure for an eventual production migration, but do not execute against production during this build.

### Concrete source leads and data cautions

- Difficult 2.1.1.1 workbook: https://docs.google.com/spreadsheets/d/1_HF-bxEfamTW8S3q7tLjHWWPjo9E1QLS5dtMIhJHoeY/edit
- Expert 2.1.1.1 workbook: https://docs.google.com/spreadsheets/d/1yl1AXKfarFb8_8-iF8We9zmLB135kxJ82yOGQDoMHOs/edit
- Insane 2.1.1.1 workbook: https://docs.google.com/spreadsheets/d/1pLTQKQkWTnSkev4_kcjHbY0AkBujbTUDybxXFNZ_aVY/edit
- Walkthrough chapter index: https://unboundwiki.com/walkthrough/ . Follow individual chapter evidence for exact ordering. Index alone is insufficient.
- Repository ignored `.cache/battle-research/` currently contains `difficult.xlsx`, `expert.xlsx`, `insane.xlsx`, `build.py`, `catalog.json`. These are source research inputs, not private saves. Review the extraction script, make production data generation reproducible where appropriate, and keep licenses/provenance.
- `docs/build/battle-sources.md` records hashes, worksheet/row provenance, partner exclusions, branch splits and scripted battle limits. Do not lose those safeguards when reshaping data.
- `scripts/dex-build.mjs` and `docs/build/dex-sources.md` describe pinned reference generation. Don't swap in a generic modern Pokémon API table that may differ from Unbound.
- Move order matters for Camomons. Blank abilities/items/moves are unknown, not proven absent. “Level at cap” is reference level basis, not a guaranteed current opponent level.

### Verification map and safe development flow

1. Inspect root/app scripts and current test conventions. From repository root, `npm run setup` uses locked dependencies via `npm --prefix app ci` when installation is needed.
2. `npm run check` covers type generation/typecheck, lint, formatting and unit tests. `npm run build` verifies client and Worker bundles; it is not a production deployment.
3. `npm run test:e2e` delegates to app and runs `app/tools/reset-e2e.mjs`, then Playwright. The reset removes ONLY disposable `app/.wrangler/e2e`. `app/playwright.config.ts` starts its own Worker on 127.0.0.1:8787, applies local D1 migrations and sets `reuseExistingServer: false`. Do not run another dev server on that port during E2E or point tests to production.
4. Relevant existing suites: `app/test/contracts.test.ts`, `reference-contracts.test.ts`, `domain.test.js`, `fight-analysis.test.js`, `battle-data.test.js`, `dex.test.ts`, `planner.test.js`, `planner-storage.test.ts`, `type-tools.test.ts`, `server.test.ts`, and `test/e2e/companion.spec.ts`. Extend appropriate suites; don't just preserve tests that assert an obsolete layout.
5. New migration tests must use representative pre-change JSON rows in local D1, run the actual migration and then exercise the new readState/save round trip. Include omitted older optional fields and duplicate/repeated application handling.
6. Browser-test the new interactions and responsive states with synthetic data, not only arithmetic or static rendering. Record actual checks and failure fixes. Previous mock validation was TypeScript/build plus scouting assertions; it was NOT a completed browser interaction/visual QA pass. Do not inherit a claim of visual verification from the mock.
7. Arrange independent cross-review for changed type arithmetic and spoiler controls per AGENTS.md, and a final branch review. Resolve actionable findings and rerun affected checks. Do not repeatedly run the entire suite without a change or unresolved failure motivating it.

### Suggested execution order and final deliverables

Start with a short repository inventory and durable execution checklist on the new branch, then final contracts + migrations, shared inspector/scouting, team state/persistence, encounter normalization/timeline, integrated analysis and responsive UI, cleanup/docs, full verification and review. Chronology/source research can proceed alongside implementation when tools and applicable instructions allow it. Finish all authorized work rather than pausing after each phase to ask approval again.

Final deliverables should identify the branch and implementation commits (if committed), summarize the completed user flows, list migrations and their local verification, report actual check/review outcomes, and link phone-accessible review artifacts. Report every material data gap and unsupported mechanic accurately. Do not claim deployment, full roster completeness or guaranteed battle outcomes without evidence. The user should be able to review and drive the normal Codex task throughout.
