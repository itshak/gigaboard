/**
 * Move-storm scenario.
 *
 * Play a 40-ply game back-to-back under 4× CPU throttle. Measure:
 * - Total wall-clock + per-move average.
 * - Long-task count + total blocking time.
 * - Max/median/dropped-frame stats from the harness's rAF sampler.
 *
 * We run the same scenario against every library in the head-to-head.
 */

import { test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library, recordScenario } from "./lib.js";
import { GAME_40 } from "./tours.js";

interface MoveMetrics {
  readonly plys: number;
  readonly wallMs: number;
  readonly msPerMove: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMoveMs: number;
  readonly longTasks: number;
  readonly longTaskTotalMs: number;
  readonly maxFrameMs: number;
  readonly medianFrameMs: number;
  readonly p75FrameMs: number;
  readonly p90FrameMs: number;
  readonly p95FrameMs: number;
  readonly p99FrameMs: number;
  readonly droppedFrames: number;
  readonly heapPeakBytes: number;
  readonly heapEndBytes: number;
  /**
   * DOM mutations observed across the 40-ply run, as a
   * reconciliation-size proxy. Library-agnostic: we watch what actually
   * hit the DOM, not each library's internal render count. Ratio
   * between ultra/rcb is the clean signal for the "per-byte
   * subscription vs whole-board re-render" architectural claim.
   */
  readonly domMutations: number;
  readonly domMutationsPerMove: number;
}

function percentile(sorted: ReadonlyArray<number>, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

async function measureMoveStorm(
  page: import("@playwright/test").Page,
  library: Library,
): Promise<MoveMetrics> {
  await gotoBoard(page, library);

  // 4× CPU throttle mirrors the drag scenario so the two bars on the
  // comparison chart live in the same conditions. It's also the
  // condition under which library differences actually surface — an
  // unthrottled desktop Chromium processes either board in < 1 ms.
  await page.evaluate(() => {
    (window.__gbBench__ ?? window.__ucrBench__)?.resetMetrics();
    (window.__gbFlash__ ?? window.__ucrFlash__)?.resetCount();
  });
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const result = await page.evaluate(
    async (moves) => {
      const bench = window.__gbBench__ ?? window.__ucrBench__;
      if (bench === undefined) throw new Error("harness missing");

      // Fire all 40 moves back-to-back with no rAF waits between — this
      // measures raw React + DOM work a library spends on each commit,
      // not the idle time between them. If a library can't drain 40
      // commits faster than a rAF budget * 40, the longtask observer
      // picks it up.
      const perMove: number[] = [];
      const start = performance.now();
      for (const [from, to] of moves) {
        const t0 = performance.now();
        await bench.playMove(from, to);
        perMove.push(performance.now() - t0);
      }
      const wallMs = performance.now() - start;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      const m = bench.metrics();
      return {
        wallMs,
        perMove,
        longTasks: m.longTasks.length,
        longTaskTotalMs: m.longTaskTotalMs,
        maxFrameMs: m.maxFrameMs,
        medianFrameMs: m.medianFrameMs,
        p75FrameMs: m.p75FrameMs,
        p90FrameMs: m.p90FrameMs,
        p95FrameMs: m.p95FrameMs,
        p99FrameMs: m.p99FrameMs,
        droppedFrames: m.droppedFrames,
        heapPeakBytes: m.heapPeakBytes,
        heapEndBytes: m.heapEndBytes,
        domMutations: (window.__gbFlash__ ?? window.__ucrFlash__)?.getCount() ?? 0,
      };
    },
    GAME_40 as readonly (readonly [string, string])[],
  );

  const sorted = [...result.perMove].sort((a, b) => a - b);

  return {
    plys: GAME_40.length,
    wallMs: Number(result.wallMs.toFixed(2)),
    msPerMove: Number((result.wallMs / GAME_40.length).toFixed(3)),
    p50Ms: Number(percentile(sorted, 50).toFixed(3)),
    p95Ms: Number(percentile(sorted, 95).toFixed(3)),
    maxMoveMs: Number((sorted[sorted.length - 1] ?? 0).toFixed(3)),
    longTasks: result.longTasks,
    longTaskTotalMs: Number(result.longTaskTotalMs.toFixed(2)),
    maxFrameMs: Number(result.maxFrameMs.toFixed(2)),
    medianFrameMs: Number(result.medianFrameMs.toFixed(2)),
    p75FrameMs: Number(result.p75FrameMs.toFixed(2)),
    p90FrameMs: Number(result.p90FrameMs.toFixed(2)),
    p95FrameMs: Number(result.p95FrameMs.toFixed(2)),
    p99FrameMs: Number(result.p99FrameMs.toFixed(2)),
    droppedFrames: result.droppedFrames,
    heapPeakBytes: result.heapPeakBytes,
    heapEndBytes: result.heapEndBytes,
    domMutations: result.domMutations,
    domMutationsPerMove: Number((result.domMutations / GAME_40.length).toFixed(2)),
  };
}

const collected: Partial<Record<Library, MoveMetrics>> = {};

for (const library of ALL_LIBRARIES) {
  test(`move storm — ${library}`, async ({ page }) => {
    collected[library] = await measureMoveStorm(page, library);
  });
}

test.afterAll(() => {
  recordScenario("moveStorm", collected);
});
