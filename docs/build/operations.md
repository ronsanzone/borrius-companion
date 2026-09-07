# Borrius Companion operations

## System

Production dashboard: https://borrius.ronsanzone.dev . Machine upload origin: https://borrius-sync.ronsanzone.dev . Both route to the `borrius-companion` Worker. The dashboard uses the configured owner-only Cloudflare Access policy and Worker JWT validation. The upload host exposes device pairing, upload, and own-receipt endpoints only.

```text
Retroid read-only URI → stable private save copy → authenticated upload
    → private R2 raw snapshot → Queue → validated parser → D1 → dashboard
                                      ↑
                       10-minute scheduled reconciliation
```

R2 bucket `borrius-saves` stores content-addressed cartridge copies. D1 database `borrius-companion` stores devices, one-time pairings, processing status, decoded snapshots, observed changes, team plans and notes. Queue `borrius-ingest` processes one message per batch, retrying transient failures; a scheduled job every 10 minutes re-enqueues pending/expired-lease work and clears expired pairing/rate-limit rows. Parsing is triggered by uploads, not delayed until the scheduled job.

An existing capture ID can be retried without creating another snapshot. Device sequence numbers prevent delayed older captures from replacing newer ready captures on that device. Invalid saves receive `failed`; they never replace the latest valid snapshot. Events describe observations between captured saves, not a complete record of gameplay or proof of when a catch occurred.

## Daily use and installation

The signed sideload release is `android/dist/borrius-courier.apk`, package `dev.borrius.courier`. It is already installed on the connected Retroid. For future compatible updates use the same signing key:

```sh
adb install -r android/dist/borrius-courier.apk
```

Sign in to the dashboard, create a pairing code, then enter the provided upload origin and code in Courier. Codes expire after 10 minutes and are single-use. Android's picker must grant read access to the RetroArch save folder; select the `.srm`/`.sav` cartridge file, not a state. The verified device folder was `primary:RetroArch/saves/mGBA`. Tap **Sync now** and confirm both a **ready** receipt and the expected party on the dashboard.

Continue saving from Unbound's in-game menu. RetroArch SaveRAM flushing persists game-saved memory; it does not save ongoing gameplay for you. WorkManager requests periodic checks at a 15-minute minimum with unmetered networking and battery-not-low; runtime also requires validated Wi-Fi. Android may defer execution. Manual sync captures a stable copy before checking Wi-Fi and can queue it offline. Background work only observes saves present at check time; intermediate in-game saves may be missed.

Two reads 600 ms apart must match and be exactly 128 KiB. Private pending copies retain capture IDs/sequence across retries and restart, with a 128-entry bound. Ready copies are retired locally; failed analysis copies remain in private failed storage. Force-stopping Android suspends background work until Courier is launched again. Foreground session mode, rewind interpretation, save-state handling, and old-template migration are not implemented.

## Build and deploy

Web prerequisites: Node/npm and authorized Wrangler access to the configured Cloudflare account. Existing production resource IDs, routes, Access audience and identity settings are in `app/wrangler.jsonc`. Resource identifiers are configuration; device bearer tokens and signing keys are secrets.

```sh
cd app
npm ci
npm test
npm run build
npx wrangler d1 migrations apply borrius-companion --remote --env production
npm run deploy
```

`npm run build` is a production dry run and writes the bundle to ignored `app/dist/`. Deploy serves `app/public/` through the Worker before assets, so authentication also guards the static dashboard. Production disables workers.dev and preview URLs. Preserve `DEPLOYMENT_MODE=production`, owner JWT validation, Access audience, allowed owner identity, and the two hostname boundaries when changing config. A fresh-account installation additionally requires creating the matching D1/R2/Queue resources, DNS/custom domains and owner Access application; the existing account already has them.

For local development:

```sh
cd app
npx wrangler d1 migrations apply borrius-companion --local
npm run dev
```

The default local mode binds `127.0.0.1:8787` and intentionally does not require Access. Keep it local. In a second terminal, run `npm run test:integration` from `app/` against that server to exercise the local pipeline. It uses a synthetic six-member party and four boxed Pokémon and creates local test data. Set `BORRIUS_TEST_SAVE` to an ignored local save path for an additional private-fixture check. `npm run test:e2e` starts an isolated local Worker and runs the pipeline plus browser interactions.

Android uses JDK 17, SDK/build tools 35 and Gradle 8.13. From `android/`:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
./.tooling/gradle-8.13/bin/gradle assembleDebug testDebugUnitTest lintDebug
./sign-release.sh
```

The local signing material is in ignored `android/.tooling/signing/`. Back it up securely for future update compatibility; do not commit it. A different signing key cannot update the installed app in place. See the Android README for toolchain details.

## Privacy and access

Courier persists only a read URI grant, with no broad storage/write permission, and never changes game files. It stores device credentials with an Android Keystore-backed AES-GCM key; Android backup is disabled. TLS is required and redirects are rejected. Each device has a revocable upload-only token; the server stores a token hash. Revoke a lost device in the dashboard, then generate a fresh pairing if needed. Device receipts are restricted to their device. Pairing codes and bearer tokens should not be pasted into logs or issue reports.

Saves contain gameplay and trainer metadata. Full raw saves are privately retained in R2 and decoded copies in D1. There is currently no automatic save-retention expiry or owner deletion UI; scheduled cleanup only removes expired pairing/rate-limit records. Keep administrative Cloudflare access restricted. Cloudflare observability records operational events; the application does not deliberately log bearer tokens or full save bodies. No external AI service receives saves. The full ROM was read locally for catalog extraction only and remains ignored in `.cache/`; it is not deployed or uploaded.

## Parser evidence and limitations

The layout/catalog adapter derives from MIT PUSE commit `eb1ac0094c97f9c406fdd26066b4638676fbd3c3`. Internal species IDs are distinct from National Dex IDs. The selected complete newest bank must pass signature, section-ID, consistent-counter and documented sector-checksum validation; a torn newest bank is rejected rather than silently replaced with stale data. This Unbound layout has no usable standard per-Pokémon checksum, and bytes outside documented checksum coverage do not gain an integrity guarantee.

Coverage includes the party and the 562-record PC stream: boxes 1–18 plus box 19 slots 1–22. Other PC regions remain unsupported; their empty returned lists are not evidence of emptiness. The private sample's 85 boxed Pokémon all fall within boxes 1–4. Boxed current PP and battle stats remain null. Candidate identity uses original-trainer ID plus personality and marks duplicates ambiguous; it is not a guaranteed permanent identity.

All 922 moves have bounded type/power/accuracy/category metadata extracted from the actual device ROM. Its CRC32 `4B3D4957`, MD5 `9CAD8E771940E7F7094D13911552CEF0` and SHA-1 `B4776B82A4C7915D0FADEAA27E013523F99DFD94` match libretro's Unbound 2.1.1.1 entry. This verifies the inspected ROM, not the version of every future uploaded save. The importer still relies on an explicit 2.1.1.1 selection. Accuracy null means a special/bypass rule; power null means variable/fixed damage. Dynamic move types, conditional power, abilities, weather and battle scripts are not a simulated battle engine. Source links, extraction offsets and hash-gated reproduction are in `app/src/vendor/README.md`.

Badges, champion flag, money, Heart Scales and TM ownership remain experimental. Difficulty, cap, current location, quests and next boss are not decoded reliably and must not be presented as established facts. Gliscor's detailed values were independently verified on-screen; initial report observations for several other HP values differ from the saved bytes, so those broader observations are not validation of every statistic.

## Verification status and recovery

Completed recorded checks: 14 tests (11 parser and three coaching regressions), including active-sector corruption, malformed/truncated input, torn bank, duplicate identity, real Gliscor fields and ROM metadata; Android's four unit tests, assemble/lint, release signature and non-debug installation; actual persisted read-only folder grant on Android 14. Production Worker/custom domains and owner Access are deployed. The local integration script covers pairing reuse, authentication, queue parsing, duplicate retry, corrupt isolation, out-of-order arrival, receipt isolation, revocation, plan CRUD and cross-origin protection; use its explicit PASS output as evidence of a completed run.

Production end-to-end verified September 5, 2026 UTC: pairing at 04:00:47 and a ready snapshot at 04:00:49 containing six party members and 85 boxed Pokémon. Courier completed its natural receipt retry, and Android registered the next periodic job in 14m59.966s with all constraints met. Live dashboard plan save/reload, search, inverse rules, notes and snapshot comparison were verified. Still requiring real-world observation: a changed save reaching the dashboard automatically while Courier is backgrounded, normal device reboot, and Wi-Fi disconnect/reconnect. Do not treat an installed APK, a successful build, or a manual import as proof of those behaviors. Update `android/DEVICE-VERIFICATION.md` with actual observed results.

If a receipt stays pending, check Queue delivery and Worker logs; reconciliation will re-enqueue pending or expired leases. A failed validation receipt calls for a new clean in-game save and **Sync now**, preserving the failed original for diagnosis. Repeated authentication failure calls for checking device revocation/pairing, not relaxing the upload boundary. A stale dashboard calls for checking the displayed capture time, Courier status, Wi-Fi eligibility and Android scheduling before assuming current gameplay was captured. Never fix a synchronization issue by editing the game save or emulator state.

Final production release: `89c12401-22ed-4d43-91dc-87395f26d951`, parser `unbound-readonly-3`. The original production snapshot was reprocessed successfully from its unchanged private R2 copy to correct accented names; no extra snapshot or game-file write was created. Anonymous dashboard, API and assets redirect to Access; upload-host dashboard routes return 404 and unauthenticated device receipts return 401. Final browser inspection reported no JavaScript errors.

Battle/reference release aaf47067-5d59-492f-b34e-142f9ba13542 deployed September5,2026. Production verified #prepare (54 sourced entries), #dex (1121 reference species/forms), #types. 37 unit tests and integration exercise passed, including next-fight context persistence/backward-compatible context updates. Browser QA covered exact difficulty selection, inverse fight, spoiler suppression/reveal, full reference sets, save/reload, Joltik search/details, all171 type combinations, mobile nooverflow, no JavaScript errors. Sources remain community documentation; Vanilla boss rosters unavailable. Ability/item/damage/turnorder simulation remains out of scope.


## Strategy workspace migration

Before deploying the strategy feature, follow the backup/write-pause/migrate/verify procedure in [strategy-workspace.md](strategy-workspace.md). Migration 0003 changes stored JSON contracts; roll back data and app together if recovery is necessary. Local Playwright startup seeds only disposable legacy rows and reapplies the actual migration twice to verify idempotence. Production writes/deployment require separate authorization.
