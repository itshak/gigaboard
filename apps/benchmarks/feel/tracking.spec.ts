import { expect, test } from "@playwright/test";
import { attachMetrics, center, ready, percentile } from "./helpers.js";

test("dragged element's transform tracks pointer without geometric offset", async ({ page }, info) => {
  await ready(page);
  const start = await center(page, "e2");
  const e4 = await center(page, "e4");
  const c4 = await center(page, "c4");
  const c2 = await center(page, "c2");
  const board = await page.locator("[data-gb-orientation]").boundingBox();
  if (!board) throw new Error("Board geometry unavailable");
  const squareSize = board.width / 8;
  const errors: number[] = [];
  const points = [start, e4, c4, c2, start];
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let leg = 0; leg < points.length - 1; leg++) {
    const a = points[leg]!;
    const b = points[leg + 1]!;
    for (let step = 1; step <= 16; step++) {
      const ratio = step / 16;
      const x = a.x + (b.x - a.x) * ratio;
      const y = a.y + (b.y - a.y) * ratio;
      await page.mouse.move(x, y);
      const actual = await page.locator('[data-layer="drag"]').evaluate((el) => {
        const t = (el as HTMLElement).style.transform;
        const m = t.match(/translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*0(?:px)?\)/);
        return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
      });
      expect(actual, "drag transform must be readable").not.toBeNull();
      if (actual) {
        const expectedX = x - board.x - squareSize / 2;
        const expectedY = y - board.y - squareSize / 2;
        errors.push(Math.hypot(actual.x - expectedX, actual.y - expectedY));
      }
    }
  }
  await page.mouse.up();
  expect(Math.max(...errors)).toBeLessThan(0.6);
  await expect(page.locator('[data-layer="drag"]')).toHaveAttribute("data-active", "false");
  expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(0);
  await attachMetrics(info, {
    pointerSamples: errors.length,
    transformPositionErrorP95CssPx: percentile(errors, 0.95),
    transformPositionErrorMaxCssPx: Math.max(...errors),
    measurementDomain: "CSS transform geometry after Playwright mouse move; NOT painted-frame tracking latency",
  });
});
