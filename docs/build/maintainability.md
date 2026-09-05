# Source structure and verification

Borrius keeps the Android courier, Cloudflare Worker, and browser in one repository. The refactor preserves the HTTP endpoints and stored save/plan/context format. Existing devices remain paired and no game files are modified.

## Module ownership

- `app/src/index.ts`: Cloudflare handler entry points and host routing.
- `app/src/server/`: HTTP boundaries, owner/device authentication, request schemas, routes, persistence, ingest, processing, and journal events.
- `app/src/shared/`: shared Effect schemas and deterministic type, battle, and planning calculations.
- `app/src/parser/`: sector validation, Pokémon decoding, and read-only save orchestration.
- `app/src/client/`: application lifecycle, HTTP client, validated browser state, DOM helpers, and independently owned feature views.
- `app/public/`: static styles, sprites, and reference data. Vite builds the browser into ignored `app/dist/client`; Wrangler bundles the Worker separately.
- `app/src/vendor/`: pinned upstream binary helpers and generated reference tables with precise TypeScript declarations. These are intentionally preserved with their provenance and licenses.
- `android/`: the existing native Java courier and its tests.

Effect is used for runtime schemas and explicit asynchronous failure handling at HTTP and parsing boundaries. Pure game arithmetic remains ordinary typed functions. Cloudflare bindings are generated from Wrangler configuration rather than copied by hand.

## Quality commands

From the repository root, `npm run setup` installs the app's locked dependencies, `npm run check` runs TypeScript, lint, formatting and unit tests, and `npm run build` verifies both production bundles. `npm run test:e2e` starts local Wrangler with isolated D1/R2/Queue state and exercises the save pipeline and browser.

For browser iteration, run `npm run dev` to build and serve the Worker. In a second terminal, `npm --prefix app run dev:client` runs Vite with hot reload and proxies API requests to the local Worker.

From `app/`, `npm run format` applies Prettier. `npm run test:lint-rules` runs the upstream rule regression suites. Keep `oxlint` and `@oxlint/plugins` pinned to the same version. The vendored plugin's source revision and license are in `app/tools/oxlint/anti-slop/UPSTREAM.md`.

CI runs app quality checks, production dry run, synthetic upload/browser integration, and Android unit/lint/build checks. It requires no production credentials or private saves. Browser traces and screenshots are retained only on failure. Generated fixture content is synthetic; optional real-save parser checks remain local when the ignored save exists.

## Changes that need care

Changing schemas requires checking existing snapshot JSON and older saved plans/context, including omitted optional shortlist and fight fields. Do not replace absent information with invented values. Save ingestion must preserve capture idempotency, device isolation, late-arrival ordering, and retry recovery. The source game file stays read-only.

Anti-slop rules are enabled for handwritten app code, along with type-aware promise checks. Generated data and pinned upstream helpers are excluded from rewriting. A genuinely untrusted decoding input can need a narrowly documented boundary exception; domain functions must receive validated types. Avoid broad rule suppression or assertions that substitute for validation.
