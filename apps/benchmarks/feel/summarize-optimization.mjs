#!/usr/bin/env node
/**
 * Fully nonvisual, conservative optimization summary.
 * No physical input-to-photon or objective perceptual winner is claimed.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "feel-results");
const source = JSON.parse(readFileSync(resolve(root, "results.json"), "utf8"));
const row = source.tests.find((t) => t.title.includes("@optimize"));
if (!row?.metrics?.profiles || !row.metrics.samples) {
  throw new Error("No executed optimization metrics; do not publish an empty PASS");
}
const { profiles, samples, rounds } = row.metrics;
const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const rows = profiles.map((profile) => {
  const trials = samples.filter((s) => s.profileId === profile.id);
  const complete = trials.length === rounds;
  const correct = complete && trials.every((s) => s.acceptedTwoMoves && s.jitterClickAccepted &&
    s.error === null);
  const safeForOnePixelJitter = complete && trials.every((s) => !s.ghostAppearedDuringOnePixelClick);
  return {
    id: profile.id, ...profile,
    samples: trials.length,
    correct,
    safeForOnePixelJitter,
    eligible: correct && safeForOnePixelJitter,
    pickupDistanceMedianCssPx: median(trials.map((t) => t.firstPickupDistanceCssPx)),
    pickupDomHandlingMedianMs: median(trials.map((t) => t.pickupDomHandlingProxyMs)),
    dropCleanupDomProxyMedianMs: median(trials.map((t) => t.dropCleanupDomProxyMs)),
    failures: trials.filter((t) => t.error !== null).map((t) => t.error),
  };
});
const eligible = rows.filter((r) => r.eligible && r.pickupDistanceMedianCssPx !== null)
  .sort((a, b) => a.pickupDistanceMedianCssPx - b.pickupDistanceMedianCssPx ||
    (a.pickupDomHandlingMedianMs ?? Infinity) - (b.pickupDomHandlingMedianMs ?? Infinity));
const recommended = eligible[0] ?? null;
const baseline = rows.find((r) => r.id === "baseline-4px");
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  overall: source.overall,
  host: source.environment,
  rounds,
  recommendedForFurtherHumanTesting: recommended?.id ?? null,
  winnerCriterion: "1px click-jitter safety + correct repeated moves, then minimum observed pickup movement distance",
  noPerceptualWinnerCertified: true,
  browserTimingIsDiagnosticOnly: true,
  baseline,
  profiles: rows,
  nativeMac: "NOT_RUN",
  realBlindBase: "NOT_RUN",
};
mkdirSync(root, { recursive: true });
writeFileSync(resolve(root, "optimization-results.json"), JSON.stringify(report, null, 2) + "\n");
const lines = [
  "# GigaBoard FeelLab — A/B configuration screening",
  "",
  "Outcome: " + source.overall,
  "Trials per candidate: " + rounds,
  "Host: " + source.environment.platform + "/" + source.environment.arch,
  "Native macOS/BlindBase: NOT RUN; physical input-to-photon latency: NOT MEASURED.",
  "",
  "## Screening recommendation",
  recommended
    ? "Candidate for subjective testing: **" + recommended.id + "** (median pickup movement " +
      recommended.pickupDistanceMedianCssPx + " CSS px), compared with 4px baseline at " +
      baseline.pickupDistanceMedianCssPx + " CSS px."
    : "INCONCLUSIVE: no candidate met all correctness and 1px click-jitter safeguards.",
  "This is a ranking of the pickup-distance/click-safety trade-off, NOT a finding that a board feels faster.",
  "Origin opacity, animations, and audio are evaluated as controlled variants, but subjective feel cannot be ranked from DOM proxies.",
  "",
  "## Profile results",
  "| Profile | Two-move/click correctness | 1px click-jitter safe | Median pickup distance | DOM pickup handling proxy (ms) |",
  "|---|---|---|---:|---:|",
  ...rows.map((r) =>
    "| " + r.id + " | " + (r.correct ? "PASS" : "FAIL") +
    " | " + (r.safeForOnePixelJitter ? "PASS" : "RISK") +
    " | " + (r.pickupDistanceMedianCssPx ?? "NOT_RUN") +
    " | " + (r.pickupDomHandlingMedianMs?.toFixed(3) ?? "NOT_MEASURED") + " |"
  ),
  "",
  "## Interpretation",
  "- Each profile changes one setting relative to 4px threshold, pickup-on-move, opacity .35, 60ms animation, cold sound.",
  "- Mouse input uses actual Playwright browser events; threshold is an input-distance measurement, not a display time measurement.",
  "- DOM timings are browser-event-to-MutationObserver proxies susceptible to runner load and scheduling.",
  "- The touch-aware adaptive profile uses 2px mouse/pen and 6px touch; only mouse is measured in this optimization sweep.",
  "- 1px jitter tolerance is a declared design trade-off, not a universal accessibility or motor-control threshold.",
  "- No configuration or CI result changes production defaults automatically.",
  "- Further blind-user subjective testing and a calibrated native macOS path are required to claim a real feel improvement.",
  "",
  "Reproduce: bun --cwd apps/benchmarks run feel:optimize with FEELLAB_OPTIMIZE=1",
  "",
];
writeFileSync(resolve(root, "optimization-report.md"), lines.join("\n"));
console.log(lines.join("\n"));
if (!baseline?.eligible) process.exitCode = 1;
