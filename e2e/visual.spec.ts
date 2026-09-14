import { test, expect } from "@playwright/test";

// Visual regression — baseline screenshots stored in e2e/__snapshots__
test.describe("Visual Regression", () => {
  test("home — full page snapshot", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("home.png", {
      maxDiffPixelRatio: 0.08,
      threshold: 0.3,
      animations: "disabled",
      fullPage: true,
    });
  });

  test("offline — full page snapshot", async ({ page }) => {
    await page.goto("/offline");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("offline.png", {
      maxDiffPixelRatio: 0.08,
      threshold: 0.3,
      animations: "disabled",
      fullPage: true,
    });
  });

  test("tracking 404 — snapshot", async ({ page }) => {
    await page.goto("/track/invalid-visual-check");
    await expect(page).toHaveScreenshot("track-404.png", {
      maxDiffPixelRatio: 0.08,
      threshold: 0.3,
      animations: "disabled",
    });
  });
});
