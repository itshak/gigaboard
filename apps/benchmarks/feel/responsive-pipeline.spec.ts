/** Trusted Playwright A/B correctness, not native input-to-photon latency. */
import { expect, test } from "@playwright/test";
import { Chess } from "chess.js";
import { attachMetrics, center, clickMove, drag, ready, START_FEN } from "./helpers.js";

const moves = [
  ["e2", "e4"], ["e7", "e5"], ["g1", "f3"], ["b8", "c6"],
  ["f1", "c4"], ["g8", "f6"],
] as const;
const position = (fen: string): string => fen.split(" ").slice(0, 2).join(" ");

test("@dragperf cache on/off preserve 2px and 4px correctness with smooth 120ms and off", async ({ page }, info) => {
  test.setTimeout(180_000);
  const cases: Array<{ geometry: string; threshold: number; animation: number; verifiedPly: number }> = [];
  for (const geometry of ["live", "cache"]) {
    for (const threshold of [2, 4]) {
      for (const animation of [0, 120]) {
        await ready(page, `?feel=1&geometry=${geometry}&threshold=${threshold}&animation=${animation}`);
        const chess = new Chess(START_FEN);
        // Four drags and two clicks verify both input paths under animation.
        for (let ply = 0; ply < moves.length; ply++) {
          const [from, to] = moves[ply]!;
          if (ply % 3 === 2) await clickMove(page, from, to);
          else await drag(page, from, to, 3);
          chess.move({ from, to });
          const actual = await page.evaluate(() => window.__gbFeelLab__?.fen() ?? "");
          expect(position(actual), `FEN at ${geometry}/${threshold}/${animation}/ply${ply + 1}`)
            .toBe(position(chess.fen()));
          expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount()))
            .toBe(ply + 1);
          expect(await page.locator('[data-layer="drag"]').getAttribute("data-active"))
            .toBe("false");
        }
        cases.push({ geometry, threshold, animation, verifiedPly: moves.length });
      }
    }
  }
  await attachMetrics(info, {
    cases,
    comparison: "2x2x2 correctness matrix, fresh and cached rectangles, 120ms and 0ms",
    measurementDomain: "real Playwright pointer input and DOM/game state on browser",
    limitation: "Neither physical display latency nor native macOS Tauri WKWebView captured",
  });
});

test("@dragperf cached geometry re-centres a live floating piece after page scrolling", async ({ page }, info) => {
  await ready(page, "?feel=1&geometry=cache&threshold=2&animation=120");
  await page.evaluate(() => { document.body.style.minHeight = "2400px"; });
  const a = await center(page, "e2");
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 8, a.y);
  const layer = page.locator('[data-layer="drag"]');
  expect(await layer.getAttribute("data-active")).toBe("true");
  // Scroll capture must invalidate cached geometry. Preserve pointer capture
  // and avoid relying on a synthetic PointerEvent as the input driver.
  await page.evaluate(() => { window.scrollTo(0, 45); });
  await page.waitForFunction(() => window.scrollY >= 40);
  const shifted = await center(page, "e2");
  await page.mouse.move(shifted.x + 14, shifted.y);
  const transform = await layer.evaluate((node) => (node as HTMLElement).style.transform);
  const width = await page.locator("[data-gb-orientation]").evaluate((node) => node.getBoundingClientRect().width);
  const board = await page.locator("[data-gb-orientation]").evaluate((node) => {
    const rect = node.getBoundingClientRect(); return { left: rect.left, top: rect.top };
  });
  const expectedX = shifted.x + 14 - board.left - width / 16;
  const expectedY = shifted.y - board.top - width / 16;
  const components = /^translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*(?:0|0px)\)$/.exec(transform);
  expect(components, "Floating piece must have a real CSS translate3d").not.toBeNull();
  const measuredX = Number(components?.[1]);
  const measuredY = Number(components?.[2]);
  // WKWebKit reports fractional scroll and layout positions (for example
  // 299.53125px instead of 300px). Compare geometric coordinates with a
  // precise 1 CSS px tolerance instead of string equality.
  expect(Math.abs(measuredX - expectedX)).toBeLessThanOrEqual(1);
  expect(Math.abs(measuredY - expectedY)).toBeLessThanOrEqual(1);
  await page.mouse.up();
  expect(await layer.getAttribute("data-active")).toBe("false");
  await attachMetrics(info, {
    scrollY: await page.evaluate(() => window.scrollY),
    expectedX, expectedY, measuredX, measuredY, transform,
    limitation: "CSS geometry and 1px tolerance only; no captured presentation timing",
  });
});
