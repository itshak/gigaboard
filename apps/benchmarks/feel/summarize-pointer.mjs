/**
 * Plain-text pointer A/B comparison for GitHub Actions logs, step summary,
 * and screen readers. Diagnostic results only: never classify cache as
 * "faster" from fluctuating shared-runner WebKit timings.
 */
import { readFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const input = JSON.parse(readFileSync(resolve("feel-results/results.json"), "utf8"));
const tests = input.tests.filter((row) => row.title.includes("@pointerperf"));
if (tests.length !== 2 || tests.some((row) => row.status !== "PASS" || !row.metrics)) {
  throw new Error("Expected two passing @pointerperf runs with metric attachments");
}
const fixed = (value, decimals = 3) =>
  typeof value === "number" && Number.isFinite(value) ? value.toFixed(decimals) : "not measured";

const report = [
  "# GigaBoard macOS-hosted WebKit pointer A/B",
  "",
  "Runner: " + input.environment.platform + " (" + input.environment.arch + ")",
  "Test mode: alternating cache/live/live/cache; Playwright-injected browser input.",
  "NO native macOS mouse acceleration, physical cursor speed, Tauri WKWebView or input-to-photon timing was measured.",
  "Shared-runner timing deltas are diagnostic only; no cache On/Off performance winner can be declared.",
  "",
];
for (const row of tests) {
  const drag = row.title.includes("held-piece");
  report.push("## " + (drag ? "Held-piece drag" : "Idle hover and off-board control"), "");
  for (const trial of row.metrics.experiments) {
    report.push(
      "Run " + trial.run + " (" + trial.geometry + "): " +
      (drag
        ? "pointer-to-piece gain=" + fixed(trial.floatingPieceGain, 4) +
          ", tracking p95 error=" + fixed(trial.pointerToPieceErrorP95CssPx) + " CSS px" +
          ", drag dispatch p95=" + fixed(trial.dragDispatch.p95Ms) + " ms"
        : "on-board pointer travel=" + fixed(trial.boardPointerTravelCssPx, 1) + " CSS px" +
          ", off-board pointer travel=" + fixed(trial.outsidePointerTravelCssPx, 1) + " CSS px" +
          ", board dispatch p95=" + fixed(trial.boardDispatch.p95Ms) + " ms" +
          ", outside dispatch p95=" + fixed(trial.outsideDispatch.p95Ms) + " ms") +
      ", frame interval p95=" + fixed(trial.animationFrameIntervals.p95Ms) + " ms" +
      ", board rect reads=" + trial.boardBoundingRectReads + ".",
    );
  }
  if (drag) {
    const avg = row.metrics.averageBoardRectReads;
    report.push(
      "Average board geometry reads: cache=" + fixed(avg.cache, 1) +
      ", live=" + fixed(avg.live, 1) + ".",
    );
  }
  report.push("");
}
report.push(
  "Interpretation: the geometric assertions verify that cache On/Off does not alter",
  "browser pointer travel or floating-piece motion gain. Reported event and frame",
  "timings may motivate native investigation but do not establish user-perceived speed.",
  "",
  "Full raw metrics: feel-results/results.json; accessible report: feel-results/report.md.",
  "",
);
const text = report.join("\n");
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + "\n", "utf8");
}
