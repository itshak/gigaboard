import { test, expect } from "@playwright/test";
import { attachMetrics, drag, ready, reset } from "./helpers.js";

/**
 * Expensive opt-in driver stress: all gestures use real Playwright mouse
 * events, not in-page dispatchEvent. Does not run in standard pull-request
 * CI. A single repeated e2e4 move isolates input integrity; this is NOT
 * a substitute for 100 independent chess tactics.
 */
test("1000 pointer drag attempts, no missed moves", async ({ page }, info) => {
  test.skip(process.env["FEELLAB_STRESS"] !== "1", "opt-in: set FEELLAB_STRESS=1");
  test.setTimeout(900_000);
  await ready(page);
  const started = performance.now();
  for (let i = 0; i < 1000; i++) {
    await reset(page);
    await drag(page, "e2", "e4", 2);
    expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(1);
    const fen = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
    expect(fen.split(" ")[0]).toContain("4P3");
  }
  await attachMetrics(info, {
    attempts: 1000, missedMoves: 0,
    testRunnerWallMs: performance.now() - started,
    measurementDomain: "Playwright automation wall time; not user response latency",
  });
});
