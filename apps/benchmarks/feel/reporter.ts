/**
 * Accessible, screen-reader-friendly report writer. No colors or images are
 * required to understand pass/fail. Browser event timings are labeled proxies.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, platform, release, arch } from "node:os";
import { resolve } from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

type Outcome = "PASS" | "FAIL" | "INCONCLUSIVE" | "NOT_RUN";
interface RecordItem {
  id: string;
  project: string;
  title: string;
  status: Outcome;
  durationMs: number;
  reason: string;
  metrics: Record<string, unknown> | null;
}
class FeelReporter implements Reporter {
  private entries: RecordItem[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    const attachment = result.attachments.find((a) => a.name === "feel-metrics");
    let metrics: Record<string, unknown> | null = null;
    try {
      if (attachment?.body) metrics = JSON.parse(attachment.body.toString("utf8")) as Record<string, unknown>;
    } catch {
      metrics = { parseError: "Invalid feel-metrics attachment" };
    }
    const status: Outcome =
      result.status === "passed" ? "PASS" :
      result.status === "skipped" ? "NOT_RUN" :
      result.status === "interrupted" ? "INCONCLUSIVE" : "FAIL";
    const raw = result.errors.map((e) => e.message ?? String(e)).join(" | ");
    this.entries.push({
      id: test.id, project: test.parent.project()?.name ?? "unknown",
      title: test.title, status, durationMs: result.duration,
      reason: raw || (status === "PASS" ? "All assertions passed" : status),
      metrics,
    });
  }

  onEnd(result: FullResult): void {
    const dir = resolve(process.cwd(), "feel-results");
    mkdirSync(dir, { recursive: true });
    const environment = {
      schemaVersion: 1, createdAt: new Date().toISOString(),
      platform: platform(), arch: arch(), kernel: release(),
      node: process.version, cpu: cpus()[0]?.model ?? "unknown",
      build: process.env["GITHUB_SHA"] ?? "local-unidentified",
      browserEngines: [...new Set(this.entries.map((x) => x.project))],
      clock: "Browser performance.now, DOM mutation timestamps, and Playwright wall time; physical photons NOT measured",
      nativeCapture: "NOT_RUN",
      blindBaseAdapter: "NOT_RUN",
    };
    const summary = {
      PASS: this.entries.filter((e) => e.status === "PASS").length,
      FAIL: this.entries.filter((e) => e.status === "FAIL").length,
      INCONCLUSIVE: this.entries.filter((e) => e.status === "INCONCLUSIVE").length,
      NOT_RUN: this.entries.filter((e) => e.status === "NOT_RUN").length,
    };
    const payload = {
      schemaVersion: 1, overall: result.status === "passed" ? "PASS" : "FAIL",
      summary, environment, tests: this.entries,
      unavailable: {
        nativeMacFrameCapture: "NOT_RUN: ScreenCaptureKit driver not installed/run",
        realBlindBase: "NOT_RUN: separate application adapter not installed/run",
        physicalInputToPhoton: "NOT_MEASURED: external optical hardware required",
      },
    };
    writeFileSync(resolve(dir, "results.json"), JSON.stringify(payload, null, 2) + "\n");
    writeFileSync(resolve(dir, "environment.json"), JSON.stringify(environment, null, 2) + "\n");
    const lines = [
      "# GigaBoard FeelLab — automated nonvisual report",
      "",
      "Overall: " + payload.overall,
      "Passed: " + summary.PASS + "; failed: " + summary.FAIL +
      "; inconclusive: " + summary.INCONCLUSIVE + "; not run: " + summary.NOT_RUN,
      "",
      "## Coverage limitations",
      "- Browser event timestamps and DOM mutation observation are not physical display latency.",
      "- Screenshot/pixel assertions measure rendering correctness, not motion-to-photon timing.",
      "- Native macOS frame capture: NOT RUN unless a separate native report is attached.",
      "- Installed BlindBase integration: NOT RUN unless a separate native report is attached.",
      "- Physical display latency: NOT MEASURED.",
      "",
      "## Test results",
    ];
    for (const item of this.entries) {
      lines.push("", "### " + item.status + ": " + item.project + " — " + item.title,
        "Duration (whole test, including driver overhead): " + item.durationMs + " ms",
        "Reason: " + item.reason.replace(/\x1b\[[0-9;]*m/g, ""));
      if (item.metrics) lines.push("Metrics (measurement domains stated per test):", "\`\`\`json",
        JSON.stringify(item.metrics, null, 2), "\`\`\`");
    }
    lines.push("", "## Reproduction", "\`bun --cwd apps/benchmarks run feel:ci\`", "");
    writeFileSync(resolve(dir, "report.md"), lines.join("\n"));
  }
}
export default FeelReporter;
