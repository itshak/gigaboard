/**
 * Drag-storm scenario — user-path measurement.
 *
 * Replays a full 40-ply Najdorf via pointer gestures (drag the piece
 * from source to target, release) under 4× CPU throttle. Each move
 * exercises the whole interaction pipeline the user sees:
 *
 *     pointerdown → N × pointermove → pointerup → drop/commit → re-render
 *
 * This is the strictly-user-path sibling of `move.spec.ts`, which drives
 * the same 40 plies directly into each library's state. The delta between
 * the two is the cost of the drag UI surface itself.
 *
 * We report aggregate wall-clock, p50/p95/max per-move time, plus long
 * tasks / dropped frames / max frame from the in-page rAF sampler. The
 * percentiles matter: averages hide outlier-driven stutter.
 *
 * The measurement harness fires synthetic PointerEvents from inside
 * `page.evaluate()` — no WebDriver round-trips contaminate input-to-paint
 * latency. A separate trace spec handles visible-video recording.
 */

import { test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library, recordScenario, throttleCpu } from "./lib.js";
import { GAME_40 } from "./tours.js";

const DRAG_STEPS = 32;

interface DragMetrics {
  readonly plys: number;
  readonly stepsPerDrag: number;
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
}

function percentile(sorted: ReadonlyArray<number>, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

async function measureDragStorm(
  page: import("@playwright/test").Page,
  library: Library,
): Promise<DragMetrics> {
  await gotoBoard(page, library);
  await throttleCpu(page, 4);

  await page.evaluate(() => (window.__gbBench__ ?? window.__ucrBench__)?.resetMetrics());

  const result = await page.evaluate(
    async ({ moves, steps }) => {
      const bench = window.__gbBench__ ?? window.__ucrBench__;
      if (bench === undefined) throw new Error("harness missing");

      const perMove: number[] = [];
      const start = performance.now();
      for (const [from, to] of moves) {
        const t0 = performance.now();
        await bench.dragFromTo(from, to, steps);
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
      };
    },
    { moves: GAME_40 as readonly (readonly [string, string])[], steps: DRAG_STEPS },
  );

  const sorted = [...result.perMove].sort((a, b) => a - b);

  return {
    plys: GAME_40.length,
    stepsPerDrag: DRAG_STEPS,
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
  };
}

const collected: Partial<Record<Library, DragMetrics>> = {};

for (const library of ALL_LIBRARIES) {
  test(`drag storm — ${library}`, async ({ page }) => {
    collected[library] = await measureDragStorm(page, library);
  });
}

test.afterAll(() => {
  recordScenario("dragStorm", collected);
});
