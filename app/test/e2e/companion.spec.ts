import { expect, test } from "@playwright/test";
import { fixture } from "../fixtures/save.js";
import { exerciseSavePipeline } from "../support/integration.js";

test.beforeAll(async () => {
  await exerciseSavePipeline(fixture({ fullRoster: true }));
});

test("uploaded save renders and the planning board mixes a ten-Pokémon shortlist", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/#today");
  await expect(page.locator(".mon")).toHaveCount(6);
  await page.locator('nav a[href="#lab"]').click();
  await expect(page.getByRole("heading", { name: "Find your six." })).toBeVisible();
  const addButtons = page.locator('[data-action="shortlist"]');
  for (let count = 0; count < 4; count++) await addButtons.first().click();
  await expect(page.locator(".grid-toggle")).toHaveCount(10);
  await expect(page.locator('.grid-toggle[aria-pressed="true"]')).toHaveCount(6);
  await page.locator("#limit").selectOption("1");
  await expect(page.locator(".threshold-row").first()).toBeVisible();
  await page.locator('.grid-toggle[aria-pressed="false"]').first().click();
  await page.locator('.grid-toggle[aria-pressed="true"]').first().click();
  await expect(page.locator('.grid-toggle[aria-pressed="true"]')).toHaveCount(6);
  await expect(page.locator(".bench-column")).toHaveCount(4);
  await page.getByRole("textbox", { name: "Plan name" }).fill("Browser verified team");
  await page.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Update plan", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".grid-toggle")).toHaveCount(10);
  await expect(page.getByRole("textbox", { name: "Plan name" })).toHaveValue(
    "Browser verified team",
  );
  await page.locator('[data-action="focus-board"]').click();
  await expect(page.getByRole("button", { name: /Exit focus/ })).toBeVisible();
  await page.screenshot({ path: "test-results/planner.png", fullPage: true });
  expect(failures).toEqual([]);
});

test("battle scouting preserves spoiler choice and exact difficulty", async ({ page }) => {
  await page.goto("/#prepare");
  await expect(page.locator('[data-fight="target"]')).toBeVisible();
  await page.locator('[data-fight="difficulty"]').selectOption("Difficult");
  await page.locator('[data-fight="target"]').selectOption("gym-mel");
  await expect(page.locator(".fight-grid")).toHaveCount(0);
  await page.locator('[data-fight-reveal="team"]').click();
  await expect(page.locator(".fight-grid")).toBeVisible();
  await page.locator('[data-fight-reveal="full"]').click();
  await expect(page.getByText("FULL SCOUTING NOTES")).toBeVisible();
  await page.locator('[data-fight="difficulty"]').selectOption("Vanilla");
  await expect(page.getByText(/No sourced Vanilla roster/).first()).toBeVisible();
});

test("Pokédex and Type Desk retain reference search and inverse arithmetic", async ({ page }) => {
  await page.goto("/#dex");
  await page.locator("[data-dex-search]").fill("Joltik");
  await expect(page.getByText("Joltik", { exact: true }).first()).toBeVisible();
  await page.goto("/#types");
  await page.locator('[data-tt="clear"]').click();
  await page.locator('[data-tt="type"][data-value="ground"]').click();
  await page.locator('[data-tt="type"][data-value="flying"]').click();
  await expect(page.locator("summary").filter({ hasText: "Major weaknesses 4×" })).toBeVisible();
  await page.locator('[data-tt="rules"]').selectOption("inverse");
  await page.locator('[data-tt="mode"][data-value="offense"]').click();
  await page.locator('[data-tt="dual"]').check();
  await expect(page.getByText(/171 hypothetical/)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
