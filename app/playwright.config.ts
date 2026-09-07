import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8787",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "npm run build:client && wrangler d1 migrations apply borrius-companion --local --persist-to .wrangler/e2e && wrangler d1 execute borrius-companion --local --persist-to .wrangler/e2e --file test/fixtures/legacy-plans.sql && wrangler d1 execute borrius-companion --local --persist-to .wrangler/e2e --file migrations/0003_strategy_teams.sql && wrangler d1 execute borrius-companion --local --persist-to .wrangler/e2e --file migrations/0003_strategy_teams.sql && wrangler dev --ip 127.0.0.1 --port 8787 --persist-to .wrangler/e2e",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
