/**
 * @pointerperf — macOS-hosted Playwright WebKit A/B:
 * DOM event processing, hover movement, drag-to-pointer gain, geometry reads,
 * and animation-frame scheduling. No OS cursor acceleration or native
 * WKWebView / input-to-photon assertion is possible with Playwright mouse.
 *
 * Alternating cache/live/live/cache reduces (not eliminates) runner drift.
 * Timing values are diagnostics, not hard performance regression budgets.
 */
import { expect, test, type Page } from "@playwright/test";
import { attachMetrics, center, percentile, ready } from "./helpers.js";

const order = ["cache", "live", "live", "cache"] as const;

async function instrument(page: Page) {
  return page.evaluateHandle(() => {
    const board = document.querySelector<HTMLElement>("[data-gb-orientation]");
    const drag = document.querySelector<HTMLElement>('[data-layer="drag"]');
    if (!board || !drag) throw new Error("Missing live GigaBoard for pointer probe");

    // Instance-only wrapper: count calls by GigaBoard without modifying the
    // library, global DOM APIs, or published package. Restore after each run.
    const originalRect = board.getBoundingClientRect.bind(board);
    const rect = originalRect();
    let rectReads = 0;
    board.getBoundingClientRect = () => {
      rectReads++;
      return originalRect();
    };

    const before = new WeakMap<PointerEvent, number>();
    const samples: Array<{
      x: number; y: number; board: boolean; dispatchMs: number;
      active: boolean; transformX: number | null; transformY: number | null;
    }> = [];
    const capture = (event: PointerEvent): void => {
      before.set(event, performance.now());
    };
    // Registered after the board's drag listeners: reads the transform
    // written for this same pointermove, without waiting on Playwright.
    const complete = (event: PointerEvent): void => {
      const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0(?:px)?\)/.exec(drag.style.transform);
      samples.push({
        x: event.clientX,
        y: event.clientY,
        board: board.contains(event.target as Node),
        dispatchMs: performance.now() - (before.get(event) ?? performance.now()),
        active: drag.dataset["active"] === "true",
        transformX: match ? Number(match[1]) : null,
        transformY: match ? Number(match[2]) : null,
      });
    };
    window.addEventListener("pointermove", capture, true);
    window.addEventListener("pointermove", complete);

    const frames: number[] = [];
    let lastFrame: number | null = null;
    let running = true;
    let frameId = 0;
    const frame = (time: number): void => {
      if (!running) return;
      if (lastFrame !== null) frames.push(time - lastFrame);
      lastFrame = time;
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return {
      finish() {
        running = false;
        cancelAnimationFrame(frameId);
        window.removeEventListener("pointermove", capture, true);
        window.removeEventListener("pointermove", complete);
        // The test navigates before the next variant; still restore cleanly.
        board.getBoundingClientRect = originalRect;
        return {
          bounds: { left: rect.left, top: rect.top, width: rect.width },
          rectReads,
          samples,
          frameIntervalsMs: frames,
        };
      },
    };
  });
}

function distribution(values: number[]) {
  return {
    samples: values.length,
    p50Ms: percentile(values, 0.5),
    p95Ms: percentile(values, 0.95),
    maxMs: values.length ? Math.max(...values) : null,
  };
}

test("@pointerperf idle pointer hover on-board versus off-board, cache A/B", async ({ page }, info) => {
  test.setTimeout(180_000);
  const results = [];
  for (const [run, geometry] of order.entries()) {
    await ready(page, `?feel=1&geometry=${geometry}&threshold=2&animation=120`);
    const box = await page.locator("[data-gb-orientation]").boundingBox();
    if (!box) throw new Error("Board box is missing");
    const probe = await instrument(page);

    const fromX = box.x + 15;
    const toX = box.x + box.width - 15;
    const onBoardY = box.y + box.height * 0.45;
    const outsideY = box.y + box.height + 75;
    for (let step = 0; step <= 32; step++) {
      await page.mouse.move(fromX + (toX - fromX) * step / 32, onBoardY);
    }
    for (let step = 0; step <= 32; step++) {
      await page.mouse.move(fromX + (toX - fromX) * step / 32, outsideY);
    }
    const raw = await probe.evaluate((p) => p.finish());
    await probe.dispose();
    const boardMoves = raw.samples.filter((s) => s.board);
    const outsideMoves = raw.samples.filter((s) => !s.board);
    expect(boardMoves.length, "Browser must deliver real on-board pointermove events").toBeGreaterThan(20);
    expect(outsideMoves.length, "Browser must deliver real off-board control events").toBeGreaterThan(20);

    const onBoardTravel = boardMoves.at(-1)!.x - boardMoves[0]!.x;
    const offBoardTravel = outsideMoves.at(-1)!.x - outsideMoves[0]!.x;
    // Mouse movement coordinates are not scaled by the geometry-cache prop.
    // This checks browser event coordinates, NOT physical pointer sensitivity.
    expect(Math.abs(onBoardTravel - (toX - fromX))).toBeLessThan(2);
    expect(Math.abs(offBoardTravel - (toX - fromX))).toBeLessThan(2);
    expect(boardMoves.some((s) => s.active), "Hover must never activate drag").toBe(false);

    results.push({
      run: run + 1,
      geometry,
      boardPointerEvents: boardMoves.length,
      outsidePointerEvents: outsideMoves.length,
      boardPointerTravelCssPx: onBoardTravel,
      outsidePointerTravelCssPx: offBoardTravel,
      boardDispatch: distribution(boardMoves.map((s) => s.dispatchMs)),
      outsideDispatch: distribution(outsideMoves.map((s) => s.dispatchMs)),
      animationFrameIntervals: distribution(raw.frameIntervalsMs),
      boardBoundingRectReads: raw.rectReads,
    });
  }
  await attachMetrics(info, {
    experiments: results,
    order,
    invariant: "Cursor event movement must be 1:1 with driver CSS coordinates in either mode",
    comparison: "Inside-board hover vs outside-board control, cache/live/live/cache; p95 event dispatch and frame intervals are diagnostic only",
    measurementDomain: "Playwright WebKit pointermove delivery, synchronous handler duration, browser rAF and JS geometry reads",
    limitation: "Not native macOS mouse acceleration, HID sensitivity, compositor photons, Tauri WKWebView, or verified subjective feel",
  });
});

test("@pointerperf held-piece pixel gain and drag event timing, cache A/B", async ({ page }, info) => {
  test.setTimeout(180_000);
  const results: Array<{ geometry: "cache" | "live"; boardBoundingRectReads: number; [key: string]: unknown }> = [];
  for (const [run, geometry] of order.entries()) {
    await ready(page, `?feel=1&geometry=${geometry}&threshold=2&animation=120`);
    const start = await center(page, "e2");
    const waypoints = [
      start,
      await center(page, "e4"),
      await center(page, "c4"),
      await center(page, "c2"),
      start,
    ];
    const probe = await instrument(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let leg = 0; leg < waypoints.length - 1; leg++) {
      const a = waypoints[leg]!;
      const b = waypoints[leg + 1]!;
      for (let step = 1; step <= 12; step++) {
        await page.mouse.move(
          a.x + (b.x - a.x) * step / 12,
          a.y + (b.y - a.y) * step / 12,
        );
      }
    }
    await page.mouse.up();
    await expect(page.locator('[data-layer="drag"]')).toHaveAttribute("data-active", "false");
    expect(await page.evaluate(() => window.__gbFeelLab__?.moveCount())).toBe(0);
    const raw = await probe.evaluate((p) => p.finish());
    await probe.dispose();
    const tracked = raw.samples.filter((s) => s.active && s.transformX !== null && s.transformY !== null);
    expect(tracked.length, "Drag must produce many tracked samples").toBeGreaterThan(30);
    const errors = tracked.map((s) => Math.hypot(
      s.transformX! - (s.x - raw.bounds.left - raw.bounds.width / 16),
      s.transformY! - (s.y - raw.bounds.top - raw.bounds.width / 16),
    ));
    const maxError = Math.max(...errors);
    expect(maxError, "Floating piece must stay at pointer-centred coordinates").toBeLessThan(1.5);

    let pointerDistance = 0;
    let pieceDistance = 0;
    for (let i = 1; i < tracked.length; i++) {
      const last = tracked[i - 1]!;
      const next = tracked[i]!;
      pointerDistance += Math.hypot(next.x - last.x, next.y - last.y);
      pieceDistance += Math.hypot(next.transformX! - last.transformX!, next.transformY! - last.transformY!);
    }
    expect(pointerDistance).toBeGreaterThan(150);
    const pieceGain = pieceDistance / pointerDistance;
    // Explicitly detect the reported "same mouse movement, fewer piece pixels" scenario.
    expect(pieceGain, "A 100px pointer trajectory must produce ~100px floating-piece travel").toBeGreaterThan(0.98);
    expect(pieceGain).toBeLessThan(1.02);
    results.push({
      run: run + 1,
      geometry,
      pointerSamples: tracked.length,
      pointerDistanceCssPx: pointerDistance,
      pieceDistanceCssPx: pieceDistance,
      floatingPieceGain: pieceGain,
      pointerToPieceErrorP95CssPx: percentile(errors, 0.95),
      pointerToPieceErrorMaxCssPx: maxError,
      dragDispatch: distribution(tracked.map((s) => s.dispatchMs)),
      animationFrameIntervals: distribution(raw.frameIntervalsMs),
      boardBoundingRectReads: raw.rectReads,
    });
  }
  const averageReads = (geometry: "live" | "cache") =>
    results.filter((r) => r.geometry === geometry)
      .reduce((sum, r) => sum + r.boardBoundingRectReads, 0) / 2;
  const liveReads = averageReads("live");
  const cacheReads = averageReads("cache");
  // Validate that the variant genuinely exercises distinct geometry paths.
  expect(liveReads, "Live geometry should read the board rect more frequently")
    .toBeGreaterThan(cacheReads + 20);
  await attachMetrics(info, {
    experiments: results,
    order,
    averageBoardRectReads: { cache: cacheReads, live: liveReads },
    invariant: "Both variants must move the ghost 1 CSS px per 1 CSS px mouse movement, with <=1.5px geometric error",
    comparison: "Alternating A/B on the same hosted WebKit browser; timing metrics only, no CI winner selected",
    measurementDomain: "Pointer-to-CSS-transform geometry after browser pointer dispatch, callback dispatch duration, rAF scheduling and DOM rect reads",
    limitation: "No native WKWebView or physical macOS cursor acceleration; no measured input-to-photon latency",
  });
});
