import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Vite config for the Playwright head-to-head.
 *
 * We build two pages that look identical to the user but mount different
 * chessboards. Playwright navigates to each URL and runs the same
 * instrumented scenario, so any measured difference is attributable to
 * the library under test, not the harness.
 *
 * - `/` (`index.html`)       → Gigaboard (`<Chessboard/>`)
 * - `/rcb.html`              → `react-chessboard` (`<RcbChessboard/>`)
 *
 * Both entry bundles import a shared `bench-harness.ts` that installs
 * `window.__ucrBench__` with a uniform imperative API (`ready()`,
 * `playMove(from, to)`, `dragFromTo(...)`, `reset()`, `metrics()`).
 * Playwright tests drive that API in-page via `page.evaluate` so the
 * WebDriver round-trip never contaminates input-to-paint measurements.
 */
export default defineConfig({
  plugins: [react()],
  // `gigaboard/core` dev-only assertions read `process.env["NODE_ENV"]`
  // with bracket access, which Vite's built-in `process.env.NODE_ENV`
  // replacement does NOT rewrite. Stub `process.env` here so the browser
  // bundle doesn't throw `process is not defined` on first eval.
  define: {
    "process.env": JSON.stringify({ NODE_ENV: "production" }),
  },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      input: {
        ours: resolve(import.meta.dirname, "index.html"),
        rcb: resolve(import.meta.dirname, "rcb.html"),
        cg: resolve(import.meta.dirname, "cg.html"),
      },
    },
  },
  server: {
    // Deterministic dev-server port so Playwright's `webServer` block can
    // point at it without discovery. Matches `playwright.config.ts`.
    port: 5175,
    strictPort: true,
  },
  preview: {
    // Same port for `vite preview` so the Playwright config stays
    // unchanged whether we're running against dev or a production build.
    port: 5175,
    strictPort: true,
  },
});
