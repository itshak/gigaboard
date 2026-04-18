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
> Results land in `apps/benchmarks/bench-results/{core,render,playwright}.json`.

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
| Render time on mount                    |       **28.14 ms**  |           24.48 ms       | = |
| **Commits per move**                    |         **1.00**    |              2.83        | **2.8× fewer** |
| **Render time per move**                |        **1.61 ms**  |              5.33 ms     | **3.3× faster** |
| 40-ply total render time                |       **64.4 ms**   |            213.2 ms      | **3.3× faster** |

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

## Real-browser head-to-head: Playwright + Chromium, 4× CPU throttle

Source: [`apps/benchmarks/bench/playwright/*.spec.ts`](apps/benchmarks/bench/playwright).
Every measurement runs the same scenario script against **three
libraries** via the same imperative `window.__ucrBench__` harness:

| Short name | Library | What it is |
|---|---|---|
| `ultra` | `@ultrachess/react` | This library. React + WASM engine + per-byte subscriptions. |
| `rcb`   | [`react-chessboard`](https://github.com/Clariity/react-chessboard) 5.10 | The most popular React chessboard on npm. Uses `chess.js`. |
| `cg`    | [`chessground`](https://github.com/lichess-org/chessground) 9.2 | Lichess.org's own board. Vanilla TypeScript, no React, no built-in chess rules (we wrap it with `chess.js`). GPL-3.0. |

CPU is throttled 4× via the CDP `Emulation.setCPUThrottlingRate` call
— a good proxy for a mid-range mobile device.

### Drag storm — 5 knight-tour drags, 64 pointer steps each

The scenario where hybrid-renderer design earns its keep. A drag fires
~300 `pointermove` events; a naïve library re-renders on each one.

| Metric                   |    `ultra`  |     `rcb`   |     `cg`    |
|--------------------------|------------:|------------:|------------:|
| Wall-clock total         |   **775 ms**|    1 430 ms |   **744 ms**|
| Long tasks (> 50 ms)     |      **0**  |       4     |      **0**  |
| Total blocking time      |    **0 ms** |     586 ms  |    **0 ms** |
| Worst frame duration     |    25.0 ms  |   200.1 ms  |  **9.3 ms** |
| Dropped frames (> 20 ms) |       1     |     10      |      **0**  |
| Median frame             |     8.3 ms  |     8.3 ms  |     8.3 ms  |

Ultra and chessground both drive the drag through direct DOM writes
rather than React state, and both land flat frame curves. `rcb` goes
through `@dnd-kit`'s React re-render cycle on every pointermove and
pays for it — 200 ms worst frame is a visible stutter. Chessground
edges Ultra on peak frame time (9 ms vs 25 ms) because it uses a
single compositor-composited board element with no per-square React
components; that one dropped frame in Ultra traces to the same root
we fixed in M7's AnimationRunner refactor, and is approaching the
floor of what a React board can do.

### Move storm — 40 plies back-to-back, no idle between moves

| Metric                   |    `ultra`  |     `rcb`   |     `cg`    |
|--------------------------|------------:|------------:|------------:|
| Wall-clock total         |   **661 ms**|    1 030 ms |   **660 ms**|
| ms per move              | **16.53 ms**|   25.74 ms  | **16.51 ms**|
| Long tasks (> 50 ms)     |      **0**  |       7     |      **0**  |
| Total blocking time      |    **0 ms** |     418 ms  |    **0 ms** |
| Worst frame duration     |   **9.3 ms**|    66.7 ms  |   **9.3 ms**|
| Dropped frames (> 20 ms) |      **0**  |       8     |      **0**  |

Ultra and chessground are identical within the noise floor — both
stay below the 16.6 ms per-frame budget, neither blocks the main
thread. `rcb` is 1.56× slower wall-clock and introduces **418 ms** of
blocking work + **8 dropped frames** over the same 40 moves.

### Cold mount — navigate, wait for Largest Contentful Paint

| Metric                        |   `ultra`   |   `rcb`    |    `cg`    |
|-------------------------------|------------:|-----------:|-----------:|
| LCP (board visible)           |     60 ms   |    76 ms   |  **52 ms** |
| Long tasks during mount       |      1      |     **0**  |     **0**  |
| Mount long-task total         |    256 ms   |    **0 ms**|    **0 ms**|

Honest read: chessground is the fastest to first paint (52 ms) — it's
vanilla TS with no framework or WASM init. Ultra trails by 8 ms and
pays a **256 ms WASM-init long task** on first load (the cost of a
zero-allocation engine). `rcb` and `cg` both use `chess.js`, which is
pure JS and costs nothing at startup. If a ~250 ms one-time init is
unacceptable for your use case, that trade-off is real — but every
*interaction* after that first paint is the numbers above.

### Read the three tables together

- **Ultra vs `react-chessboard`:** we win decisively on everything that
  happens after the first paint. During interactions, rcb spends roughly
  half its time blocked on React re-renders we don't do.
- **Ultra vs `chessground`:** we're within 1–4% on the
  interaction-speed metrics but trade a 8 ms LCP and the one-time
  WASM-init long task for a React-idiomatic API, SSR support, and a
  permissive MIT licence (chessground is GPL-3.0 — fine for open
  lichess-derived projects, incompatible with most commercial
  distribution models). The engine speed gap shows up in batch
  operations (see the core table above): we perft 117× faster than
  `chess.js` and 2 700× faster on legal-moves, so anywhere you'd call
  the engine off the hot path (analysis book-walk, puzzle next-move,
  cloud-eval batching) Ultra is dominant.

---

## What the benchmarks still do not measure

- **Input Delay (INP) on a real device.** Playwright's synthetic
  pointer events fire identically to a trusted input in Chromium, but
  real finger-on-glass latency includes display polling cycles we can't
  simulate. A Lighthouse Mobile CI run is the next upgrade.
- **Memory pressure during a long game.** We assert no leaks in
  `test/drag.test.tsx` / `test/chessboard.test.tsx`, but a multi-hour
  soak in Chromium with heap-delta tracking isn't in CI yet.

Everything in the three tables above is regenerated by `bun run
turbo bench` and committed to `apps/benchmarks/bench-results/`, so CI
will show any regression as a diff.

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
