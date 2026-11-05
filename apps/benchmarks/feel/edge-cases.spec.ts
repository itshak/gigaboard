import { expect, test } from "@playwright/test";
import { center, clickMove, drag, ready, START_FEN } from "./helpers.js";
import { Chess } from "chess.js";

test.beforeEach(async ({ page }) => ready(page));

test("illegal move is rejected and floating piece disappears", async ({ page }) => {
  const original = await page.evaluate(() => window.__gbFeelLab__?.fen());
  await drag(page, "e2", "e5");
  expect(await page.evaluate(() => window.__gbFeelLab__?.fen())).toBe(original);
  expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(0);
  await expect(page.locator('[data-layer="drag"]')).toHaveAttribute("data-active", "false");
});

test("release outside the board commits no move", async ({ page }) => {
  const original = await page.evaluate(() => window.__gbFeelLab__?.fen());
  const src = await center(page, "e2");
  await page.mouse.move(src.x, src.y);
  await page.mouse.down();
  await page.mouse.move(src.x + 80, src.y + 10, { steps: 4 });
  await page.mouse.move(1, 1, { steps: 4 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.__gbFeelLab__?.fen())).toBe(original);
  expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(0);
  await expect(page.locator('[data-layer="drag"]')).toHaveAttribute("data-active", "false");
});

test("rapid following move is accepted during prior animation window", async ({ page }) => {
  await ready(page, "?feel=1&animation=100");
  await clickMove(page, "e2", "e4");
  // The immediately following opponent move must be accepted, even
  // when a click-to-move piece glide would still be running.
  await drag(page, "e7", "e5", 2);
  const chess = new Chess(START_FEN);
  chess.move("e4");
  chess.move("e5");
  const actual = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
  expect(actual.split(" ").slice(0, 2)).toEqual(chess.fen().split(" ").slice(0, 2));
  expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(2);
});

test("a short movement below the 4px default threshold remains a click", async ({ page }) => {
  const src = await center(page, "e2");
  await page.mouse.move(src.x, src.y);
  await page.mouse.down();
  await page.mouse.move(src.x + 1, src.y);
  await expect(page.locator('[data-layer="drag"]')).toHaveAttribute("data-active", "false");
  await page.mouse.up();
  expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(0);
  const dst = await center(page, "e4");
  await page.mouse.click(dst.x, dst.y);
  const expected = new Chess(START_FEN);
  expected.move("e4");
  expect((await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "")).split(" ").slice(0, 2))
    .toEqual(expected.fen().split(" ").slice(0, 2));
});
