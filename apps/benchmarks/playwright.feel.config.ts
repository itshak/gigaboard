/** Separate FeelLab suite; keeps historical Chromium benchmark runs unchanged. */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./feel",
  testMatch: "**/*.spec.ts",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["./feel/reporter.ts"]],
  use: {
    baseURL: "http://localhost:5175",
    trace: "retain-on-failure",
    video: "off",
    screenshot: "off",
    serviceWorkers: "block",
  },
  projects: [
    { name: "chromium-feel", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
    { name: "webkit-feel", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "bun run build && bun run preview",
    url: "http://localhost:5175",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
