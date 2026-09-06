/**
 * Cold-mount scenario.
 *
 * Navigate from a blank page, wait for the board to paint, record LCP
 * and any long tasks observed between navigation and first paint.
 * Runs the same measurement against all libraries in the head-to-head.
 */

import { test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library, recordScenario } from "./lib.js";

interface MountMetrics {
  readonly lcpMs: number | null;
  readonly longTasks: number;
  readonly longTaskTotalMs: number;
}

async function measureMount(
  page: import("@playwright/test").Page,
  library: Library,
): Promise<MountMetrics> {
  await gotoBoard(page, library);
  // Small settle window so LCP has a chance to fire after the board
  // paints. 500 ms is plenty for Chromium's LCP throttle.
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const m = (window.__gbBench__ ?? window.__ucrBench__)?.metrics();
    return {
      lcpMs: m?.lcpMs ?? null,
      longTasks: m?.longTasks.length ?? 0,
      longTaskTotalMs: m?.longTaskTotalMs ?? 0,
    };
  });
}

const collected: Partial<Record<Library, MountMetrics>> = {};

for (const library of ALL_LIBRARIES) {
  test(`mount — ${library}`, async ({ page }) => {
    collected[library] = await measureMount(page, library);
  });
}

test.afterAll(() => {
  recordScenario("mount", collected);
});
