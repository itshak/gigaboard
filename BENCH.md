# Ultra Chess React — Benchmarks

> Head-to-head numbers against the two boards Ultra Chess React is
> actually compared with in the wild:
>
> - **`react-chessboard`** 5.10.0 — the most-installed React chessboard
>   on npm, built on `chess.js`.
> - **`chessground`** 9.2.0 — Lichess.org's own board. Vanilla
>   TypeScript, no React, no built-in chess rules (we wrap it with
>   `chess.js` to make it playable). GPL-3.0.
>
> Every number on this page regenerates from a clean checkout:
>
> ```bash
> bun install
> bun run turbo bench               # core + render micro-benches
> bun run bench:playwright -w apps/benchmarks   # 3-way browser bench
> ```
>
> Results land in [`apps/benchmarks/bench-results/{core,render,playwright}.json`](apps/benchmarks/bench-results/).
> All three JSON files are committed and tracked in CI so any
> regression shows up as a diff.
>
> Hardware: Apple-silicon MacBook, Node 25.7.0, Chromium shipped with
> Playwright 1.50, lockfile committed in this repo. Absolute ns/op and
> ms/op shift on slower hardware; relative speedups — the numbers that
> matter — are stable.

---

## Real-browser head-to-head (Playwright + Chromium, 4× CPU throttle)

This is the headline. All three libraries mount on the same Vite dev
server and are driven through the same `window.__ucrBench__` harness
so the scenario scripts are literally identical byte-for-byte between
runs. CPU is throttled 4× via CDP `Emulation.setCPUThrottlingRate` to
simulate a mid-range mobile device.

Short names in the tables:

| Short | Library                    | What it is                                                    |
|-------|----------------------------|---------------------------------------------------------------|
| `ultra` | `@ultrachess/react` 0.x  | This library. React + WASM engine + per-byte subscriptions.   |
| `rcb`   | [`react-chessboard`] 5.10| Most popular React chessboard on npm. Uses `chess.js`.        |
| `cg`    | [`chessground`] 9.2      | Lichess's own board. Vanilla TS, GPL-3.0, no React, no rules. |

[`react-chessboard`]: https://github.com/Clariity/react-chessboard
[`chessground`]: https://github.com/lichess-org/chessground

Source: [`apps/benchmarks/bench/playwright/*.spec.ts`](apps/benchmarks/bench/playwright).

### Drag storm — 5 knight-tour drags, 64 pointer steps each

The scenario where a hybrid imperative-drag design earns its keep. A
single drag fires ~300 `pointermove` events; a naïvely-implemented
React board re-renders on every one of them.

| Metric                   |    `ultra`   |     `rcb`    |     `cg`    |
|--------------------------|-------------:|-------------:|------------:|
| Wall-clock total         | **750 ms**   |   1 429 ms   | **744 ms**  |
| ms saved vs `rcb`        | **−679 ms**  |   (baseline) | **−685 ms** |
| Long tasks (> 50 ms)     |   **0**      |       4      |    **0**    |
| Total blocking time      | **0 ms**     |     580 ms   |   **0 ms**  |
| Worst frame duration     |   15.7 ms    |   191.8 ms   | **9.4 ms**  |
| Dropped frames (> 20 ms) |   **0**      |       10     |    **0**    |
| Median frame             |    8.3 ms    |      8.4 ms  |     8.3 ms  |

Ultra and chessground both drive the drag through direct DOM writes
(Ultra via an imperative drag-layer controller, chessground via its
own imperative renderer) and both land flat frame curves. `rcb` goes
through `@dnd-kit`'s React re-render cycle on every `pointermove` and
pays for it: a **191 ms** worst frame is a visible stutter, and the
**580 ms of blocking time** is enough to miss multiple input deadlines
in a row. Chessground edges Ultra on peak frame time (9 vs 16 ms)
because it's one compositor-composited board element with zero React
components involved. Ultra trades those 6 ms for a React-idiomatic
API, SSR, and a permissive licence (more below).

### Move storm — 40 plies back-to-back, no idle between moves

The other shape of main-thread pressure: instead of one long gesture,
40 state transitions fired as fast as the harness can dispatch them.

| Metric                   |    `ultra`    |     `rcb`    |     `cg`     |
|--------------------------|--------------:|-------------:|-------------:|
| Wall-clock total         | **661 ms**    |   1 152 ms   | **661 ms**   |
| ms per move              | **16.5 ms**   |    28.8 ms   | **16.5 ms**  |
| Long tasks (> 50 ms)     |   **0**       |       9      |    **0**     |
| Total blocking time      | **0 ms**      |     549 ms   |   **0 ms**   |
| Worst frame duration     |  **9.4 ms**   |    66.5 ms   |  **9.4 ms**  |
| Dropped frames (> 20 ms) |   **0**       |      10      |    **0**     |

Ultra and chessground are indistinguishable within noise — both sit
below the 16.6 ms per-frame budget and never block the main thread.
`rcb` is 1.74× slower wall-clock and produces **549 ms of blocking
work plus 10 dropped frames** across the same 40 moves.

### Cold mount — navigate, wait for Largest Contentful Paint

Single-board mount, the simplest case:

| Metric                      |   `ultra`   |    `rcb`    |    `cg`    |
|-----------------------------|------------:|------------:|-----------:|
| LCP (board visible)         |    56 ms    |    80 ms    | **52 ms**  |
| Long tasks during mount     |      1      |     **0**   |    **0**   |
| Mount long-task total       |   255 ms    |    **0 ms** |   **0 ms** |

Ultra and `cg` are within 4 ms on LCP — Ultra's `fallbackFen`
static piece-layer path plus dynamic `import("ultrachess/inline")`
keeps the ~250 ms WASM compile off the critical path, so first
paint no longer blocks on it. `rcb` trails by ~25 ms because its
initial React commit renders the whole board against `chess.js`
rather than from a static FEN. The WASM init long task is still
there — it has to happen somewhere — but it runs after the user
already sees the board, and the engine hydrates in the background.

### Grid mount — 1, 10, 100 boards on one page

The puzzle-grid / opening-tree / analysis-preview shape: many
boards painted at once. The per-board cost of each library shows up
honestly here, and the scaling curve exposes where design choices
pay off. Each library's `?grid=N` entry is cold-navigated in a
fresh Playwright context; the spec waits for every board's
`data-grid-board` marker to time paint, then for the engine
`ready` promise to time interactive, then snapshots host-side
metrics via CDP (`Performance.getMetrics` for JS heap,
`Memory.getDOMCounters` for nodes). A warmup pass fires first so
the Vite dev-server transform cache doesn't inflate the `N = 1`
column.

Source: [`apps/benchmarks/bench/playwright/grid.spec.ts`](apps/benchmarks/bench/playwright/grid.spec.ts).

Two timings per cell, because they're different questions:

- **`paintMs`** — wall-clock until all N boards are visible (pieces
  painted, grid laid out). The number that matters to the user.
- **`interactiveMs`** — wall-clock until every board is playable
  (engines hydrated). The number that matters the moment a click
  lands.

For `rcb` and `cg`, paint and interactive are essentially the
same — both boot their engines synchronously, so pieces appear on
the same frame the engines are ready. For Ultra, the two are
deliberately decoupled: `<Chessboard/>` accepts a `fallbackFen`
prop that paints pieces from a parsed FEN on the very first React
commit, and the WASM engine is dynamic-imported off the critical
path so its ~250 ms compile doesn't block the first paint.

**Headline numbers at N = 100:**

| Metric (N = 100)         |   `ultra`    |     `rcb`    |     `cg`    |
|--------------------------|-------------:|-------------:|------------:|
| Paint (board visible)    |  **404 ms**  |     956 ms   | **203 ms**  |
| Interactive (engines up) |    888 ms    |     960 ms   | **205 ms**  |
| Largest Contentful Paint |   300 ms     |     540 ms   | **268 ms**  |
| JS heap used             |  **44.8 MB** |    120.6 MB  | **5.6 MB**  |
| DOM nodes                |  **15 940**  |     53 332   | **15 939**  |
| Long tasks during mount  |   4 / 673 ms |   4 / 866 ms | 1 / 112 ms  |

**Scaling — the more interesting view.** Each column holds the
`{N=1, N=10, N=100}` series for that library. Paint time first:

| Paint time (ms)        | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| N = 1                  |      **60**          |         98           |        **64**        |
| N = 10                 |     **124**          |        226           |        **77**        |
| N = 100                |     **404**          |        956           |       **203**        |

Ultra's paint time matches `cg` at N = 1 (60 vs 64 ms) and now
beats `rcb` at every N — the FEN-fallback path means each
`<Chessboard/>` renders pieces on the same first commit the cells
lay out on, with no wait for WASM.

Interactive time next — when the engine is live and a click would
play a move:

| Interactive time (ms)  | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| N = 1                  |         329          |       **99**         |        **66**        |
| N = 10                 |         441          |         227          |        **78**        |
| N = 100                |         888          |         960          |       **205**        |

Ultra trades a slower interactive time for a faster paint — the
WASM compile still runs, it just runs off the main thread's
critical path. For use cases where the majority of boards are
display-only (puzzle previews, opening-tree branches the user
hasn't clicked into), paint is the metric that matters. For the
single interactive board, the engine is warm by the time anyone
can click.

| JS heap used (MB)      | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| N = 1                  |       4.34           |       6.13           |      **3.35**        |
| N = 10                 |      10.52           |      19.41           |      **3.79**        |
| N = 100                |     **44.8**         |     120.6            |      **5.6**         |

| DOM nodes              | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| N = 1                  |     **199**          |        565           |        594           |
| N = 10                 |    **1 630**         |      5 362           |      1 989           |
| N = 100                |   **15 940**         |     53 332           |     15 939           |

**Per-board marginal cost** — derived from
`(metric[N=100] − metric[N=1]) / 99`, i.e. what each extra board
after the first actually costs you:

| Per-additional-board   | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| Paint time             |      **3.5 ms**      |       8.7 ms         |      **1.4 ms**      |
| Interactive time       |        5.6 ms        |       8.7 ms         |      **1.4 ms**      |
| JS heap                |      **0.41 MB**     |       1.16 MB        |     **0.023 MB**     |
| DOM nodes              |      **159**         |         533          |        155           |

**How to read this:**

- **`rcb` degrades worst with N.** At N=1 it's still a reasonable
  React board. At N=100 paint takes almost a full second — each
  extra `<Chessboard/>` drags in another `chess.js` instance
  (~1.16 MB of heap per board) and ~533 more DOM nodes, and all
  that work serialises into the first commit because there's no
  way to defer it.
- **Ultra now beats `rcb` on paint at every N.** The marginal
  per-board paint cost (3.5 ms) is half of `rcb`'s (8.7 ms) and
  Ultra's 99-extra-board paint delta (344 ms at N = 100 − N = 1)
  is dominated by React reconciliation of 15.9 k extra DOM nodes,
  not engine work. At N=100 Ultra uses **2.7× less JS heap** and
  **3.3× fewer DOM nodes** than `rcb`.
- **`cg` remains the ceiling.** No React, no JSX, no WASM, no
  per-board engine module. At 100 boards it uses **5.6 MB total**
  — 8× less than Ultra and 22× less than `rcb`. The cost: no
  React API, GPL-3.0 licence.

**The optimisation that made this possible** (for reviewers):

1. **`fallbackFen` prop on `<Chessboard/>`.** When `game` is `null`
   and `fallbackFen` is supplied, a new `<StaticPieceLayer/>` renders
   pieces from the parsed FEN with zero engine dependency and zero
   effects. It emits DOM bit-identical to the interactive
   `<PieceLayer/>`, so the hand-off when the real engine resolves is
   a diff-only reconcile with no layout shift.
2. **Deferred WASM import.** The bench page loads `ultrachess/inline`
   through a dynamic `import(...)` inside `useEffect`, so the module
   (which compiles the embedded WASM at eval time) isn't in the
   first-paint bundle. By the time it finishes loading, the board is
   already visible.

Both primitives ship in `@ultrachess/react` and are available to any
consumer — `fallbackFen` is a one-line prop; the deferred-import
pattern is copy-pasteable from
[`apps/benchmarks/src/grid-ours.tsx`](apps/benchmarks/src/grid-ours.tsx).

The practical takeaway: if you're rendering more than one board on a
page — puzzle wall, study tree, game-list preview, analysis
branches — Ultra with `fallbackFen` paints pieces as fast as the
browser can lay out a CSS grid, and the engines hydrate in the
background. If you don't need React at all, `cg` still wins on
pure resource footprint.

### Reading all four tables together

- **Ultra vs `react-chessboard`:** we dominate every user-visible
  metric. Wall-clock: 1.55× faster on moves, 1.86× faster on drags.
  Grid paint at N=100: **2.37× faster**, using **2.7× less JS heap
  and 3.3× fewer DOM nodes**. `rcb` spends roughly a third to half
  of its interaction time **blocked on React re-renders that Ultra
  doesn't do at all**, and drops enough frames to be felt.
- **Ultra vs `chessground`:** within 4 ms on single-board LCP and
  paint (both now use a static-piece-layer first commit; Ultra's
  path shipped as the `fallbackFen` prop). `cg` still wins the
  grid-mount scaling table outright — no React is just cheaper.
  We pay a ~250 ms
  WASM-init long task; they pay a GPL-3.0 licence and
  bring-your-own-rules engine. The engine itself — see the core
  table below — is where Ultra pulls decisively ahead (≥117× faster
  than `chess.js`), so anywhere the host app actually calls the
  engine off the hot path (analysis book-walk,
  puzzle next-move, cloud-eval batching) Ultra is the only option of
  the three that scales.

---

## React layer: `@ultrachess/react` vs `react-chessboard` 5.10

A tighter micro-bench that removes the browser and measures the React
work directly. Both boards mount under happy-dom +
`@testing-library/react`; a `<Profiler/>` onRender callback records
commit count and React's own "actual duration" across a 40-ply
Najdorf replay. Animations are disabled on both sides for a
like-for-like comparison.

Source: [`apps/benchmarks/bench/render-budget.bench.tsx`](apps/benchmarks/bench/render-budget.bench.tsx).

| Metric                                  | `@ultrachess/react` | `react-chessboard` 5.10 | Result          |
|-----------------------------------------|--------------------:|------------------------:|-----------------|
| Commits on mount                        |           3         |              3          |   =             |
| Render time on mount                    |       **26.92 ms**  |          44.07 ms       | **1.64× faster**|
| **Commits per move**                    |       **1.00**      |              2.83       | **2.8× fewer**  |
| **Render time per move**                |      **0.18 ms**    |           5.75 ms       | **31.8× faster**|
| 40-ply total React work                 |       **7.22 ms**   |         230.06 ms       | **31.8× faster**|

The commit count is the metric that best predicts perceived
smoothness on a slow device: every extra React commit is work
competing with the compositor for the main thread. Ultra holds at
**exactly one commit per move**. A move only ever touches at most
four squares (from, to, rook-from and rook-to on castling), each
square subscribes to its own byte of the board's `Uint8Array(64)`
via `useSyncExternalStore`, and the rest of the board is spared from
reconciliation entirely.

`rcb` commits 2.83× per move because the natural React integration
— re-setting the `position` prop after every move — re-renders the
whole board plus each piece. The per-move jump from 0.18 ms to
5.75 ms is where that cost lands.

> Note the per-move number here (**0.18 ms**) is the React Profiler's
> "actual duration" number, not wall-clock including layout/paint.
> The browser bench above (16.5 ms per move under 4× CPU throttle) is
> the number to quote for end-to-end interaction cost.

---

## Engine: `@ultrachess/core` + `ultrachess` (WASM) vs `chess.js`

The layer below the UI. Ultra uses a Rust-compiled WASM engine
exposed through `@ultrachess/core`; `chess.js` is pure JS and is what
both `react-chessboard` and our `chessground` wrapper depend on.

Source: [`apps/benchmarks/scripts/bench-core.mjs`](apps/benchmarks/scripts/bench-core.mjs).
200 000 iterations per scenario, 10 000-iteration warmup, median of
three passes. Both engines run in the same Node process so CPU-frequency
scaling and GC pauses hit both sides equally.

| Scenario                         | `@ultrachess/core` | `chess.js`          | Speed-up   |
|----------------------------------|-------------------:|--------------------:|-----------:|
| `tryMove` + `undo`               |    **278 ns/op**   |     32 909 ns/op    | **118×**   |
| `legalMoves` (mid-game, verbose) |    **158 ns/op**   |    427 348 ns/op    | **2 712×** |
| Position key (hash / FEN)        |   **6.0 ns/op**    |        698 ns/op    | **116×**   |
| `inCheck` + `isGameOver`         |    **112 ns/op**   |     14 093 ns/op    | **126×**   |
| 40-ply game replay + rewind      |   **15.7 µs/op**   |     2.81 ms/op      | **179×**   |

Construction cost (one-time):

- `@ultrachess/core`: **251 ms** cold, dominated by WASM
  compile/instantiate. Subsequent adapters in the same process are
  ~O(1) — the module is cached. This is the same ~250 ms long task you
  see in the Playwright mount table above.
- `chess.js`: **0.5 ms**. Pure JS, no compilation.

**What those numbers mean.** `chess.js` takes ~2.81 ms to replay a
40-ply game; `@ultrachess/core` does the same work in ~15.7 µs. For a
puzzle trainer stepping through thousands of positions, or an
analysis board walking an opening book, that's the difference between
"instant" and "we're thinking". In a live UI the per-move cost is
already below the frame budget on both engines, so on live play the
win shows up in battery life and main-thread head-room rather than
perceptible latency. The real gap is in batch work.

**Why `legalMoves` is ~2 700× faster.** Ultra's generator returns a
packed `u16` per move and produces them bitboard-parallel in WASM.
`chess.js` in `verbose` mode allocates a per-move object with `from`,
`to`, `san`, `captured`, `flags`, `piece`, and `color` fields — that
is allocator pressure piled on top of a slower generator. The React
layer needs verbose moves to decorate legal-target squares correctly,
so non-verbose isn't a fair comparison for a UI integration.

---

## Bundle size (gzip, minified, measured by `size-limit`)

| Package                           | Budget | Measured       |
|-----------------------------------|-------:|---------------:|
| `@ultrachess/core`                |   6 KB |  **3.74 KB**   |
| `@ultrachess/react` (ESM)         |  14 KB | **13.16 KB**   |
| `@ultrachess/react/server` (RSC)  |   4 KB |  **2.32 KB**   |
| `@ultrachess/pieces/{cburnett,merida,alpha,chesscom,neo}` | 2 KB | **~660 B** per set |
| `@ultrachess/themes/{brown,blue,green,wood}` | 1 KB | **~205 B** per theme |

A board-shipping app therefore costs roughly
**`core` + `react` + one piece set + one theme ≈ 17.8 KB gzipped**.

Comparables:

- `react-chessboard` 5.10 publishes at roughly ~40 KB gzipped (see
  `bundlephobia.com/package/react-chessboard`) plus `chess.js`
  (~12.9 KB gzip, measured from our bench bundle).
- `chessground` 9.2 is ~12.3 KB gzipped for the JS chunk in our bench
  build, plus ~4.3 KB of base CSS, plus `chess.js` (~12.9 KB) to be
  playable. Total ~29 KB.

Ultra's 158 KB WASM module is lazy-loaded on first use and served
separately from the JS bundle — it does not count against
first-paint JS cost, but it is the source of the ~250 ms WASM-init
long task on cold mount.

---

## What these benchmarks still do not measure

- **Input Delay (INP) on a real device.** Playwright's synthetic
  pointer events fire identically to a trusted input inside Chromium,
  but real finger-on-glass latency includes display polling cycles we
  can't simulate. A Lighthouse-Mobile CI run is the next upgrade.
- **Memory pressure during a long game.** We assert no leaks in
  `test/drag.test.tsx` / `test/chessboard.test.tsx`, but a multi-hour
  soak in Chromium with heap-delta tracking isn't in CI yet.
- **Deep-analysis workloads.** `ultrachess` also exposes perft,
  make/unmake from stacks, and a Zobrist hash. Nothing in the UI
  exercises these; they're the reason the engine gap widens into
  thousand-×-territory in batch scenarios and deserve their own
  bench harness.

Everything in the tables above regenerates from `bun run turbo
bench` + `bun run bench:playwright`. Results are committed to
[`apps/benchmarks/bench-results/`](apps/benchmarks/bench-results/)
so CI surfaces regressions as JSON diffs.

---

## Methodology notes

- **Fairness to `chess.js` / `react-chessboard`.** Both use their
  documented APIs. `chess.js` is called with `moves({ verbose: true })`
  because that's what a React UI needs to decorate legal-target
  squares. `react-chessboard` is driven by re-setting its `position`
  prop after each move — the idiomatic integration, as shown in its
  README and used by its real consumers.
- **Fairness to `chessground`.** Chessground has no built-in rules,
  so the bench page wraps it with `chess.js` exactly the way Lichess
  does in its own client. Animations are disabled on all three
  boards; `coordinates: false` so the three boards produce identical
  DOM shape for the harness.
- **CPU throttle.** 4× throttling via CDP on the drag- and
  move-storm scenarios. The cold-mount and grid-mount scenarios run
  unthrottled because mount timings on a throttled CPU are dominated
  by network and parsing, not by library cost — and the grid bench
  specifically wants to isolate per-board marginal cost, which gets
  drowned out when every board sees a 4× multiplier.
- **Grid-mount warmup.** The grid scenario does a single pre-warm
  navigation per library before measuring, so Vite's dev-server
  transform cache is already hot when the `N = 1` timing starts.
  Without it the first run would eat ~300–500 ms of server-side
  compile that has nothing to do with the library under test.
- **What we don't compare.** SAN rendering, PGN import/export, and
  draw-offer bookkeeping are things `chess.js` does and `ultrachess`
  delegates to the host. Those aren't hot-path concerns for the
  React layer and they aren't in this benchmark set.
- **Repeatability.** Each Node scenario runs a warmup pass and takes
  the median of three timed passes. `BENCH_ITERS=N` overrides the
  iteration count (default chosen to finish the whole Node bench in
  under 30 s on a modern laptop). Playwright scenarios pin the
  worker count to 1 so simultaneous runs don't contaminate each
  other's frame timings.
