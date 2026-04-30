import { defineConfig } from "vitest/config";

/**
 * A separate vitest config for the render-budget benchmarks so the
 * regular `bun run test` does not pick them up. Benchmarks run under
 * `bun run bench:render`.
 *
 * ### Known limitation: this bench runs against DEV React
 *
 * Vitest defaults to `NODE_ENV=test`, which makes `react/index.js`
 * load `react.development.js`. Dev React adds invariant checks,
 * hook-dep tracking, and reconciler bookkeeping that inflates the
 * per-commit `actualDuration` the Profiler reports — typically 2-5×
 * the production cost.
 *
 * Attempts to force production React in this harness hit a
 * tooling cascade (vite's prod resolver externalises `node:` modules
 * in a way that breaks disk writes; happy-dom + `@testing-library/react`
 * depend on dev-only `React.act` plumbing; etc.). None of the
 * workarounds keep `bun run bench:render` idempotent enough to
 * publish numbers from.
 *
 * Consequence: the per-commit-duration numbers from this bench are
 * only useful as a relative comparison between the two libraries
 * under identical (dev) conditions. The RATIO is directionally
 * correct — dev overhead inflates both sides — but the absolute
 * numbers don't match what a shipped app pays.
 *
 * The **`commitsPerMove` number IS architectural** and exact: React
 * fires one commit per model update, so Ultra's 1.00 vs rcb's 2.83
 * reflects literal commit counts, independent of dev/prod. That
 * number is the one we publish; the `actualDuration` numbers are
 * kept in JSON for diff-tracking in CI but flagged as dev-mode in
 * the headline docs.
 *
 * The Playwright bench (`apps/benchmarks/bench/playwright/*.spec.ts`)
 * runs against a real production `vite build` and is the source of
 * truth for wall-clock numbers.
 */
export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["bench/**/*.bench.tsx"],
    // Disable coverage collection — benchmarks should not pay its overhead.
    coverage: { enabled: false },
    // Keep one suite per process so the memoised React root from scenario
    // A does not contaminate scenario B.
    pool: "threads",
    poolOptions: { threads: { singleThread: true } },
  },
});
