# Ultra Chess React — Benchmarks

> Head-to-head numbers vs. `chess.js` (the engine `react-chessboard` uses
> internally) and `react-chessboard` v5.10.0 itself. Every number on this
> page is reproducible from a clean checkout:
>
> ```bash
> bun install
> bun run turbo bench
> ```
>
> Results land in `apps/benchmarks/bench-results/{core,render}.json`.

Numbers below were produced on an Apple-silicon MacBook running Node 25
with the lockfile committed in this repository. Relative speedups (the
numbers that matter) are stable across hardware; absolute ns/op will
shift on slower machines, but the shape of the comparison does not.

---

## Engine: `@ultrachess/core` + `ultrachess` (WASM)  vs  `chess.js`

Source: [`apps/benchmarks/scripts/bench-core.mjs`](apps/benchmarks/scripts/bench-core.mjs).
200 000 iterations per scenario, 10 000-iteration warmup, median of three
passes. Each scenario runs the same operation on both engines in the
same process so CPU-frequency scaling and GC pauses affect both sides
equally.

| Scenario                         | `@ultrachess/core` | `chess.js`         | Speed-up |
|----------------------------------|-------------------:|-------------------:|---------:|
| `tryMove` + `undo`               |     **280 ns/op**  |     32 926 ns/op   | **117×** |
| `legalMoves` (mid-game, verbose) |     **158 ns/op**  |    430 821 ns/op   | **2 728×** |
| Position key (hash / FEN)        |   **6.0 ns/op**    |        690 ns/op   | **115×** |
| `inCheck` + `isGameOver`         |     **114 ns/op**  |     14 113 ns/op   | **124×** |
| 40-ply game replay + rewind      |   **15.8 µs/op**   |    2.83 ms/op      | **179×** |

Construction cost (one-time):

- `@ultrachess/core`: **249 ms** cold, dominated by WASM compile/instantiate.
  Subsequent adapters in the same process are ~O(1) — the module is cached.
- `chess.js`: **0.5 ms**.

**What those numbers mean for a real app.** chess.js takes ~2.8 ms to
replay a 40-ply game; `@ultrachess/core` does the same work in ~16 µs.
For a puzzle trainer stepping through thousands of positions, or an
analysis board running a book walk, that's the difference between
"instant" and "wait, it's thinking". For a live UI the per-move cost is
already under the frame budget on both engines, so the win shows up in
battery life and background processing head-room rather than perceptible
latency. The real wins are in batch scenarios.

**Why `legalMoves` is ~2 700× faster.** `ultrachess` returns a packed
`u16` per move and generates them bitboard-parallel in WASM. `chess.js`
in `verbose` mode allocates a per-move object with `from`, `to`, `san`,
`captured`, `flags`, `piece`, and `color` fields — that's allocator
pressure on top of a slower generator. If you use `chess.js` in
non-verbose mode the gap narrows, but the React layer **needs** verbose
moves to decorate legal-target squares correctly.

---

## React layer: `@ultrachess/react`  vs  `react-chessboard` 5.10.0

Source: [`apps/benchmarks/bench/render-budget.bench.tsx`](apps/benchmarks/bench/render-budget.bench.tsx).
Both boards mount in parallel under happy-dom + `@testing-library/react`.
React's `<Profiler/>` onRender callback tracks commit count and actual
render duration across a 40-ply replay. Animations are disabled on both
boards for a like-for-like comparison.

| Metric                                  | `@ultrachess/react` | `react-chessboard` 5.10 | Win |
|-----------------------------------------|--------------------:|-------------------------:|----:|
| Commits on mount                        |            3        |              3           |  = |
| Render time on mount                    |       **28.96 ms**  |           29.92 ms       | +3 % |
| **Commits per move**                    |         **1.00**    |              2.83        | **2.8× fewer** |
| **Render time per move**                |        **1.82 ms**  |              5.30 ms     | **2.9× faster** |
| 40-ply total render time                |       **72.7 ms**   |            212.0 ms      | **2.9× faster** |

The commit count is the number that best predicts perceived smoothness
on slow devices. Every extra React commit is work that competes with
the compositor for the main thread. `@ultrachess/react` holds at one
commit per move — a move touches at most four squares, each of which
subscribes to its own byte of the board's `Uint8Array(64)`, and the
rest of the board is spared from any reconciliation work at all.

### Bundle size (gzip, minified, measured by `size-limit`)

| Package                          | Budget | Measured   |
|----------------------------------|-------:|-----------:|
| `@ultrachess/core`               |   6 KB |  **3.73 KB** |
| `@ultrachess/react`              |  14 KB | **12.32 KB** |
| `@ultrachess/react/server` (RSC) |   4 KB |  **2.27 KB** |
| `@ultrachess/pieces/{neo,…}`     |   2 KB |   **~615 B** per set |
| `@ultrachess/themes/{green,…}`   |   1 KB |   **~210 B** per theme |

For reference, `react-chessboard` 5.10.0's published bundle is ~40 KB
gzipped (you can verify with `bundlephobia.com/package/react-chessboard`).
Ultra Chess React + one piece set + one theme comes in under 14 KB.

---

## What the benchmarks do not measure yet

- **Throttled-mobile pointer latency.** happy-dom cannot faithfully
  emulate pointer-capture + compositor-composited transforms. A
  Playwright bench using Chromium with CPU-throttling set to 4× and the
  Pixel 7 device preset is the right next step here; it will land as
  `apps/benchmarks/bench/drag.pw.ts` in a follow-up. In the meantime,
  the refs-only drag loop is asserted in unit tests — see
  `packages/react/test/drag.test.tsx`.
- **Long-task regression tracking.** Chrome Performance recordings are
  currently gathered manually during release prep. A CI-driven Playwright
  job that fails on any long task > 50 ms during a canonical flow is the
  next missing guard.

Those two additions close the remaining gap between "we measured it"
and "CI will catch any regression of any performance claim in the
README." Everything quoted in the top two tables is CI-enforced today.

---

## Methodology notes

- **Fairness to chess.js / react-chessboard.** We use their supported
  APIs exactly as documented. chess.js gets `moves({ verbose: true })`
  because that matches the shape our React layer consumes.
  `react-chessboard` is driven by re-setting its `position` prop on each
  move — the idiomatic integration, matching every example in their
  README and matching how `g6chess-frontend` (an existing consumer of
  `react-chessboard`) uses it.
- **What we do not compare.** SAN rendering, PGN import/export, and
  draw-offer bookkeeping are things chess.js does and `ultrachess`
  delegates to the host. Those aren't hot-path React concerns and they
  aren't in our benchmark set.
- **Repeatability.** Each scenario runs a warmup pass and takes the
  median of three timed passes. `BENCH_ITERS=N` overrides iteration
  count for the Node bench; defaults are chosen to run in under 30 s on
  a modern laptop.
