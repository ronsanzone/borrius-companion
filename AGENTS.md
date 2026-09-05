# Working on Borrius Companion

- This is a read-only game companion. Never write to cartridge saves or emulator state. Keep ROMs, saves, credentials, signing material, and generated build output out of Git.
- App runtime code belongs in `app/src`: `client` owns browser features, `server` owns Cloudflare I/O, `shared` owns contracts and pure game calculations, and `parser` owns binary decoding. Static/reference assets live in `app/public`.
- Use strict TypeScript for handwritten application code. Decode untrusted JSON with Effect Schema at the boundary. Use Effect for typed failure handling and I/O orchestration where it adds clarity; keep deterministic calculations plain functions.
- Keep behavior in named feature modules with small, explicit public contracts. Avoid global mutable state shared between requests and avoid speculative abstractions.
- Oxlint includes the vendored `dmmulroy/anti-slop` generic and Effect rules. Do not weaken checks, use `any`, suppress TypeScript, or cast around missing contracts. Any necessary boundary-specific lint exception must name the invariant and remain local.
- Generated reference tables and upstream parser helpers are isolated under `public/data` and `src/vendor`. Preserve provenance/licenses; regenerate data from its recorded source rather than hand-editing it.
- Before finishing, run `npm run check`, `npm run build`, and `npm run test:e2e` from the root. Browser tests exercise a real local Worker/D1/R2/Queue with synthetic saves; do not point them at production. Changes to Android also require its unit tests and lint.
- Cross-review behavior-sensitive changes to upload ordering, authentication, parsing, type arithmetic, and spoiler controls. Tests must cover observable behavior and real boundaries, rather than mirroring the implementation.
