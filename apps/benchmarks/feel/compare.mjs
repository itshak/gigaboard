#!/usr/bin/env node
/**
 * A conservative result comparator. Never grades raw cross-platform timing
 * or one-off samples as a calibrated regression gate.
 *
 * Usage:
 *   node feel/compare.mjs baseline.json candidate.json [budgets.json]
 *
 * budgets.json:
 * {"minSamples":3,"regressions":{"pickupDomProxyMs":{"maxRelativeIncrease":0.20,"maxAbsoluteIncreaseMs":3}}}
 */
import { readFileSync } from "node:fs";
import { platform } from "node:os";

const [baselinePath, candidatePath, budgetPath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  process.stderr.write("Usage: node feel/compare.mjs baseline.json candidate.json [budgets.json]\n");
  process.exit(2);
}
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const baseline = read(baselinePath);
const candidate = read(candidatePath);
const budgets = budgetPath ? read(budgetPath) : null;
const common = (obj) => ({
  platform: obj.environment?.platform,
  arch: obj.environment?.arch,
  cpu: obj.environment?.cpu,
  browsers: (obj.environment?.browserEngines ?? []).join(","),
});
const a = common(baseline), b = common(candidate);
if (JSON.stringify(a) !== JSON.stringify(b)) {
  process.stdout.write(
    "INCOMPARABLE: measurement environments differ. Do not rank results across hosts or browser engines.\n" +
    JSON.stringify({ baseline: a, candidate: b }, null, 2) + "\n",
  );
  process.exitCode = 2;
} else {
  const map = new Map(baseline.tests.map((t) => [t.project + ":" + t.title, t]));
  let regressions = 0;
  let comparisons = 0;
  let insufficient = 0;
  process.stdout.write("GigaBoard FeelLab — baseline comparison\n");
  process.stdout.write("Environment: " + a.platform + "/" + a.arch + "; " + a.browsers + "\n");
  for (const item of candidate.tests) {
    const prior = map.get(item.project + ":" + item.title);
    if (!prior || item.status !== "PASS" || prior.status !== "PASS") {
      process.stdout.write("INCONCLUSIVE " + item.project + ": " + item.title +
        " (missing or failed counterpart)\n");
      insufficient++;
      continue;
    }
    const oldMetrics = prior.metrics ?? {};
    const newMetrics = item.metrics ?? {};
    for (const [metric, newValue] of Object.entries(newMetrics)) {
      const oldValue = oldMetrics[metric];
      if (!Number.isFinite(newValue) || !Number.isFinite(oldValue)) continue;
      const delta = newValue - oldValue;
      const relative = oldValue === 0 ? null : delta / Math.abs(oldValue);
      process.stdout.write(
        item.project + " / " + item.title + " / " + metric +
        ": baseline " + oldValue.toFixed(3) + ", candidate " + newValue.toFixed(3) +
        ", delta " + delta.toFixed(3) +
        (relative === null ? "" : " (" + (relative * 100).toFixed(1) + "%)") + "\n",
      );
      comparisons++;
      const criterion = budgets?.regressions?.[metric];
      if (criterion) {
        // A single Playwright test result is not repeated calibrated testing.
        // Only permit a budget gate when each side carries >= minSamples runs.
        const oldRuns = prior.metrics?.repetitions;
        const newRuns = item.metrics?.repetitions;
        const count = budgets.minSamples ?? 3;
        if (!Number.isInteger(oldRuns) || !Number.isInteger(newRuns) ||
          oldRuns < count || newRuns < count) {
          process.stdout.write("INCONCLUSIVE: " + metric +
            " requires >= " + count + " independent calibrated runs per side\n");
          insufficient++;
          continue;
        }
        const overAbs = typeof criterion.maxAbsoluteIncreaseMs === "number" &&
          delta > criterion.maxAbsoluteIncreaseMs;
        const overRel = typeof criterion.maxRelativeIncrease === "number" &&
          relative !== null && relative > criterion.maxRelativeIncrease;
        if (overAbs && overRel) {
          process.stdout.write("REGRESSION: " + metric + " breached both gates\n");
          regressions++;
        }
      }
    }
  }
  process.stdout.write("Compared metrics: " + comparisons + "; regressions: " +
    regressions + "; inconclusive: " + insufficient + "\n");
  process.stdout.write(budgets ?
    "Budget status: " + (regressions ? "FAIL" : insufficient ? "INCONCLUSIVE" : "PASS") + "\n" :
    "Budget status: NOT_RUN (no calibrated budget provided)\n");
  if (regressions) process.exitCode = 1;
  if (budgets && insufficient && !regressions) process.exitCode = 2;
}
