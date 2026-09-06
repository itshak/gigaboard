/**
 * Shared Playwright helpers for the head-to-head bench.
 *
 * Two concerns live here:
 *
 * 1. **Results aggregation.** Each spec file ends by calling
 *    `recordScenario(name, {ultra, rcb})`. Results are written out to
 *    `bench-results/playwright.json` at process exit so a single CI run
 *    produces one consolidated JSON file regardless of how many spec
 *    files were involved.
 *
 * 2. **Page helpers.** `gotoBoard(page, library)` navigates to the
 *    right entry page and waits for `window.__ucrBench__.ready`.
 *    `runOnBoard(page, library, fn)` evaluates `fn` in-page with the
 *    harness available and returns the result.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import type { BenchMetrics } from "../../src/harness/bench-harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = resolve(here, "..", "..", "bench-results");
const outPath = resolve(resultsDir, "playwright.json");

/** Library under test. */
export type Library = "ultra" | "rcb" | "cg";

/** Results for a single scenario, keyed by library. */
export type ScenarioResult = Partial<Record<Library, unknown>>;

/**
 * In-memory accumulator for the life of the Node process. Spec files
 * push their results into this map and the `afterAll` in each spec
 * triggers a write. Writing on every push keeps partial results on disk
 * even if a later spec crashes.
 */
const results: Record<string, ScenarioResult> = {};

/** Append a scenario to the consolidated JSON file and write to disk. */
export function recordScenario(name: string, result: ScenarioResult): void {
  // Merge, so tests that record per-library in separate calls still land
  // in the same scenario entry.
  results[name] = { ...(results[name] ?? {}), ...result };
  mkdirSync(resultsDir, { recursive: true });
  const report = {
    runtime: "playwright + chromium",
    generatedAt: new Date().toISOString(),
    scenarios: results,
  };
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
}

/** Path on the dev server for each library's bench page. */
const ROUTES: Record<Library, string> = {
  ultra: "/",
  rcb: "/rcb.html",
  cg: "/cg.html",
};

/** All libraries included in the head-to-head. */
export const ALL_LIBRARIES: readonly Library[] = ["ultra", "rcb", "cg"];

/**
 * Navigate to the requested library's bench page, wait for the harness
 * API to attach, and return when the board is ready to receive input.
 */
export async function gotoBoard(page: Page, library: Library): Promise<void> {
  await page.goto(ROUTES[library]);
  await page.waitForFunction(() => (window.__gbBench__ ?? window.__ucrBench__) !== undefined);
  await page.evaluate(() => (window.__gbBench__ ?? window.__ucrBench__)?.ready);
  // One extra rAF after attach — some libraries mount their internal
  // state in a follow-up useEffect after the harness has attached.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

/** Snapshot of the harness's metrics after running a scenario. */
export type MetricsSnapshot = BenchMetrics;

/**
 * Apply Chrome DevTools Protocol CPU throttling to the given page.
 * `rate` = 1 means no throttle; `rate` = 4 simulates a mid-range mobile
 * device. Sticks for the lifetime of the `CDPSession` so call once per
 * scenario.
 */
export async function throttleCpu(page: Page, rate: number): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate });
}
