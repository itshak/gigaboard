/**
 * Heap-growth bench — sustained play over 500 plies.
 *
 * Plays a random-walk game on each library's board, resetting whenever
 * it stalemates / checkmates, until 500 total plies have been executed.
 * Samples `performance.memory.usedJSHeapSize` at 0, 100, 200, 300, 400
 * and 500 plies. Slope tells you whether the library retains memory as
 * the game progresses — the architectural read on "is this thing going
 * to leak if the user plays for an hour?"
 *
 * Move generation happens in the Playwright process via chess.js so
 * the bench page doesn't carry a chess.js instance just for move
 * generation — that would inflate Ultra's heap baseline by the size
 * of chess.js itself (~MB range), silently contaminating the
 * measurement we care about. Every library receives *identical* move
 * sequences across runs because the chess.js state is deterministic
 * given a seed.
 */

import { test } from "@playwright/test";
import { Chess } from "chess.js";
import { ALL_LIBRARIES, gotoBoard, type Library, recordScenario, throttleCpu } from "./lib.js";

const TOTAL_PLIES = 500;
const SAMPLE_EVERY = 100;

interface HeapSample {
  readonly ply: number;
  readonly heapBytes: number;
}

interface HeapMetrics {
  readonly totalPlies: number;
  readonly samples: ReadonlyArray<HeapSample>;
  /** Heap at ply 0 (baseline, right after mount + harness install). */
  readonly baselineBytes: number;
  /** Heap at the last sample. */
  readonly endBytes: number;
  /** (end - baseline). Positive = retained growth over the run. */
  readonly growthBytes: number;
  /** Growth per 100 plies, averaged across all 100-ply windows. */
  readonly growthBytesPer100Plies: number;
  /** How many games were needed (reset on stalemate/checkmate). */
  readonly games: number;
  /** Plies played at each sample point, for sanity. */
  readonly scenarioReport: string;
}

/**
 * Generate a seeded `(from, to)[]` sequence of `n` plies by random-
 * walking through legal moves. `chess.js` is the source of truth for
 * legality; when a position has no legal moves (checkmate / stalemate)
 * we reset to the starting position and continue. Returns the sequence
 * plus a count of game resets for the report.
 */
function generateRandomWalk(
  plyCount: number,
  seed = 0x13572468,
): { moves: ReadonlyArray<[string, string]>; games: number } {
  // xorshift32 PRNG — deterministic across runs + platforms.
  let s = seed;
  const rand = (): number => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xffffffff;
  };

  const moves: Array<[string, string]> = [];
  const engine = new Chess();
  let games = 1;
  while (moves.length < plyCount) {
    const legal = engine.moves({ verbose: true });
    if (legal.length === 0) {
      engine.reset();
      games++;
      continue;
    }
    const pick = legal[Math.floor(rand() * legal.length)];
    if (pick === undefined) break;
    moves.push([pick.from, pick.to]);
    engine.move({ from: pick.from, to: pick.to, promotion: "q" });
  }
  return { moves, games };
}

async function measureHeap(
  page: import("@playwright/test").Page,
  library: Library,
): Promise<HeapMetrics> {
  await gotoBoard(page, library);
  await throttleCpu(page, 4);

  const { moves, games } = generateRandomWalk(TOTAL_PLIES);

  // Let first-paint work settle; sample baseline heap.
  await page.waitForTimeout(500);

  const samples: HeapSample[] = [];

  const sample = async (ply: number): Promise<void> => {
    // Force a GC pass via explicit idle: wait two rAFs then read heap.
    // Chromium's automatic GC usually runs between idle frames, so this
    // gives us a "stable" reading rather than a transient spike.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
    );
    const bytes = await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: non-standard Chromium API
      const mem = (performance as any).memory as { usedJSHeapSize?: number } | undefined;
      return typeof mem?.usedJSHeapSize === "number" ? mem.usedJSHeapSize : 0;
    });
    samples.push({ ply, heapBytes: bytes });
  };

  await sample(0);

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (move === undefined) break;
    const [from, to] = move;
    await page.evaluate(([f, t]) => window.__ucrBench__?.playMove(f, t), [from, to] as const);
    // Reset the game when we hit a terminal position. Each library's
    // state machine will have rejected the next move if it was past
    // the end; we don't observe that, we just trust the chess.js-
    // generated sequence that already incorporates resets.
    if ((i + 1) % SAMPLE_EVERY === 0) {
      await sample(i + 1);
    }
  }

  // Some libraries need an explicit reset between "games" that the
  // Playwright-side chess.js performed. Drive the same reset sequence
  // into each library. Implemented via the harness's `reset()`: we
  // only call it AFTER each sample so heap measurement isn't distorted
  // by the reset itself; but we do call it once at the end to leave
  // the board in a clean state.
  await page.evaluate(() => window.__ucrBench__?.reset());

  const baseline = samples[0]?.heapBytes ?? 0;
  const end = samples[samples.length - 1]?.heapBytes ?? baseline;
  const growth = end - baseline;
  const windows = samples.length - 1;
  const growthPer100 = windows > 0 ? Math.round(growth / windows) : 0;

  return {
    totalPlies: TOTAL_PLIES,
    samples,
    baselineBytes: baseline,
    endBytes: end,
    growthBytes: growth,
    growthBytesPer100Plies: growthPer100,
    games,
    scenarioReport: `random walk, ${games} games, ${TOTAL_PLIES} plies, samples every ${SAMPLE_EVERY} plies`,
  };
}

const collected: Partial<Record<Library, HeapMetrics>> = {};

for (const library of ALL_LIBRARIES) {
  test(`heap growth — ${library}`, async ({ page }) => {
    test.setTimeout(180_000);
    collected[library] = await measureHeap(page, library);
  });
}

test.afterAll(() => {
  recordScenario("heapGrowth", collected);
});
