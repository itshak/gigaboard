/**
 * Grid-mount scenario.
 *
 * For each (library, N) combination we navigate to that library's
 * entry page with `?grid=N`, then snapshot two timings and several
 * resource-use metrics:
 *
 * - `paintMs`       — wall-clock from navigation start until all N
 *                     `[data-grid-board]` cells exist in the DOM.
 *                     Libraries whose engines hydrate asynchronously
 *                     can paint pieces on the first commit (via a
 *                     FEN-based fallback layer) and log a much lower
 *                     value here than their `interactiveMs`.
 * - `interactiveMs` — wall-clock from navigation start until the
 *                     harness's `ready` promise resolves (engines
 *                     hydrated, the board is playable).
 * - `lcpMs`         — Largest Contentful Paint from the in-page
 *                     harness.
 * - `longTasks`     — count + total duration of main-thread blocks
 *                     > 50 ms observed during mount.
 * - `jsHeapMb`      — used-JS-heap-size after a forced GC, via CDP
 *                     `Performance.getMetrics`. Captures per-board
 *                     engine / state overhead.
 * - `domNodes`      — total DOM node count via CDP
 *                     `Memory.getDOMCounters`. Measures how DOM-heavy
 *                     each library is per board.
 *
 * The scenario is deliberately non-interactive. We're measuring what
 * "mount 100 boards" costs; any subsequent user interaction is out of
 * scope and belongs in a follow-up bench.
 */

import { expect, type Page, test } from "@playwright/test";
import type { BenchMetrics } from "../../src/harness/bench-harness.js";
import { ALL_LIBRARIES, type Library, recordScenario } from "./lib.js";

/** Board counts to measure per library. */
const GRID_SIZES = [1, 10, 100] as const;
type GridN = (typeof GRID_SIZES)[number];

/** Per-library entry paths. All three support `?grid=N`. */
const GRID_ROUTES: Record<Library, string> = {
  ultra: "/",
  rcb: "/rcb.html",
  cg: "/cg.html",
};

interface GridMetrics {
  readonly n: number;
  /** Wall-clock from nav start until N grid cells exist in the DOM. */
  readonly paintMs: number;
  /** Wall-clock from nav start until the harness's `ready` promise resolves. */
  readonly interactiveMs: number;
  readonly lcpMs: number | null;
  readonly longTasks: number;
  readonly longTaskTotalMs: number;
  readonly jsHeapMb: number;
  readonly domNodes: number;
}

async function measureGrid(page: Page, library: Library, n: GridN): Promise<GridMetrics> {
  const route = `${GRID_ROUTES[library]}?grid=${n}`;

  // Each scenario starts in a cold page with no leftover heap / DOM state —
  // Playwright creates a fresh context per test.
  const t0 = Date.now();
  await page.goto(route, { waitUntil: "domcontentloaded" });

  // Paint timing — wait for the Nth `[data-grid-board]` cell to exist.
  // Libraries that paint pieces via a FEN fallback before their engine
  // is ready will satisfy this wait on the very first React commit.
  await page.waitForFunction(
    (expected) => document.querySelectorAll('[data-grid-board="1"]').length === expected,
    n,
    { timeout: 60_000 },
  );
  const paintMs = Date.now() - t0;

  // Interactive timing — separate wait for the harness to attach and
  // for `ready` to resolve, which means engines have been hydrated and
  // every board is playable. For libraries without a deferred-engine
  // mount strategy this number is effectively equal to `paintMs`.
  await page.waitForFunction(() => (window.__gbGrid__ ?? window.__ucrGrid__) !== undefined, null, {
    timeout: 60_000,
  });
  await page.evaluate(() => (window.__gbGrid__ ?? window.__ucrGrid__)?.ready);
  const interactiveMs = Date.now() - t0;

  // Settle window so LCP has a chance to fire + any post-mount effects
  // have landed before we snapshot.
  await page.waitForTimeout(500);

  const harnessMetrics = (await page.evaluate(() =>
    (window.__gbGrid__ ?? window.__ucrGrid__)?.metrics(),
  )) as BenchMetrics | undefined;

  // CDP side: force GC first so the heap number reflects live state,
  // not leftover allocator noise. Then read DOM node count + JS heap.
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");
  // `HeapProfiler.collectGarbage` is the cheapest "please clean up" nudge
  // supported by Chromium that doesn't depend on the v8 inspector.
  try {
    await client.send("HeapProfiler.collectGarbage");
  } catch {
    // Some builds expose it under a different domain — fall back silently;
    // the heap number will be slightly inflated but still comparable
    // between libraries because the same call fails identically on all.
  }
  const perf = await client.send("Performance.getMetrics");
  const metric = (k: string): number => perf.metrics.find((m) => m.name === k)?.value ?? 0;
  const domCounters = await client.send("Memory.getDOMCounters");

  return {
    n,
    paintMs,
    interactiveMs,
    lcpMs: harnessMetrics?.lcpMs ?? null,
    longTasks: harnessMetrics?.longTasks.length ?? 0,
    longTaskTotalMs: harnessMetrics?.longTaskTotalMs ?? 0,
    jsHeapMb: +(metric("JSHeapUsedSize") / (1024 * 1024)).toFixed(2),
    domNodes: domCounters.nodes,
  };
}

// One entry per library, each carrying its full `{1, 10, 100}` series.
const collected: Partial<Record<Library, GridMetrics[]>> = {};

// Warmup: hit each library's base route once so the Vite dev server has
// transformed its module graph before the timed measurements start. The
// first cold request to a Vite entry costs ~300–500 ms of server-side
// compile that has nothing to do with the library under test — we don't
// want that showing up in the `N = 1` column.
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  for (const library of ALL_LIBRARIES) {
    await page.goto(`${GRID_ROUTES[library]}?grid=1`, { waitUntil: "domcontentloaded" });
    await page
      .waitForFunction(() => (window.__gbGrid__ ?? window.__ucrGrid__) !== undefined, null, {
        timeout: 60_000,
      })
      .catch(() => {
        /* best-effort warmup — fall through if the page didn't install
           the harness (e.g. a transient dev-server hiccup). */
      });
  }
  await ctx.close();
});

for (const library of ALL_LIBRARIES) {
  for (const n of GRID_SIZES) {
    test(`grid mount — ${library} × ${n}`, async ({ page }) => {
      const series = collected[library] ?? [];
      const result = await measureGrid(page, library, n);
      series.push(result);
      collected[library] = series;
      // Sanity — every library must render exactly the requested N.
      expect(result.n).toBe(n);
    });
  }
}

test.afterAll(() => {
  recordScenario("grid", collected as Record<string, unknown>);
});
