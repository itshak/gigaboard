/**
 * Follow-up validation for the 2px candidate, using the actual GigaBoard
 * React board and trusted browser-driver input. No timing or subjective
 * speed claims are inferred from this correctness/safety battery.
 */
import { expect, test } from "@playwright/test";
import { Chess } from "chess.js";
import { GAME_40 } from "../bench/playwright/tours.js";
import { assertMove, attachMetrics, center, clickMove, drag, ready, START_FEN } from "./helpers.js";

const position = (fen: string): string => fen.split(" ").slice(0, 2).join(" ");

const selectedGhost = async (page: import("@playwright/test").Page): Promise<boolean> =>
  (await page.locator('[data-layer="drag"]').getAttribute("data-active")) === "true";

test("@twopx click jitter under 2px remains a click at 2px and baseline 4px", async ({ page }, info) => {
  const jitters = [
    { id: "one-horizontal", dx: 1, dy: 0 },
    { id: "one-vertical", dx: 0, dy: 1 },
    { id: "one-diagonal", dx: 1, dy: 1 },
    { id: "negative-diagonal", dx: -1, dy: -1 },
    { id: "stationary", dx: 0, dy: 0 },
  ];
  const findings: Array<{ threshold: number; jitter: string; falsePickup: boolean; accepted: boolean }> = [];
  for (const threshold of [4, 2]) {
    for (const jitter of jitters) {
      await ready(page, "?feel=1&threshold=" + threshold);
      const a = await center(page, "e2");
      const b = await center(page, "e4");
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(a.x + jitter.dx, a.y + jitter.dy);
      const falsePickup = await selectedGhost(page);
      await page.mouse.up();
      await page.mouse.click(b.x, b.y);
      const fen = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
      const count = await page.evaluate(() => window.__gbFeelLab__?.moveCount() ?? -1);
      const expected = new Chess(START_FEN);
      expected.move("e4");
      const accepted = position(fen) === position(expected.fen()) &&
        count === 1 && !(await selectedGhost(page));
      findings.push({ threshold, jitter: jitter.id, falsePickup, accepted });
      expect(falsePickup, threshold + "px should ignore " + jitter.id).toBe(false);
      expect(accepted, threshold + "px click-to-move after " + jitter.id).toBe(true);
    }
  }
  await attachMetrics(info, {
    thresholds: [2, 4], jitters, findings,
    observation: "trusted Playwright mouse; DOM ghost activity + independent FEN/callback checks",
    limitation: "1px axis / sqrt(2)px diagonal jitter only; human motor jitter may be larger",
  });
});

test("@twopx first activation is earlier at 2px while both boards complete real drag", async ({ page }, info) => {
  const findings: Array<{ threshold: number; activeAtOnePx: boolean; activeAtTwoPx: boolean; activeAtFourPx: boolean }> = [];
  for (const threshold of [4, 2]) {
    await ready(page, "?feel=1&threshold=" + threshold);
    const a = await center(page, "e2");
    const b = await center(page, "e4");
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 1, a.y);
    const activeAtOnePx = await selectedGhost(page);
    await page.mouse.move(a.x + 2, a.y);
    const activeAtTwoPx = await selectedGhost(page);
    await page.mouse.move(a.x + 4, a.y);
    const activeAtFourPx = await selectedGhost(page);
    await page.mouse.move(b.x, b.y, { steps: 3 });
    await page.mouse.up();
    await assertMove(page, "e2", "e4");
    findings.push({ threshold, activeAtOnePx, activeAtTwoPx, activeAtFourPx });
    expect(activeAtOnePx).toBe(false);
    expect(activeAtTwoPx).toBe(threshold === 2);
    expect(activeAtFourPx).toBe(true);
  }
  await attachMetrics(info, {
    findings, measurementDomain: "CSS-pixel threshold crossing, not display latency",
  });
});

test("@twopx 40-ply mixed fast drag and click including castling stays legal", async ({ page }, info) => {
  test.setTimeout(180_000);
  await ready(page, "?feel=1&threshold=2");
  const expected = new Chess(START_FEN);
  for (let i = 0; i < GAME_40.length; i++) {
    const [from, to] = GAME_40[i]!;
    if (i % 2 === 0) await drag(page, from, to, 2);
    else await clickMove(page, from, to);
    expected.move({ from, to });
    const actual = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
    expect(position(actual), "2px 40-ply FEN mismatch at move " + (i + 1))
      .toBe(position(expected.fen()));
    expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount() ?? -1))
      .toBe(i + 1);
    expect(await selectedGhost(page)).toBe(false);
  }
  await attachMetrics(info, {
    threshold: 2, plys: GAME_40.length, allMovesAcceptedExactlyOnce: true,
    measurementDomain: "correctness only; Playwright automation speed is not human speed",
  });
});

test("@twopx trusted Chromium touch input differentiates fixed 2px and touch-adaptive 6px", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-feel", "CDP touch driver supported only in Chromium");
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    const findings: Array<{ threshold: string; activeAtOnePx: boolean; activeAtThreePx: boolean; activeAtSevenPx: boolean; realTouch: boolean }> = [];
    for (const threshold of ["2", "adaptive"]) {
      await ready(page, "?feel=1&threshold=" + threshold);
      const a = await center(page, "e2");
      const b = await center(page, "e4");
      await page.evaluate(() => {
        (window as Window & { __feelPointerType?: string }).__feelPointerType = "";
        window.addEventListener("pointerdown", (e) => {
          (window as Window & { __feelPointerType?: string }).__feelPointerType = e.pointerType;
        }, { once: true });
      });
      const send = async (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
        session.send("Input.dispatchTouchEvent", {
          type, touchPoints: type === "touchEnd" ? [] : [{ x, y, radiusX: 1, radiusY: 1 }],
        });
      await send("touchStart", a.x, a.y);
      await send("touchMove", a.x + 1, a.y);
      const activeAtOnePx = await selectedGhost(page);
      await send("touchMove", a.x + 3, a.y);
      const activeAtThreePx = await selectedGhost(page);
      await send("touchMove", a.x + 7, a.y);
      const activeAtSevenPx = await selectedGhost(page);
      await send("touchMove", b.x, b.y);
      await send("touchEnd", b.x, b.y);
      await assertMove(page, "e2", "e4");
      const pointerType = await page.evaluate(() =>
        (window as Window & { __feelPointerType?: string }).__feelPointerType ?? "");
      const realTouch = pointerType === "touch";
      findings.push({ threshold, activeAtOnePx, activeAtThreePx, activeAtSevenPx, realTouch });
      expect(realTouch, "input must arrive as real browser touch events").toBe(true);
      expect(activeAtOnePx).toBe(false);
      expect(activeAtThreePx).toBe(threshold === "2");
      expect(activeAtSevenPx).toBe(true);
    }
    await attachMetrics(info, {
      findings, measurementDomain: "Chromium CDP trusted touch event delivery; not physical touchscreen latency",
    });
  } finally {
    await session.detach();
  }
});
