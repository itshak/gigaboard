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

const GAME_40: Array<[string, string]> = [
  ["e2", "e4"],
  ["c7", "c5"],
  ["g1", "f3"],
  ["d7", "d6"],
  ["d2", "d4"],
  ["c5", "d4"],
  ["f3", "d4"],
  ["g8", "f6"],
  ["b1", "c3"],
  ["g7", "g6"],
  ["c1", "e3"],
  ["f8", "g7"],
  ["f2", "f3"],
  ["e8", "g8"],
  ["d1", "d2"],
  ["b8", "c6"],
  ["e1", "c1"],
  ["d8", "a5"],
  ["c1", "b1"],
  ["f8", "d8"],
  ["h2", "h4"],
  ["c8", "e6"],
  ["h4", "h5"],
  ["f6", "h5"],
  ["g2", "g4"],
  ["h5", "f6"],
  ["e3", "h6"],
  ["g7", "h8"],
  ["h6", "e3"],
  ["f6", "g4"],
  ["d2", "h2"],
  ["g4", "f6"],
  ["h2", "h7"],
  ["g8", "f8"],
  ["f3", "f4"],
  ["d8", "c8"],
  ["f4", "f5"],
  ["e6", "d7"],
  ["f5", "g6"],
  ["f7", "g6"],
];

interface MoveMetrics {
  readonly plys: number;
  readonly wallMs: number;
  readonly msPerMove: number;
  readonly longTasks: number;
  readonly longTaskTotalMs: number;
  readonly maxFrameMs: number;
  readonly medianFrameMs: number;
  readonly droppedFrames: number;
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
  await page.evaluate(() => window.__ucrBench__?.resetMetrics());
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const result = await page.evaluate(async (moves) => {
    const bench = window.__ucrBench__;
    if (bench === undefined) throw new Error("harness missing");

    // Fire all 40 moves back-to-back with no rAF waits between — this
    // measures raw React + DOM work a library spends on each commit,
    // not the idle time between them. If a library can't drain 40
    // commits faster than a rAF budget * 40, the longtask observer
    // picks it up.
    const start = performance.now();
    for (const [from, to] of moves) {
      await bench.playMove(from, to);
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
  }, GAME_40);

  return {
    plys: GAME_40.length,
    wallMs: Number(result.wallMs.toFixed(2)),
    msPerMove: Number((result.wallMs / GAME_40.length).toFixed(3)),
    longTasks: result.longTasks,
    longTaskTotalMs: Number(result.longTaskTotalMs.toFixed(2)),
    maxFrameMs: Number(result.maxFrameMs.toFixed(2)),
    medianFrameMs: Number(result.medianFrameMs.toFixed(2)),
    droppedFrames: result.droppedFrames,
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
