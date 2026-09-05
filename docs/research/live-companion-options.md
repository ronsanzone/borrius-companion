# Borrius live companion: research and options

Research date: September 4, 2026 (Pacific). This is a proposal, not an implementation or deployment. Existing cloud configuration was inspected in local code and prior task history; current Cloudflare billing, live policies, and resource availability were not audited.

## Recommendation

Build a small native Android save courier, a private Cloudflare application, and a snapshot-based playthrough model. Start with quiet periodic synchronization and a useful “Since you last played” dashboard. Add an optional faster play-session mode after measuring Android behavior on the Retroid. Use incoming uploads to trigger processing; reserve cron for reconciliation and retention.

The user experience should be: play, save normally, and open the site later to find the current team, meaningful changes, available preparation options, and a short reminder of where to go next. The system observes completed game saves. It cannot reconstruct every battle, decision, or movement between them.

## Evidence from this setup

- Retroid Pocket Classic, Android 14; most recent Unbound launch uses mGBA. Filename indicates Unbound 2.1.1.1, not independently verified from a ROM/version screen.
- Save is 128 KiB at `/storage/emulated/0/RetroArch/saves/mGBA/Pokémon Unbound (v2.1.1.1).srm`. This lies outside Android/data, making a user-granted folder access approach promising. ADB access does not itself prove an ordinary Android app has access.
- Current global RetroArch settings: `autosave_interval = 10`, `savestate_auto_save = true`, `savestate_auto_load = true`. Per-content overrides and actual save-flush behavior still need measurement. SaveRAM flushing persists cartridge memory; it does not press the game's Save button.
- PUSE decoded six party Pokémon and 85 box records. Party identities/levels and Gliscor's ability, moves, move uses, experience, and stored stats match device screens. Full box validation, identifiers, malformed-file handling and other build fields remain unfinished.
- An additional experimental PUSE progress read suggests four badges and three Heart Scales. These are hypotheses awaiting in-game verification. Its reported level cap is a table-derived value; `difficulty_flag_known` is false. It does not establish the current boss or map location.
- Borrius Team Lab source has been retrieved in `companion-app/`: editable static HTML/CSS/JavaScript. It includes active/bench toggles, team templates, column ordering, standard/inverse analysis, candidates, and gym/story views. Role counts are based on labels/base stats; Pokédex queries use PokeAPI. This is not yet a version-specific Unbound mechanics database.
- Saved teams and preferences are held in browser localStorage. User decision: do not migrate them. Start the new site with fresh preferences and no existing templates, using imported Pokémon as the roster foundation. Preserve useful functionality, not old browser data.
- The prior task “Review Cloudflare access security” and `/Users/sanzoner/code/oura-dashboard` show a Worker serving static assets, D1, Cloudflare Access identity validation, a separate authenticated ingress hostname, rate limits and a reconciliation cron. Reuse those patterns with separate resources and credentials; do not couple Pokémon storage to Oura health data.

## Android options

| Option | Experience | Strength | Limitation |
| --- | --- | --- | --- |
| Quiet native courier — recommended first | Select save folder and pair device once; periodic Wi-Fi uploads; Sync now button | Small UI, durable retry, no Mac needed | WorkManager periodic interval is at least 15 minutes and scheduling can be delayed; not every intermediate save is captured |
| Native courier with Play session mode | Start a session, play normally, stop afterward; visible ongoing notification | Can sample more often while service is active; richer history | Battery/notification tradeoff; background-start and service limits; test on Retroid rather than promise a seconds-level guarantee |
| Mac bridge prototype | Retroid transfers to an awake Mac; Mac forwards to cloud | Reuses known ADB reader and tests pipeline quickly | Mac and connection become dependencies; unsuitable as final away-from-home solution |

A browser-only dashboard is useful for viewing and manual import. It should not be the background file collector on Android. A native Kotlin app can use the Storage Access Framework to request only the selected folder and retain its permission. Read-only access is sufficient. If a provider replaces a file rather than updating it, a directory grant is generally a better starting point than a single-file grant; this needs device testing.

WorkManager handles recurring work and retries. Configure network constraints, then check Wi-Fi transport if strict Wi-Fi-only behavior is required: “unmetered” and “Wi-Fi” are different conditions. Provide clear states: permission lost, waiting for Wi-Fi, upload pending, upload accepted, and processing failed.

A session service can periodically read through the selected document URI. Do not assume FileObserver works on arbitrary document-provider URIs or that a file event can wake a killed app. On Android 15+, apps targeting that version face a six-hour aggregate daily dataSync foreground-service limit. This Retroid runs Android 14, but the design should survive later OS updates. Do not depend on a perpetual hidden service.

Sources: [Android document access](https://developer.android.com/training/data-storage/shared/documents-files), [WorkManager scheduling](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work), [Android 15 service changes](https://developer.android.com/about/versions/15/behavior-changes-15), [RetroArch configuration](https://raw.githubusercontent.com/libretro/RetroArch/master/retroarch.cfg).

## Cloud architecture options

### Lean pipeline

Worker receives an authenticated upload, stores original bytes in private R2, records ingestion state in D1, and parses inline if benchmarks show it fits the runtime budget. A scheduled task retries durable pending records. Few moving parts, but careful timeout/retry handling is required. Never use an untracked background promise as the sole processing guarantee.

### Event-driven pipeline — preferred foundation

Android → authenticated upload Worker → private R2 → Queue → parser Worker → D1 → dashboard.

An R2 object-created notification can trigger the queue, avoiding a request that must both save and enqueue successfully. Queue messages carry object references, not the full save. Queue delivery is at least once and ordering is not guaranteed: processing must be idempotent and “latest snapshot” must not mean “last job that finished.” Use cron to find stuck/unprocessed objects, recover missed work, and apply retention. The dashboard can refresh when opened and poll modestly while visible; WebSockets and Durable Objects can wait until they solve an actual interaction need.

### Expanded coaching pipeline

Keep raw ingest/parsing as above. Add a separate optional job to produce a structured session recap or explain deterministic findings. An explanation failure must not block roster updates. Store the parser, mechanics data, and explanation versions separately so retained saves can be reprocessed without being uploaded again. Workflows become useful if enrichment genuinely needs multiple durable steps; they are not required for basic ingestion.

Sources: [R2 event notifications](https://developers.cloudflare.com/r2/buckets/event-notifications/), [Queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/).

## Secure pairing and upload

For one device, the first implementation can use a dedicated revocable upload credential. Pair it after the owner signs into the private dashboard; exchange a short-lived, single-use code, with expiry and attempt limits, for a device-scoped credential. No Cloudflare account API token or R2 account key belongs in the APK.

Two viable approaches: a Cloudflare Access service token scoped to a separate upload application, or an application-issued device credential checked by the Worker. The former follows an existing Cloudflare pattern; the latter permits a smoother custom pairing flow and narrow per-playthrough rights. Either approach must authorize only upload and its own receipt status, not dashboard reads, administrative actions, deletion, or save write-back. Protect stored credentials using an Android Keystore-backed key. A later version could register a device-generated signing key; that increases protocol work and is unnecessary for the first single-user trial.

Use HTTPS, request size limits, token revocation, deduplication and bounded rates. Server-side validation remains necessary even for this user's device. Keep raw saves out of static assets, public repositories, logs and model prompts. Human browsing uses owner-only Access; machine uploads must not depend on expiring browser cookies. Validate Access tokens at the Worker and avoid alternate unprotected origins, following the Oura pattern.

Sources: [Cloudflare service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/), [Android Keystore](https://developer.android.com/privacy-and-security/keystore).

## Correct snapshot behavior

1. Sample a stable candidate: wait after apparent changes, make a private local copy, compare bytes across reads, then validate supported size/structure/checksums. Stable bytes alone do not prove a valid save.
2. Keep a durable local upload queue with capture sequence and timestamps. Retry after network loss. Sampling every 15 minutes can miss files overwritten between samples; only a faster observer can retain those intermediate versions.
3. Store raw blobs by content hash for deduplication, but record observations separately. Returning to a previously seen hash can be meaningful after loading a save state.
4. Distinguish capture time, receive time, parse completion time, device sequence, save counter and game playtime. Device clocks and save counters are not reliable global clocks.
5. Keep imported facts, player plans, inferred events and manual corrections separate. Match individual Pokémon using validated identity fields; preserve ambiguous duplicates.
6. Dedicated rewind detection and save-state analysis are out of scope for now. The application only reads cartridge-save copies and never edits, restores or writes back game data. Show the latest successfully validated captured snapshot, retaining basic duplicate/out-of-order upload handling. Do not invent a loss, trade, release, or evolution merely from differences in species counts.
7. Reject or quarantine bad snapshots while retaining the last valid dashboard state. Show the last good save time and processing status so stale data is visible.

## What the save can tell us

| Capability | Present evidence | Product use |
| --- | --- | --- |
| Actual party/builds | Partially verified on device | Current team, actual coverage, build-aware preparation |
| Boxes | Experimental decode | Search owned alternatives before recommending catches |
| Badges, selected unlocks, bag/TMs | Upstream parser support; unverified on this save | Progress summary and feasible preparation checklist |
| Difficulty and cap | Difficulty explicitly unknown; cap derived | Manual confirmation retained until validated |
| Map/checkpoint/mission state | Not implemented in inspected progress reader | Research flag/location mapping against known checkpoints |
| Exact battle turns and causes | Not available from ordinary snapshots | Optional player notes or later explicit capture integration |

Automatic “where am I?” should combine validated badge/quest flags, map identifiers when mapped, key items and history. It should offer a likely next objective with evidence and an easy correction. Exact trainer data also needs version/difficulty validation. Missing flags must remain unknown rather than inheriting upstream false/zero fallbacks as facts.

Parser source: [PUSE at the inspected commit](https://github.com/Zannael/PUSE/tree/eb1ac0094c97f9c406fdd26066b4638676fbd3c3), especially `frontend/src/core/gameProgress.js`.

## Product directions

### 1. Playthrough journal

A “Continue playing” home view: last trustworthy snapshot, team, recent changes, next objective and preparation checklist. A timeline highlights newly observed catches, move changes, item changes and confirmed milestones. Keep raw snapshots accessible beneath meaningful events. A recap says “first seen in this snapshot” when the capture time cannot establish when a catch occurred.

### 2. Living team workshop

Preserve the current Team Lab as a workspace beside Current Party. Let the user branch a planned team from any snapshot, keep favorites, enforce selected hard constraints, and compare a travel team with a temporary boss team. A plan can become stale when the real Pokémon learns or loses a move; mark that dependency explicitly. Offer minimal changes ranked by impact and preparation effort.

### 3. Opportunity radar

Detect when a new catch, evolution, move or item makes an old problem easier. Instead of generic “catch something stronger,” surface a small change using an owned Pokémon and an accessible resource. A wishlist can become actionable when a prerequisite is validated. Availability must be sourced, not inferred from an unverified story estimate.

### 4. Preparation with time budgets

Offer “five minutes before the boss” versus “I want to train for a while.” The same roster produces different checklists. State who leads, who must stay healthy, safe versus situational switches, and one concept to practice. All numerical claims come from supported deterministic calculations.

### 5. Team biographies and session reflection

Show a Pokémon's observed move/evolution/team history and why it was included in saved plans. Optional quick post-battle notes record “outsped,” “switch took too much damage,” or “enemy setup.” These enrich learning without pretending the save contains a replay. Count “present in saved parties,” not battles won or kills.

### 6. Adaptive exploration companion

A spoiler-aware regional checklist of reachable catches, move tutors, evolution resources and open quests. Hide undiscovered opponents even from recommendation explanations. This is attractive but depends heavily on reliable world data and progress mapping, so build it after the journal and team workshop.

A possible main navigation is Today / Team Lab / Prepare / Journey. Today shows sync freshness, current party, changes and the next useful action. Existing type matrices, templates, candidate constraints and gym/story pages remain available and gain snapshot context.

## Cost and migration

At 100 unique 128 KiB snapshots/day, raw growth is about 12.5 MiB/day or 375 MiB per 30 days before retention. Storage is small; parsing runtime, request volume, retries and optional AI calls matter more. Workers Paid currently has a $5/month account minimum plus usage. The account may already have a plan, but that has not been checked. R2, D1, Queues and any AI usage need a final estimate against actual existing allowances. Do not promise a free deployment.

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/).

Move the existing static application into a new project in the user's Cloudflare account, preserving the original Site until verified. Reuse its UI initially. Do not export or migrate existing `borrius-*` browser storage. Start the new site with the real imported roster and empty templates/preferences. Preserve the ability to create new hypothetical teams and keep them separate from the imported current party. This decision does not request deletion of the old Site or its browser data. Adopt versioned Unbound data incrementally and retain MIT notices for any PUSE code reused.

## Smallest experiment that resolves the largest risks

Build a disposable, read-only Android prototype that selects the real folder and reports content hashes locally. Test while RetroArch is active, after an in-game save, after screen-off, after reboot, and across Wi-Fi loss. Measure whether the global ten-second save flush operates for this content and how WorkManager behaves on this Retroid. No cloud upload is needed for this test.

Then implement one authenticated upload of a copied save into separate Cloudflare test resources, parse it, and show a private timeline entry. Test duplicate delivery, truncated writes, revoked tokens, missed jobs, and out-of-order completion. Save-state/rewind-specific behavior is deferred. Only after this works should the existing dashboard migrate and coaching expand.

Recommended product order: automatic snapshots + journal → actual-build Team Lab + one verified boss → opportunity radar + broader progress detection. Session mode is an optional enhancement driven by observed freshness needs.

## User scope clarification

The companion is strictly read-only analysis of the game. No save editing, restoration, write-back, or emulator-state manipulation is planned. Dedicated rewind handling is deferred. Existing templates and preferences need no migration; start fresh on the new site with actual imported Pokémon while retaining useful Team Lab functionality. The existing Site is not deleted by this decision.
