import { expect, test } from "@playwright/test";
import { attachMetrics, ready } from "./helpers.js";

test("drag threshold sweep 0/1/2/3/4/6px - headless controller experiment", async ({ page }, info) => {
  await ready(page);
  const offsets = [0, 0.5, 1, 2, 3, 4, 5, 6];
  const tested: Array<{ distancePx: number; activationIndex: number | null }> = [];
  for (const distance of [0, 1, 2, 3, 4, 6]) {
    const index = await page.evaluate(
      ({ distance, samples }) => window.__gbFeelLab__?.thresholdProbe(distance, samples) ?? null,
      { distance, samples: offsets },
    );
    expect(index).toBe(offsets.findIndex((o) => o >= distance));
    tested.push({ distancePx: distance, activationIndex: index });
  }
  await attachMetrics(info, {
    thresholds: tested,
    measurementDomain: "pure state-machine event-distance behavior; no rendering or end-user speed inferred",
  });
});
