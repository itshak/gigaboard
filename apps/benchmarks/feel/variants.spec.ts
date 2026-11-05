import { expect, test } from "@playwright/test";
import { attachMetrics, assertMove, center, drag, ready } from "./helpers.js";

test("origin ghost opacity variants are correctly applied", async ({ page }, info) => {
  for (const opacity of ["0", "0.35"]) {
    await ready(page, "?feel=1&ghost=" + opacity);
    const source = await center(page, "e2");
    await page.mouse.move(source.x, source.y);
    await page.mouse.down();
    await page.mouse.move(source.x + 8, source.y);
    const computed = await page.locator('[data-piece-square="e2"]').evaluate(
      (el) => getComputedStyle(el).opacity,
    );
    expect(Number(computed)).toBeCloseTo(Number(opacity), 2);
    await page.mouse.up();
  }
  await attachMetrics(info, {
    variants: ["0", "0.35"], evaluated: "computed origin opacity",
    measurementDomain: "CSS computed style, not independent captured pixels",
  });
});

for (const delay of [0, 5, 15, 40]) {
  test("callback pressure " + delay + " ms completes and leaves no floating piece", async ({ page }, info) => {
    await ready(page);
    await page.evaluate((ms) => window.__gbFeelLab__?.setCallbackDelay(ms), delay);
    await drag(page, "e2", "e4");
    await assertMove(page, "e2", "e4");
    const events = await page.evaluate(() => window.__gbFeelLab__?.events() ?? []);
    const start = events.find((e) => e.kind === "callback:start");
    const end = events.find((e) => e.kind === "callback:end");
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    if (!start || !end) throw new Error("Missing callback timing marks");
    expect(end.t - start.t).toBeGreaterThanOrEqual(Math.max(0, delay - 2));
    await attachMetrics(info, {
      requestedCallbackDelayMs: delay,
      observedCallbackDurationMs: end.t - start.t,
      measurementDomain: "browser performance.now; callback synchronous duration",
    });
  });
}

for (const duration of [0, 30, 60, 100]) {
  test("click-to-move remains playable with " + duration + " ms animation", async ({ page }, info) => {
    await ready(page, "?feel=1&animation=" + duration);
    const e2 = await center(page, "e2");
    const e4 = await center(page, "e4");
    await page.mouse.click(e2.x, e2.y);
    await page.mouse.click(e4.x, e4.y);
    await assertMove(page, "e2", "e4");
    await attachMetrics(info, {
      animationDurationMs: duration,
      measurementDomain: "config and logical correctness only; no latency inferred",
    });
  });
}

test("prefers-reduced-motion preserves keyboard and mouse functionality", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page, "?feel=1&animation=100");
  await drag(page, "e2", "e4");
  await assertMove(page, "e2", "e4");
});

test("audio cold start creates its pool once; cue invoked per accepted move", async ({ page }, info) => {
  await page.addInitScript(() => {
    const w = window as Window & { __feelAudio?: { created: number; plays: number } };
    const counters = { created: 0, plays: 0 };
    w.__feelAudio = counters;
    const NativeAudio = window.Audio;
    window.Audio = new Proxy(NativeAudio, {
      construct(target, args, newTarget) {
        counters.created++;
        return Reflect.construct(target, args, newTarget) as HTMLAudioElement;
      },
    });
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      counters.plays++;
      // Deliberately omit actual playback; test only the synchronous
      // initialization/cue path. No claim about audible onset.
      return Promise.resolve();
    };
    void originalPlay;
  });
  await ready(page, "?feel=1&sound=1");
  await drag(page, "e2", "e4");
  await assertMove(page, "e2", "e4");
  const first = await page.evaluate(() => (window as Window & {
    __feelAudio?: { created: number; plays: number };
  }).__feelAudio);
  expect(first?.created).toBe(28);
  expect(first?.plays).toBe(1);
  await page.evaluate(() => window.__gbFeelLab__?.reset());
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
  await drag(page, "e2", "e4");
  const second = await page.evaluate(() => (window as Window & {
    __feelAudio?: { created: number; plays: number };
  }).__feelAudio);
  expect(second?.created).toBe(first?.created);
  expect(second?.plays).toBe(2);
  await attachMetrics(info, {
    coldCreatedAudioElements: first?.created,
    coldTriggeredPlay: first?.plays,
    secondTriggeredPlay: second?.plays,
    measurementDomain: "JS constructor/play calls only; no audio playback timing",
  });
});
