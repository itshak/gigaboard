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
      },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
