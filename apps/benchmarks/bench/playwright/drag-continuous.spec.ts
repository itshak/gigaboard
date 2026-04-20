/**
 * Continuous-drag scenario — the "0 re-renders per drag frame" bench.
 *
 * Picks up a piece, drags it around a closed rectangle for a sustained
 * pointermove storm, then drops back on the starting square so no
 * commit / re-render / animation happens. The only work the libraries
 * do during the recorded window is drag-frame handling — exactly the
 * hot path Ultra advertises.
 *
 * We drive this via the in-page synthetic-event harness (same as
 * `drag.spec.ts`) so the WebDriver round-trip cost doesn't contaminate
 * input-to-paint latency. The trace spec handles video.
 *
 * Why a rectangle: a straight back-and-forth is dominated by
 * direction-reversal artefacts on the drag layer. A rectangle exercises
 * all four cardinal directions and keeps the cursor over the board the
 * whole time.
 */

import { test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library, recordScenario, throttleCpu } from "./lib.js";

/** Closed rectangle starting and ending on `e2`, covering 5 squares
 *  worth of horizontal + 2 of vertical travel per loop. */
const PATH: ReadonlyArray<string> = ["e2", "e4", "c4", "c2", "e2"];
const STEPS_PER_LEG = 80;
const LOOPS = 3;

interface ContinuousDragMetrics {
  readonly loops: number;
  readonly stepsPerLeg: number;
  readonly totalPointerMoves: number;
  readonly wallMs: number;
  readonly longTasks: number;
  readonly longTaskTotalMs: number;
  readonly maxFrameMs: number;
  readonly medianFrameMs: number;
  readonly droppedFrames: number;
  readonly frameSamples: number;
}

async function measureContinuousDrag(
  page: import("@playwright/test").Page,
  library: Library,
): Promise<ContinuousDragMetrics> {
  await gotoBoard(page, library);
  await throttleCpu(page, 4);

  // Build a polyline that loops `LOOPS` times: [e2, e4, c4, c2, e2,
  // e4, c4, c2, e2, ...]. Each loop appends 4 new legs sharing the
  // closing vertex. This keeps one continuous drag for the full run.
  const polyline: string[] = [PATH[0] as string];
  for (let i = 0; i < LOOPS; i++) polyline.push(...PATH.slice(1));

  await page.evaluate(() => window.__ucrBench__?.resetMetrics());

  const result = await page.evaluate(
    async ({ path, steps }) => {
      const bench = window.__ucrBench__;
      if (bench === undefined) throw new Error("harness missing");
      const start = performance.now();
      await bench.dragPath(path, steps);
      const wallMs = performance.now() - start;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      const m = bench.metrics();
      return {
        wallMs,
        longTasks: m.longTasks.length,
        longTaskTotalMs: m.longTaskTotalMs,
        maxFrameMs: m.maxFrameMs,
        medianFrameMs: m.medianFrameMs,
        droppedFrames: m.droppedFrames,
        frameSamples: m.frameSamples,
      };
    },
    { path: polyline, steps: STEPS_PER_LEG },
  );

  const legs = polyline.length - 1;

  return {
    loops: LOOPS,
    stepsPerLeg: STEPS_PER_LEG,
    totalPointerMoves: legs * STEPS_PER_LEG,
    wallMs: Number(result.wallMs.toFixed(2)),
    longTasks: result.longTasks,
    longTaskTotalMs: Number(result.longTaskTotalMs.toFixed(2)),
    maxFrameMs: Number(result.maxFrameMs.toFixed(2)),
    medianFrameMs: Number(result.medianFrameMs.toFixed(2)),
    droppedFrames: result.droppedFrames,
    frameSamples: result.frameSamples,
  };
}

const collected: Partial<Record<Library, ContinuousDragMetrics>> = {};

for (const library of ALL_LIBRARIES) {
  test(`continuous drag — ${library}`, async ({ page }) => {
    collected[library] = await measureContinuousDrag(page, library);
  });
}

test.afterAll(() => {
  recordScenario("continuousDrag", collected);
});
