/**
 * INP (Interaction-to-Next-Paint) bench — the user-perceived latency.
 *
 * For each of the 40 Najdorf plies, fire two real OS-level clicks
 * (source square, then destination square), and measure the time
 * from the click event's `timeStamp` (the instant the browser
 * received the input) to the next paint that reflects the click's
 * effects. That's the exact definition of INP, sampled per
 * interaction, with no 16 ms rounding floor from Chromium's native
 * `PerformanceEventTiming` observer (which skips short events by
 * spec).
 *
 * Why manual timing instead of `PerformanceObserver({ type: "event" })`:
 *
 *   - The native INP observer honours a minimum `durationThreshold`
 *     of 16 ms (the spec floor; nothing we pass below that is
 *     accepted). Every click that commits in < 16 ms is silently
 *     dropped from the report, which for a fast library is most
 *     clicks — our previous run logged 3/80 entries for Ultra,
 *     0/80 for `cg`. That's useless for a comparative bench.
 *   - Manual `t1 - t0` where `t0 = event.timeStamp` and `t1 =
 *     performance.now()` inside a double-rAF after the handler runs
 *     gives us sub-ms resolution with no floor. Same definition of
 *     INP, just without the privacy rounding.
 *
 * Each library sees identical input — `page.mouse.click` — so any
 * gap is library work, not harness bias. 4× CPU throttle kept so
 * results are comparable to the other specs.
 */

import { test } from "@playwright/test";
import { ALL_LIBRARIES, gotoBoard, type Library, recordScenario, throttleCpu } from "./lib.js";
import { GAME_40 } from "./tours.js";

interface InpMetrics {
  readonly plys: number;
  readonly interactions: number;
  /** INP itself — the single worst interaction across the run.
   *  web.dev calls this "INP" for "Interaction to Next Paint" and
   *  treats the worst-of-the-session value as the page's INP grade. */
  readonly inpMs: number;
  readonly p50Ms: number;
  readonly p75Ms: number;
  readonly p90Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly meanMs: number;
  /** Count of interactions above web.dev's 200 ms "poor" threshold. */
  readonly slowCount: number;
  /**
   * Duration (ms) of every individual interaction, in occurrence order.
   * Rounded to 0.1 ms. Useful for spotting "first-move outlier" or
   * "castle-is-slow" patterns in a distribution that a summary would
   * hide.
   */
  readonly durations: ReadonlyArray<number>;
}

function percentile(sorted: ReadonlyArray<number>, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

/**
 * Install an in-page `click` listener that records, for every click
 * it observes, the time from the event's `timeStamp` (browser input
 * receipt) to the second `requestAnimationFrame` that fires after
 * the handlers return — i.e., the paint frame containing the click's
 * effects.
 *
 * Writes the measurements into `window.__inpDurations__`. Caller
 * collects them after all clicks land.
 */
async function installInpProbe(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: host-only probe type
    const w = window as any;
    w.__inpDurations__ = [];
    w.__inpPending__ = 0;
    document.addEventListener(
      "click",
      (e) => {
        const t0 = e.timeStamp;
        w.__inpPending__++;
        // Double-rAF — the first rAF fires before paint, the second
        // fires *after* the paint that contains the click's effect.
        // Matches the definition of "next paint" in INP.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            w.__inpDurations__.push(performance.now() - t0);
            w.__inpPending__--;
          });
        });
      },
      { capture: true },
    );
  });
}

async function measureInp(
  page: import("@playwright/test").Page,
  library: Library,
): Promise<InpMetrics> {
  await gotoBoard(page, library);
  await throttleCpu(page, 4);

  await installInpProbe(page);

  for (const [from, to] of GAME_40) {
    const src = await page.evaluate((sq) => (window.__gbBench__ ?? window.__ucrBench__)?.squareCentre(sq) ?? null, from);
    const dst = await page.evaluate((sq) => (window.__gbBench__ ?? window.__ucrBench__)?.squareCentre(sq) ?? null, to);
    if (src === null || dst === null) {
      throw new Error(`${library}: missing square centre for ${from}→${to}`);
    }
    await page.mouse.click(src.x, src.y);
    await page.waitForTimeout(40);
    await page.mouse.click(dst.x, dst.y);
    await page.waitForTimeout(40);
  }

  // Wait for any pending double-rAF samples to land.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        // biome-ignore lint/suspicious/noExplicitAny: host-only probe type
        const w = window as any;
        const check = (): void => {
          if (w.__inpPending__ === 0) resolve();
          else requestAnimationFrame(check);
        };
        check();
      }),
  );

  const unsorted = await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: host-only probe type
    const w = window as any;
    return (w.__inpDurations__ as number[]) ?? [];
  });
  const durations = [...unsorted].sort((a, b) => a - b);

  const total = durations.reduce((acc, d) => acc + d, 0);
  return {
    plys: GAME_40.length,
    interactions: durations.length,
    inpMs: Number((durations[durations.length - 1] ?? 0).toFixed(2)),
    p50Ms: Number(percentile(durations, 50).toFixed(2)),
    p75Ms: Number(percentile(durations, 75).toFixed(2)),
    p90Ms: Number(percentile(durations, 90).toFixed(2)),
    p95Ms: Number(percentile(durations, 95).toFixed(2)),
    p99Ms: Number(percentile(durations, 99).toFixed(2)),
    meanMs: durations.length > 0 ? Number((total / durations.length).toFixed(2)) : 0,
    slowCount: durations.filter((d) => d > 200).length,
    durations: unsorted.map((d) => Number(d.toFixed(1))),
  };
}

const collected: Partial<Record<Library, InpMetrics>> = {};

for (const library of ALL_LIBRARIES) {
  test(`inp — ${library}`, async ({ page }) => {
    test.setTimeout(120_000);
    collected[library] = await measureInp(page, library);
  });
}

test.afterAll(() => {
  recordScenario("inp", collected);
});
