import { test, expect } from "@playwright/test";
import { assertMove, attachMetrics, center, clickMove, drag, ready, reset } from "./helpers.js";
import { changedPixels, squareRegion } from "./pixels.js";

test.beforeEach(async ({ page }) => ready(page));

test("pickup threshold is measured and drag completes correctly", async ({ page }, info) => {
  const start = await center(page, "e2");
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 1, start.y);
  expect(await page.locator('[data-layer="drag"]').getAttribute("data-active")).toBe("false");
  await page.mouse.move(start.x + 7, start.y);
  expect(await page.locator('[data-layer="drag"]').getAttribute("data-active")).toBe("true");
  const target = await center(page, "e4");
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  await assertMove(page, "e2", "e4");
  const events = await page.evaluate(() => window.__gbFeelLab__?.events() ?? []);
  const down = events.find((e) => e.kind === "pointer:down");
  const active = events.find((e) => e.kind === "drag:active" && e.value === "true");
  const ended = events.find((e) => e.kind === "drag:active" && e.value === "false");
  expect(down).toBeDefined();
  expect(active).toBeDefined();
  expect(ended).toBeDefined();
  if (!down || !active || !ended) throw new Error("Missing drag timing marks");
  expect(active.t).toBeGreaterThanOrEqual(down.t);
  await attachMetrics(info, {
    pickupDomProxyMs: active.t - down.t,
    cleanupDomProxyMs: ended.t - down.t,
    measurementDomain: "browser event/MutationObserver (not actual presentation)",
  });
});

test("click-to-move and repeated input are correct", async ({ page }) => {
  await clickMove(page, "e2", "e4");
  await assertMove(page, "e2", "e4");
  await reset(page);
  await drag(page, "g1", "f3");
  await assertMove(page, "g1", "f3");
});

test("controlled callback load reveals drop-cleanup ordering", async ({ page }, info) => {
  await page.evaluate(() => window.__gbFeelLab__?.setCallbackDelay(15));
  await drag(page, "e2", "e4");
  await assertMove(page, "e2", "e4");
  const events = await page.evaluate(() => window.__gbFeelLab__?.events() ?? []);
  const start = events.find((e) => e.kind === "callback:start");
  const end = events.find((e) => e.kind === "callback:end");
  const hidden = events.find((e) => e.kind === "drag:active" && e.value === "false");
  expect(start).toBeDefined();
  expect(end).toBeDefined();
  expect(hidden).toBeDefined();
  if (!start || !end || !hidden) throw new Error("Callback/ghost marks absent");
  expect(end.t - start.t).toBeGreaterThanOrEqual(14);
  await attachMetrics(info, {
    callbackDurationMs: end.t - start.t,
    callbackToGhostHideProxyMs: hidden.t - end.t,
    measurementDomain: "browser event/MutationObserver, not displayed pixels",
  });
});

test("independent pixel oracle sees a dragged piece enter an empty square", async ({ page }, info) => {
  const from = await center(page, "e2");
  const near = await center(page, "e3");
  const target = await center(page, "e4");
  const board = page.locator("#bench-board");
  const roi = await squareRegion(page, "e4");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(near.x, near.y, { steps: 4 });
  const before = await board.screenshot({ animations: "allow" });
  await page.mouse.move(target.x, target.y, { steps: 4 });
  const after = await board.screenshot({ animations: "allow" });
  const diff = await changedPixels(page, before, after, roi);
  expect(diff.changedPixels, "the dragged piece must visibly enter e4").toBeGreaterThan(100);
  await page.mouse.up();
  await assertMove(page, "e2", "e4");
  await attachMetrics(info, {
    pixelsChangedOnDestination: diff.changedPixels,
    regionPixels: diff.totalPixels,
    measurementDomain: "rendered screenshot correctness, NOT motion-to-photon timing",
  });
});

test("pixel oracle rejects a deliberately hidden drag ghost (mutation test)", async ({ page }) => {
  const from = await center(page, "e2");
  const near = await center(page, "e3");
  const target = await center(page, "e4");
  const board = page.locator("#bench-board");
  const roi = await squareRegion(page, "e4");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(near.x, near.y, { steps: 4 });
  await page.locator('[data-layer="drag"]').evaluate((el) => { (el as HTMLElement).style.opacity = "0"; });
  const before = await board.screenshot({ animations: "allow" });
  await page.mouse.move(target.x, target.y, { steps: 4 });
  const after = await board.screenshot({ animations: "allow" });
  const diff = await changedPixels(page, before, after, roi);
  expect(diff.changedPixels, "hidden drag ghost must be rejected by pixel detector").toBeLessThan(100);
  await page.mouse.up();
});

test("same-square drag and release does not commit", async ({ page }) => {
  const a = await center(page, "e2");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 6, a.y);
  await page.mouse.move(a.x, a.y);
  await page.mouse.up();
  expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(0);
  expect(await page.locator('[data-layer="drag"]').getAttribute("data-active")).toBe("false");
});
