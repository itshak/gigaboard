# Performance

> Budgets, benchmarks, and how to profile. Performance is a contract we measure, not the product story.

## Performance Contract

Ultra Chess React is designed around strict React ownership boundaries. The public claim is not that every interaction is dramatically faster; it is that the board keeps expensive work scoped, measured, and regression-gated:

- A `BoardModel` owns chess state outside the component tree.
- A byte-level snapshot lets each square subscribe only to the data it renders.
- Drag, arrows, and piece movement use refs, Canvas 2D, and WAAPI instead of per-frame React state.
- Sub-6 KB core + sub-16 KB React-layer gzipped footprints.

The numbers behind that contract are committed as benchmarks in `apps/benchmarks` and enforced in CI.

## Budgets

| Metric | Budget | Enforcement |
|---|---|---|
| `gigaboard/core` gzip | < 10 KB | `size-limit` |
| `gigaboard` gzip | < 24 KB | `size-limit` |
| `gigaboard/pieces` gzip per set | < 2 KB | `size-limit` |
| `gigaboard/themes` gzip per theme | < 1 KB | `size-limit` |
| Re-renders per move | ≤ 4 | React Profiler bench |
| Re-renders per hover | 0 | React Profiler bench |
| Re-renders per drag frame | 0 | React Profiler bench |
| Re-renders per arrow draw gesture | 0 | React Profiler bench |
| Drag frame duration (throttled mobile) | ≤ 16.6 ms | PerformanceObserver bench |
| Legal-move cache hit rate (typical play) | ≥ 95 % | Instrumented counter |
| SSR static board client JS | 0 bytes | Next.js bundle analyzer |
| Lighthouse performance | ≥ 95 | Lighthouse CI |

A PR that regresses any budget is blocked.

## Why each budget exists

- **Gzip budgets:** consumers should be able to add a chessboard to a page without blowing the JS budget.
- **Re-renders per move ≤ 4:** a move changes 2 squares (from, to) plus at most 2 highlight slots. Anything more means a component is subscribing too broadly.
- **Re-renders per hover / drag / arrow:** these happen 60 times per second. Any React work per frame is a battery drain and a jank source.
- **Legal-move cache hit rate ≥ 95 %:** caching by `hash()` is cheap; if we're missing, something is wrong with invalidation.

## The core optimizations

1. **Byte-level snapshot.** The board is a `Uint8Array(64)`. Each square subscribes to its own byte. Move → 2–4 byte changes → 2–4 tiny re-renders.
2. **Canvas arrows.** Arrows render on a single `<canvas>` with imperative 2D calls. One React commit when the arrow set changes; drawing itself is not React's problem.
3. **Refs-only drag.** `pointerdown` sets a ref; `pointermove` writes `element.style.transform` directly. React never knows the drag is happening.
4. **WAAPI animations.** `element.animate(...)` runs off-thread on the compositor. Zero React work during the 60 ms animation window.
5. **`hash()`-keyed legal-move cache.** Engine `hash()` is O(1); cache key is free.
6. **Lazy piece image paths.** Piece sets are imported per set; unused sets are tree-shaken. Each set is ~660 B gzip.
7. **Server-only static board.** For docs, PGN viewers, embedded boards, the `gigaboard/server` export produces zero client JS.

## How to profile locally

```bash
# Baseline all benchmarks
bun run turbo bench

# Watch-mode profiling on a single benchmark
bun -F apps/benchmarks run bench:moves --watch

# Generate a React Profiler trace for a given flow
bun -F apps/benchmarks run profile -- --flow=move-and-undo
open bench-results/move-and-undo.cpuprofile  # in Chrome DevTools
```

Chrome DevTools → Performance tab → Record for 30 s, do the flow, stop. Look for:

- **Long tasks > 50 ms** (red in the timeline): any long task during interaction is a bug.
- **Composite-only animations** (green in the layer panel): pieces should move without triggering paint or layout.
- **React commits:** should be sparse. Hover should show zero commits; move should show one.

## Before you optimize

1. Confirm it's actually slow. Run the relevant benchmark.
2. Understand *why* it's slow. Chrome Performance trace first, hypothesis second.
3. Write a benchmark that captures the current number.
4. Change the code.
5. Diff the benchmark. If the numbers didn't move, revert — the optimization didn't work.

## Before you claim it's faster

Every perf claim in the README links to a committed benchmark. "It feels snappier" is never acceptable in a commit message, a PR description, or a changelog.

## Anti-patterns we reject

- **`React.memo` everything.** Fast by default, `memo` on hot paths after measurement.
- **Context for state.** Changing-Context is a hidden re-render broadcaster.
- **`useEffect` chains syncing state to state.** Model the derivation; don't re-derive.
- **Per-square `memo` of complex objects.** Byte-level subscription makes this unnecessary.
- **Animating React state.** Use WAAPI or CSS transitions, never `setState` in `requestAnimationFrame`.
- **`any` as an escape hatch.** Performance isn't worth correctness.

## Historical numbers

`bench-results/history.json` records every nightly run. `apps/docs/performance/` graphs them. If you push a perf win, capture the before/after in your PR — these graphs are the record of how we earned the budget.
