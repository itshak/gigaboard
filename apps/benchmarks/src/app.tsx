/**
 * Ultra Chess React benchmarks harness.
 *
 * Uses React's Profiler API + PerformanceObserver to record:
 * - Component re-render count per interaction.
 * - Frame duration during drag.
 * - Arrow redraw cost.
 * - Legal-move cache hit rate (via `@ultrachess/core`'s instrumented counter).
 *
 * Runs land in M2+ once the board exists. This file is scaffolding.
 */
export function App() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Ultra Chess React — Benchmarks</h1>
      <p>Harness lands in M2. See <code>docs/PERFORMANCE.md</code>.</p>
    </main>
  );
}
