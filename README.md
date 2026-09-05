# Borrius Companion

A private Pokémon Unbound playthrough dashboard backed by real cartridge saves. Borrius Courier on the Retroid reads a selected save and uploads stable copies over Wi-Fi; Cloudflare validates and analyzes them. The game save, emulator settings, and save states are never edited.

- **Dashboard:** https://borrius.ronsanzone.dev — owner login through Cloudflare Access.
- **Courier upload origin:** https://borrius-sync.ronsanzone.dev — device pairing/upload only.
- **Installable Courier:** `android/dist/borrius-courier.apk` — locally signed, non-debug release.

The site provides actual party/box builds, standard and inverse type analysis, team plans, snapshot history, observed changes, notes, and manually supplied story context. It starts fresh; previous ChatGPT-site templates are not migrated.

## Use

1. Open the dashboard and sign in. Create a one-time device pairing code.
2. Open Borrius Courier on the Retroid, enter the upload origin and code, and select the Unbound save using Android's file picker.
3. Tap **Sync now**. A successful setup produces a **ready** receipt and a matching dashboard snapshot.
4. Continue using Unbound's in-game **Save** menu. Courier checks in the background on eligible Wi-Fi, approximately every 15 minutes; Android can delay it. Use **Sync now** when immediate freshness matters.

The signed release is installed with a verified read-only folder grant. Production pairing and the first ready snapshot succeeded on September 5, 2026 (UTC), showing six party members and 85 boxed Pokémon. The next periodic job is registered; longer background/reboot/Wi-Fi behavior still needs observation. See [device verification](android/DEVICE-VERIFICATION.md) for recorded checks.

## Develop

```sh
cd app
npm ci
npx wrangler d1 migrations apply borrius-companion --local
npm test
npm run dev
```

Local development is bound to `127.0.0.1:8787` and bypasses owner login; do not expose that mode publicly. Run `npm run build` for a production dry run. Android instructions are in [android/README.md](android/README.md).

## Scope and limits

Only 128 KiB **Unbound 2.1.1.1 cartridge saves** are supported, not emulator save states. The current sample's six party members and 85 boxed Pokémon decode. PC coverage is boxes 1–18 and slots 1–22 of box 19; later storage is not established as empty. Progress is experimental, while difficulty, level cap, location, and next objective require user context. Move metadata comes from the verified device ROM; conditional battle mechanics are not simulated.

See [operations](docs/build/operations.md) for architecture, deployment, security, recovery and verification, and [parser provenance](app/src/vendor/README.md) for format and catalog evidence.

## Battle and reference tools

Battle prep now covers 54 gym/major-battle entries with 160 sourced Difficult/Expert/Insane variants. Pick your actual difficulty and fight, then choose Typing hints, Reveal team or Full details. Save a next fight to reopen it from Camp; add promising owned Pokémon straight to the planning shortlist. Vanilla rosters remain unavailable, and reference levels may scale in game.

Pokédex searches 1,121 Unbound reference species/forms with base stats, abilities, evolutions and learnsets. Type Desk supports solo defense and attacking coverage, including all 171 single/dual typings and inverse rules. Reference learnsets describe potential moves, not those known or obtainable in your current save.
