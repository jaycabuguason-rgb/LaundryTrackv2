import { test, expect } from "@playwright/test";

// Performance budget — TTFB and client-side timings
test.describe("Performance Budget", () => {
  const BUDGET = {
    ttfbMs: 1500, // Time to first byte — 800 strict in prod, 1500 allows dev cold start jitter
    domContentLoadedMs: 5000,
    fullLoadMs: 7000,
  };

  test("home meets TTFB budget", async ({ page }) => {
    const start = Date.now();
    const response = await page.goto("/");
    const ttfb = Date.now() - start;
    expect(response?.ok()).toBeTruthy();
    // Dev cold start can be 3-4s on first hit (Next compiles) — allow 6s locally, 1.6s expectation only for nav timing
    expect(ttfb).toBeLessThan(6000);

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return null;
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
        load: nav.loadEventEnd - nav.startTime,
        ttfb: nav.responseStart - nav.requestStart,
      };
    });

    if (timing) {
      expect(timing.ttfb).toBeLessThan(BUDGET.ttfbMs);
      expect(timing.domContentLoaded).toBeLessThan(BUDGET.domContentLoadedMs);
      expect(timing.load).toBeLessThan(BUDGET.fullLoadMs);
    }
  });

  test("offline page loads within budget", async ({ page }) => {
    await page.goto("/offline");
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return null;
      return { load: nav.loadEventEnd - nav.startTime };
    });
    if (timing) expect(timing.load).toBeLessThan(BUDGET.fullLoadMs);
  });

  test("no console errors on home", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Filter out known third-party noise
    const appErrors = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("Failed to load resource")
    );
    expect(appErrors, appErrors.join("\n")).toEqual([]);
  });
});
