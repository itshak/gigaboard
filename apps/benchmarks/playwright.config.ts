import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — head-to-head bench runner.
 *
 * Chromium-only. We don't care about cross-browser coverage here — we
 * care about measurement quality, which is a Chrome DevTools Protocol
 * concern. The config boots Vite's dev server once for the entire suite
 * (deterministic port 5175, matching `vite.config.ts`).
 *
 * `workers: 1` because these tests measure main-thread work and frame
 * pacing; running two in parallel would give both browsers the CPU and
 * contaminate the numbers.
 */
export default defineConfig({
  testDir: "./bench/playwright",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5175",
    trace: "off",
    video: "off",
    screenshot: "off",
    // Disable service workers so the second scenario starts from a cold
    // network the same way the first does.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
        // `--enable-precise-memory-info` un-quantises
        // `performance.memory.usedJSHeapSize` — without it, Chromium
        // rounds cross-origin memory readings to coarse buckets for
        // privacy, and the heap-growth bench sees every library at
        // exactly the same rounded number. We only care about this in
        // bench mode; the flag never ships.
        launchOptions: {
          args: ["--enable-precise-memory-info"],
        },
      },
    },
  ],
  // Benchmarks run against a PRODUCTION build (not the dev server) so
  // React's dev-mode bloat — invariant checks, hook-dep tracking, extra
  // reconciler bookkeeping — doesn't inflate any library's per-commit
  // cost. Builds once, then serves via `vite preview` on the same port
  // Playwright points at. `reuseExistingServer` keeps iteration fast
  // locally; CI rebuilds every run.
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
