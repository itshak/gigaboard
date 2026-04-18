/**
 * Drag-storm scenario.
 *
 * Simulate a real user dragging a piece across the board under 4× CPU
 * throttle. We run 5 drags of 64 pointer steps each back-to-back — enough
 * work to surface any drag loop that accidentally goes through React
 * state every pointermove.
 *
 * Runs the same scenario against every library in the head-to-head.
 */

import { test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library, recordScenario, throttleCpu } from "./lib.js";

const DRAG_STEPS = 64;
const DRAG_ITERATIONS = 5;

interface DragMetrics {
  readonly iterations: number;
  readonly stepsPerDrag: number;
  readonly wallMs: number;
  readonly longTasks: number;
  readonly longTaskTotalMs: number;
  readonly maxFrameMs: number;
  readonly medianFrameMs: number;
  readonly droppedFrames: number;
}

async function measureDragStorm(
  page: import("@playwright/test").Page,
  library: Library,
): Promise<DragMetrics> {
  await gotoBoard(page, library);
  await throttleCpu(page, 4);

  // Drag a knight around: g1 → f3 → g5 → h3 → g1 → h3. Five legal
  // knight hops that keep both engines in sync so nothing is rejected
  // for illegality mid-scenario.
  const tour: Array<[string, string]> = [
    ["g1", "f3"],
    ["f3", "g5"],
    ["g5", "h3"],
    ["h3", "g1"],
    ["g1", "h3"],
  ];

  await page.evaluate(() => window.__ucrBench__?.resetMetrics());

  const result = await page.evaluate(
    async ({ tour, steps }) => {
      const bench = window.__ucrBench__;
      if (bench === undefined) throw new Error("harness missing");
      const start = performance.now();
      for (const [from, to] of tour) {
        await bench.dragFromTo(from, to, steps);
      }
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
      };
    },
    { tour, steps: DRAG_STEPS },
  );

  return {
    iterations: DRAG_ITERATIONS,
    stepsPerDrag: DRAG_STEPS,
    wallMs: Number(result.wallMs.toFixed(2)),
    longTasks: result.longTasks,
    longTaskTotalMs: Number(result.longTaskTotalMs.toFixed(2)),
    maxFrameMs: Number(result.maxFrameMs.toFixed(2)),
    medianFrameMs: Number(result.medianFrameMs.toFixed(2)),
    droppedFrames: result.droppedFrames,
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
