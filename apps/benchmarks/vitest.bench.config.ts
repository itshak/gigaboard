import { defineConfig } from "vitest/config";

/**
 * A separate vitest config for the render-budget benchmarks so the
 * regular `bun run test` does not pick them up. Benchmarks run under
 * `bun run bench:render`.
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
