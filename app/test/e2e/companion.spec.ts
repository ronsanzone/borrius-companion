import { expect, test } from "@playwright/test";
import { Schema } from "effect";
import { StateSchema } from "../../src/client/contracts";
import { fixture } from "../fixtures/save.js";
import { exerciseSavePipeline } from "../support/integration.js";

test.beforeAll(async () => {
  const state = Schema.decodeUnknownSync(StateSchema)(
    await (await fetch("http://127.0.0.1:8787/api/state")).json(),
  );
  const migrated = state.plans.find((p) => p.id === "migration-team");
  expect(migrated?.members).toEqual([
    { kind: "owned", pokemonId: "missing-b" },
    { kind: "owned", pokemonId: "missing-a" },
  ]);
  expect(migrated?.shortlistIds).toEqual(["missing-a", "missing-b", "bench-c"]);
  expect(migrated?.inverse).toBe(true);
  expect(state.plans.find((p) => p.id === "migration-older")?.shortlistIds).toEqual(["missing-a"]);
  expect(state.context.checkpoint).toBe("Migrated checkpoint");
  expect(state.context.fightReveal).toBe("types");
  await exerciseSavePipeline(fixture({ fullRoster: true }));
});

test("one workspace saves owned and hypothetical teams with explicit replacement and proposed moves", async ({
  page,
}) => {
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  await page.goto("/#today");
  await expect(page.locator(".mon")).toHaveCount(6);
  await page.locator('nav a[href="#dex"]').click();
  await expect(page.locator('[data-strategy="inspect-player"]')).toHaveCount(6);
  await page.locator("[data-dex-search]").fill("Joltik");
  await page.locator(".dex-results [data-species]").first().click();
  await expect(page.locator(".strategy-inspector")).toContainText("Defensive matchups");
  await page.locator('[data-strategy="add-build"]').click();
  await expect(page.getByText("Choose a slot to replace, or cancel.")).toBeVisible();
  await page.locator('[data-strategy="replace"][data-id="2"]').click();
  await expect(page.locator('[data-strategy="inspect-player"]')).toHaveCount(6);
  await page.locator('select[name="move0"]').selectOption({ label: "Thunderbolt" });
  await page.locator('input[name="item"]').fill("Life Orb");
  await page.locator('textarea[name="notes"]').fill("Hypothetical coverage proposal");
  await page.getByRole("button", { name: "Apply proposal" }).click();
  await page.getByRole("textbox", { name: "Team name" }).fill("Browser verified mixed team");
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await expect(page.getByText("Team saved to your owner account.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Team name" })).toHaveValue(
    "Browser verified mixed team",
  );
  await page.locator('[data-strategy="inspect-player"][data-id="2"]').click();
  await expect(page.locator('input[name="item"]')).toHaveValue("Life Orb");
  await expect(page.locator('select[name="move0"] option:checked')).toHaveText("Thunderbolt");
  await page.locator('[data-strategy="new"]').click();
  await page
    .locator('[data-strategy-change="plan"]')
    .selectOption({ label: "Browser verified mixed team" });
  await expect(page.locator('[data-strategy="inspect-player"]')).toHaveCount(6);
  await page.locator('[data-strategy-change="event"]').selectOption("gym-alice");
  await page.locator('[data-strategy-change="difficulty"]').selectOption("Difficult");
  await page.locator('[data-strategy="reveal"][data-id="full"]').click();
  await page.locator('[data-strategy="inspect-enemy"]').first().click();
  await expect(page.locator(".strategy-inspector")).toContainText("Estimated role");
  await expect(page.getByRole("textbox", { name: "Team name" })).toHaveValue(
    "Browser verified mixed team",
  );
  await page.screenshot({ path: "test-results/strategy-desktop.png", fullPage: true });
  expect(failures).toEqual([]);
});

test("spoilers cover DOM sources and stale inspector; exact difficulty and starter branches", async ({
  page,
}) => {
  await page.goto("/#dex");
  await page.locator('[data-strategy-change="event"]').selectOption("gym-alice");
  await page.locator('[data-strategy-change="difficulty"]').selectOption("Difficult");
  await expect(page.locator("[data-enemy] img")).toHaveCount(0);
  await expect(page.locator("[data-enemy] a")).toHaveCount(0);
  await expect(page.locator("[data-enemy]")).not.toContainText("Crobat");
  await expect(page.locator("[data-enemy]")).not.toContainText("Alice");
  await page.locator('[data-strategy="reveal"][data-id="full"]').click();
  await page.locator('[data-strategy="inspect-enemy"]').first().click();
  await expect(page.locator(".strategy-inspector")).toContainText("Documented opponent moves");
  await page.locator('[data-strategy="reveal"][data-id="types"]').click();
  await expect(page.locator(".strategy-inspector")).not.toContainText("Documented opponent moves");
  await page.locator('[data-strategy-change="difficulty"]').selectOption("Vanilla");
  await expect(page.getByText(/No sourced Vanilla roster/)).toBeVisible();
  await expect(page.locator("[data-enemy] a")).toHaveCount(0);
  await expect(page.locator('[data-strategy="inspect-enemy"]')).toHaveCount(0);
  await page.locator('[data-strategy-change="event"]').selectOption("rival-5");
  await expect(page.getByText("Choose your starter branch.")).toBeVisible();
  await page.locator('[data-strategy-change="starter"]').selectOption("beldum");
  await page.locator('[data-strategy-change="difficulty"]').selectOption("Expert");
  await page.locator('[data-strategy="reveal"][data-id="full"]').click();
  await page.locator('[data-strategy="context"]').click();
  await expect(page.getByText("Encounter and reveal preference saved.")).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-strategy-change="starter"]')).toHaveValue("beldum");
  await expect(page.locator('[data-strategy-change="difficulty"]')).toHaveValue("Expert");
  await page.locator('[data-strategy-change="event"]').selectOption("void-beasts");
  await expect(page.locator('[data-strategy="inspect-enemy"]')).toHaveCount(1);
  await page.locator('[data-strategy="inspect-enemy"]').click();
  await page.locator('[data-strategy-change="stage"]').selectOption("1");
  await expect(page.locator(".strategy-inspector")).toContainText("Inspect either side");
  await page.locator('[data-strategy="reveal"][data-id="types"]').click();
  await page.locator('[data-strategy="context"]').click();
});

test("migrated missing members stay visible and survive update/reload", async ({ page }) => {
  await page.goto("/#dex");
  await page.locator('[data-strategy-change="plan"]').selectOption("migration-team");
  await expect(page.locator('[data-strategy="inspect-player"]')).toHaveCount(2);
  await page.locator('[data-strategy="inspect-player"]').first().click();
  await expect(page.locator(".strategy-inspector")).toContainText("missing-b");
  await expect(page.locator('[data-strategy-change="inverse"]')).toHaveValue("Inverse");
  await expect(page.locator('[data-strategy-change="limit"]')).toHaveValue("2");
  await page.getByRole("button", { name: "Update team", exact: true }).click();
  await expect(page.getByText("Team saved to your owner account.")).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-strategy="inspect-player"]')).toHaveCount(2);
});

for (const width of [360, 390, 1440])
  test(`responsive ${width}px inspection and keyboard focus without overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#dex");
    await page.locator('[data-strategy-change="event"]').selectOption("gym-alice");
    await page.locator('[data-strategy-change="difficulty"]').selectOption("Difficult");
    await page.locator('[data-strategy="reveal"][data-id="full"]').click();
    await page.locator('[data-strategy="inspect-enemy"]').first().focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".strategy-inspector")).toBeFocused();
    if (width < 760)
      await expect(page.locator("[data-enemy-detail] .strategy-inspector")).toHaveCount(1);
    await page.locator('[data-strategy="inspect-player"]').first().click();
    if (width < 760)
      await expect(page.locator("[data-player-detail] .strategy-inspector")).toHaveCount(1);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/strategy-${width}.png`, fullPage: true });
    await page.addStyleTag({ content: "html{font-size:200%}" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });

test("reference tools and unrelated journal/settings remain available", async ({ page }) => {
  await page.goto("/#types");
  await page.locator('[data-tt="clear"]').click();
  await page.locator('[data-tt="type"][data-value="ground"]').click();
  await page.locator('[data-tt="type"][data-value="flying"]').click();
  await expect(page.locator("summary").filter({ hasText: "Major weaknesses 4×" })).toBeVisible();
  await page.locator('[data-tt="rules"]').selectOption("inverse");
  await page.locator('[data-tt="mode"][data-value="offense"]').click();
  await page.locator('[data-tt="dual"]').check();
  await expect(page.getByText(/171 hypothetical/)).toBeVisible();
  await page.goto("/#journey");
  await expect(page.locator("#note-form")).toBeVisible();
  await page.goto("/#settings");
  await expect(page.locator("#context-form")).toBeVisible();
});

test("proposal edits survive encounter changes and save locks the submitted draft", async ({
  page,
}) => {
  await page.goto("/#dex");
  await page.locator('[data-strategy="new"]').click();
  await page.locator("[data-dex-search]").fill("Joltik");
  await page.locator(".dex-results [data-species]").first().click();
  await page.locator('[data-strategy="add-build"]').click();
  await page.locator('select[name="move1"]').selectOption({ label: "Thunderbolt" });
  await page.locator('input[name="item"]').fill("Focus Sash");
  await page.locator('[data-strategy-change="event"]').selectOption("gym-tessy");
  await page.locator('[data-strategy-change="difficulty"]').selectOption("Expert");
  await expect(page.locator('input[name="item"]')).toHaveValue("Focus Sash");
  await expect(page.locator('select[name="move0"]')).toHaveValue("");
  await expect(page.locator(".strategy-inspector")).toContainText("Defensive matchups unknown");
  await page.getByRole("textbox", { name: "Team name" }).fill("Preserved proposal");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/plans", async (route) => {
    await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await expect(page.locator('[data-strategy="new"]')).toBeDisabled();
  await expect(page.locator('[data-strategy-change="plan"]')).toBeDisabled();
  release();
  await expect(page.getByText("Team saved to your owner account.")).toBeVisible();
  await page.reload();
  await page.locator('[data-strategy="inspect-player"]').first().click();
  await expect(page.locator('input[name="item"]')).toHaveValue("Focus Sash");
  await expect(page.locator('select[name="move0"]')).toHaveValue("");
});

test("settings can tighten a persisted full reveal and navigation retains workspace search", async ({
  page,
}) => {
  await page.goto("/#dex");
  await page.locator('[data-strategy-change="event"]').selectOption("gym-alice");
  await page.locator('[data-strategy="reveal"][data-id="full"]').click();
  await page.locator('[data-strategy="context"]').click();
  await expect(page.getByText("Encounter and reveal preference saved.")).toBeVisible();
  await page.locator("[data-dex-search]").fill("Thunderbolt");
  await page.goto("/#types");
  await expect(page.locator('[data-tt="clear"]')).toBeVisible();
  await page.goto("/#dex");
  await expect(page.locator("[data-dex-search]")).toHaveValue("Thunderbolt");
  await page.goto("/#settings");
  await page.locator('select[name="spoilerMode"]').selectOption("hints");
  await page.locator("#context-form button").click();
  await expect(page.locator("#notice")).toHaveText("Saved.");
  await page.goto("/#dex");
  await expect(page.locator('[data-strategy="reveal"][data-id="types"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("[data-enemy] img")).toHaveCount(0);
});

test("failed saves preserve drafts and failed reference loads provide retry instructions", async ({
  page,
}) => {
  await page.goto("/#dex");
  await page.getByRole("textbox", { name: "Team name" }).fill("Keep after failure");
  await page.route("**/api/plans", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"Temporary test failure"}',
    }),
  );
  await page.locator("#strategy-save button").first().click();
  await expect(page.locator("[data-message]")).toContainText("Temporary test failure");
  await expect(page.getByRole("textbox", { name: "Team name" })).toHaveValue("Keep after failure");
  await page.route("**/data/battles.json", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Reload to retry");
});

test("a save completing after navigation cannot restore an older draft", async ({ page }) => {
  await page.goto("/#dex");
  await page.getByRole("textbox", { name: "Team name" }).fill("Pending old team");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/plans", async (route) => {
    await gate;
    await route.continue();
  });
  await page.locator("#strategy-save button").first().click();
  await page.locator('nav a[href="#today"]').click();
  await page.locator('nav a[href="#dex"]').click();
  await page.locator('[data-strategy="new"]').click();
  await page.getByRole("textbox", { name: "Team name" }).fill("Newer working draft");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/plans") && r.request().method() === "POST",
  );
  release();
  await response;
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Team name" })).toHaveValue("Newer working draft");
  await expect(page.locator('[data-strategy="inspect-player"]')).toHaveCount(0);
});

test("encounter grid supports keyboard pairing, mobile scroll and spoiler resets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/#dex");
  await page.locator('[data-strategy="party"]').click();
  await page.locator('[data-strategy-change="event"]').selectOption("gym-alice");
  await page.locator('[data-strategy-change="difficulty"]').selectOption("Difficult");
  await page.locator('[data-strategy="reveal"][data-id="full"]').click();
  const cell = page.locator('[data-strategy="pair"]').first();
  await cell.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-pair-detail]")).toContainText("Known attacks from save");
  await expect(page.locator("[data-pair-detail]")).toContainText("Documented return attacks");
  await expect(cell).toBeFocused();
  await page.locator(".matchup-scroll").evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.locator('[data-strategy="pair"]').last().click();
  expect(await page.locator(".matchup-scroll").evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-strategy="reveal"][data-id="team"]').click();
  await expect(page.locator(".matchup-risk")).toHaveCount(0);
  await expect(page.locator("[data-pair-detail]")).not.toContainText("Documented return attacks");
  await cell.click();
  await expect(page.locator("[data-pair-detail]")).toContainText("Reveal full details");
  await page.locator("[data-analysis]").screenshot({ path: "test-results/matchup-grid-360.png" });
  await page.locator('[data-strategy-change="difficulty"]').selectOption("Expert");
  await expect(page.locator("[data-pair-detail]")).toContainText("Select a pairing");
  await page.locator('[data-strategy="reveal"][data-id="types"]').click();
  await expect(page.locator(".matchup-grid")).toHaveCount(0);
  await expect(page.locator("[data-analysis]")).not.toContainText("Crobat");
});

test("type board explores owned and uncaught teams with persistent bench proposals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto("/#dex");
  await page.locator('[data-strategy="new"]').click();
  await page.locator("[data-dex-search]").fill("Joltik");
  await page.locator(".dex-results [data-species]").first().click();
  await page.locator('[data-strategy="compare-build"]').click();
  await page.locator('select[name="move0"]').selectOption({ label: "Thunderbolt" });
  await page.locator('input[name="item"]').fill("Life Orb");
  await page.locator('textarea[name="notes"]').fill("Bench proposal survives swaps");
  await page.getByRole("button", { name: "Apply proposal", exact: true }).click();
  const buildColumn = page.locator(".team-board thead th").filter({ hasText: "Joltik" });
  await expect(buildColumn).toContainText("Uncaught build");
  await buildColumn.getByRole("button", { name: "Activate", exact: true }).click();
  await expect(page.locator(".team-board tbody tr")).toHaveCount(18);
  await expect(
    page.locator(".team-board tbody tr").filter({ hasText: "Fire" }).locator(".board-totals"),
  ).toHaveAttribute("aria-label", /1 weak/);
  await page.locator('[data-strategy-change="inverse"]').selectOption("Inverse");
  await expect(
    page.locator(".team-board tbody tr").filter({ hasText: "Fire" }).locator(".board-totals"),
  ).toHaveAttribute("aria-label", /0 weak, 1 resistant/);
  await buildColumn.getByRole("button", { name: "Bench", exact: true }).click();
  await expect(
    page.locator(".team-board tbody tr").filter({ hasText: "Fire" }).locator(".board-totals"),
  ).toHaveAttribute("aria-label", /0 weak, 0 resistant/);
  await page.getByRole("textbox", { name: "Team name" }).fill("Bench exploration");
  await page.getByRole("button", { name: "Save team", exact: true }).click();
  await expect(page.getByText("Team saved to your owner account.")).toBeVisible();
  await page.reload();
  await buildColumn.getByRole("button", { name: "Joltik", exact: true }).click();
  await expect(page.locator('input[name="item"]')).toHaveValue("Life Orb");
  await expect(page.locator('textarea[name="notes"]')).toHaveValue("Bench proposal survives swaps");
  await page.locator('[data-strategy="party"]').click();
  await buildColumn.getByRole("button", { name: "Swap in", exact: true }).click();
  await buildColumn.getByRole("button", { name: "Joltik", exact: true }).click();
  await page.locator('textarea[name="notes"]').fill("Edited during pending swap");
  await page.locator('.team-board [data-strategy="board-replace"]').first().click();
  await page.locator('.team-board [data-strategy="board-inspect"]').first().click();
  await expect(page.locator('textarea[name="notes"]')).toHaveValue("Edited during pending swap");
  await expect(page.locator(".team-board thead th").filter({ hasText: "Joltik" })).toHaveCount(1);
  await buildColumn.getByRole("button", { name: "Bench", exact: true }).click();
  await page
    .locator(".team-board thead th")
    .filter({ hasText: "Bulbasaur" })
    .getByRole("button", { name: "Activate", exact: true })
    .click();
  await buildColumn.getByRole("button", { name: "Swap in", exact: true }).click();
  await page.locator('[data-strategy="remove"]').first().click();
  await buildColumn.getByRole("button", { name: "Activate", exact: true }).click();
  await expect(page.locator('[data-strategy="board-replace"]')).toHaveCount(0);
  await page.locator('[data-strategy="party"]').click();
  await buildColumn.getByRole("button", { name: "Swap in", exact: true }).click();
  await page.locator('.team-board [data-strategy="board-replace"]').first().click();
  await expect(page.locator(".team-board .board-active").first()).toContainText("Joltik");
  await page.locator('[data-strategy-change="event"]').selectOption("gym-alice");
  await page.locator('[data-strategy-change="difficulty"]').selectOption("Difficult");
  await page.locator('[data-strategy="reveal"][data-id="team"]').click();
  await expect(page.locator(".matchup-grid tbody tr").first()).toContainText("Joltik");
  await page.locator(".team-board-scroll").evaluate((el) => {
    el.scrollLeft = 0;
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator("[data-type-board]")
    .screenshot({ path: "test-results/team-board-desktop.png" });
  await page.locator('[data-strategy-change="plan"]').selectOption({ label: "Bench exploration" });
  await expect(page.locator('[data-strategy="inspect-player"]')).toHaveCount(0);
  await expect(buildColumn).toContainText("Bench");
});

test("mobile type overview selects metrics and swaps an uncaught candidate", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/#dex");
  await page.locator('[data-strategy="party"]').click();
  await expect(page.locator(".team-board")).toHaveCount(0);
  await expect(page.locator('[data-strategy="board-type"]')).toHaveCount(18);
  await page.locator('[data-strategy-change="inverse"]').selectOption("Standard");
  await page.locator('[data-strategy="board-type"][data-id="fire"]').click();
  await expect(page.locator(".mobile-type-detail h4")).toContainText("fire");
  await expect(page.locator(".mobile-type-detail .mobile-type-member")).toHaveCount(6);
  const fire = page.locator('[data-strategy="board-type"][data-id="fire"]');
  await expect(fire).toHaveAttribute("aria-label", /fire: 1 weak/);
  await page.locator('[data-strategy="board-metric"][data-id="resist"]').click();
  await expect(fire).toHaveAttribute("aria-label", /fire: 3 resist/);
  await page.locator('[data-strategy="board-type"][data-id="ground"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-strategy="board-type"][data-id="ground"]')).toBeFocused();
  await page.locator('[data-strategy="board-target"]').first().click();
  await expect(page.locator("[data-mobile-bench]")).toContainText(
    "Choose a replacement for Bulbasaur",
  );
  await page.locator('[data-strategy="board-target-cancel"]').click();
  await expect(page.locator('[data-strategy="board-bench-toggle"]')).toBeFocused();
  await page.locator('[data-strategy="board-target"]').first().click();
  await page.locator('[data-strategy="find-build"]').click();
  await page.locator("[data-dex-search]").fill("Joltik");
  await page.locator(".dex-results [data-species]").first().click();
  await page.locator('[data-strategy="add-build"]').click();
  await page.locator('[data-strategy="cancel"]').first().click();
  await expect(page.locator("[data-mobile-bench]")).not.toContainText("Choose a replacement for");
  await page.locator('[data-strategy="board-target"]').first().click();
  await page.locator('[data-strategy="compare-build"]').click();
  await page
    .locator("[data-mobile-bench] .mobile-type-member")
    .filter({ hasText: "Joltik" })
    .getByRole("button", { name: "Replace Bulbasaur", exact: true })
    .click();
  await expect(page.locator(".mobile-type-detail .mobile-type-member").first()).toContainText(
    "Joltik",
  );
  await page.locator('[data-strategy="board-metric"][data-id="immune"]').click();
  await page.locator('nav a[href="#types"]').click();
  await page.locator('nav a[href="#dex"]').click();
  await expect(page.locator('[data-strategy="board-metric"][data-id="immune"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[data-strategy="board-type"][data-id="ground"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator('[data-strategy="board-bench-toggle"]').click();
  await expect(page.locator('[data-strategy="board-bench-toggle"]')).toBeFocused();
  await page
    .locator("[data-type-board]")
    .screenshot({ path: "test-results/mobile-type-overview-390.png" });
  await page.addStyleTag({ content: "html{font-size:200%}" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator(".team-board")).toHaveCount(1);
  await expect(page.locator(".mobile-type-tiles")).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.locator('[data-strategy="board-type"]')).toHaveCount(18);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
