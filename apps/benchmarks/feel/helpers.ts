/** Real Playwright pointer input helpers; never synthetic PointerEvent dispatch. */
import { expect, type Page, type TestInfo } from "@playwright/test";
import { Chess } from "chess.js";

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export async function ready(page: Page, query = "?feel=1"): Promise<void> {
  await page.goto("/" + query);
  await page.waitForFunction(() => window.__gbFeelLab__?.ready === true && window.__gbBench__ !== undefined);
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

export async function center(page: Page, square: string): Promise<{ x: number; y: number }> {
  const result = await page.evaluate((name) => window.__gbBench__?.squareCentre(name) ?? null, square);
  if (!result) throw new Error("Missing square " + square);
  return result;
}

export async function drag(page: Page, from: string, to: string, steps = 5): Promise<void> {
  const a = await center(page, from);
  const b = await center(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  await page.mouse.up();
}

export async function clickMove(page: Page, from: string, to: string): Promise<void> {
  const a = await center(page, from);
  const b = await center(page, to);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
}

export async function reset(page: Page, fen = START_FEN): Promise<void> {
  await page.evaluate((value) => window.__gbFeelLab__?.reset(value), fen);
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

export async function assertMove(page: Page, from: string, to: string, fen = START_FEN): Promise<void> {
  const expected = new Chess(fen);
  const move = expected.move({ from, to, promotion: "q" });
  if (!move) throw new Error("Invalid test fixture: " + from + to);
  await expect.poll(async () => page.evaluate(() => window.__gbFeelLab__?.fen())).toBeTruthy();
  const got = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
  // En-passant target/clock formatting can vary by chess engine;
  // placement and side-to-move are sufficient for these independent tests.
  expect(got.split(" ").slice(0, 2)).toEqual(expected.fen().split(" ").slice(0, 2));
  expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(1);
  expect(await page.locator('[data-layer="drag"]').getAttribute("data-active")).toBe("false");
}

export async function attachMetrics(
  testInfo: TestInfo,
  metrics: Readonly<Record<string, unknown>>,
): Promise<void> {
  await testInfo.attach("feel-metrics", {
    body: Buffer.from(JSON.stringify(metrics), "utf8"),
    contentType: "application/json",
  });
}

export function percentile(samples: readonly number[], p: number): number | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))] ?? null;
}
