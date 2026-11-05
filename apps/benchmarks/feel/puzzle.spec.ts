import { expect, test } from "@playwright/test";
import { Chess } from "chess.js";
import { attachMetrics, clickMove, drag, ready, reset, START_FEN } from "./helpers.js";
import { GAME_40 } from "../bench/playwright/tours.js";

const samePosition = (fen: string) => fen.split(" ").slice(0, 2).join(" ");

test.beforeEach(async ({ page }) => ready(page));

test("40-ply chess sequence uses real pointer input and preserves game state", async ({ page }, info) => {
  const chess = new Chess(START_FEN);
  const start = Date.now();
  for (let i = 0; i < GAME_40.length; i++) {
    const [from, to] = GAME_40[i]!;
    if (i % 2 === 0) await drag(page, from, to, 5);
    else await clickMove(page, from, to);
    chess.move({ from, to });
    await expect.poll(async () =>
      samePosition(await page.evaluate(() => window.__gbFeelLab__?.fen() ?? ""))
    ).toBe(samePosition(chess.fen()));
    expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(i + 1);
  }
  await attachMetrics(info, {
    plys: GAME_40.length,
    wholeScenarioMs: Date.now() - start,
    measurementDomain: "Playwright wall clock includes automation overhead; not latency",
    allMovesAcceptedExactlyOnce: true,
  });
});

test("100 repeatable rapid scenarios spanning the 40 legal game positions", async ({ page }, info) => {
  test.setTimeout(300_000);
  const situations: Array<{ fen: string; from: string; to: string }> = [];
  const chess = new Chess(START_FEN);
  for (const [from, to] of GAME_40) {
    situations.push({ fen: chess.fen(), from, to });
    chess.move({ from, to });
  }
  const started = Date.now();
  for (let i = 0; i < 100; i++) {
    const s = situations[i % situations.length]!;
    await reset(page, s.fen);
    await drag(page, s.from, s.to, 3);
    const oracle = new Chess(s.fen);
    oracle.move({ from: s.from, to: s.to });
    await expect.poll(async () =>
      samePosition(await page.evaluate(() => window.__gbFeelLab__?.fen() ?? ""))
    ).toBe(samePosition(oracle.fen()));
    expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(1);
  }
  await attachMetrics(info, {
    scenarios: 100, uniqueStartingPositions: situations.length,
    wholeScenarioMs: Date.now() - started,
    measurementDomain: "end-to-end automated task throughput, NOT human equivalent timing",
    caveat: "these are repeatable positions from one 40-ply game, not 100 independent tactical puzzles",
  });
});

test("keyboard-only board move remains available", async ({ page }) => {
  await page.locator('[data-square="e2"]').focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator('[data-square="e3"]')).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator('[data-square="e4"]')).toBeFocused();
  await page.keyboard.press("Enter");
  const expected = new Chess(START_FEN);
  expected.move("e4");
  await expect.poll(async () =>
    samePosition(await page.evaluate(() => window.__gbFeelLab__?.fen() ?? ""))
  ).toBe(samePosition(expected.fen()));
  expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(1);
});
