import { rmSync } from "node:fs";

// Only Playwright's disposable local data; the default dev and production stores are untouched.
rmSync(new URL("../.wrangler/e2e", import.meta.url), { recursive: true, force: true });
