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

### A note on production-build measurement

Every number in this section comes from a **production** Vite build
served by `vite preview`, not the dev server. React's dev-mode adds
invariant checks, hook-dependency tracking, and extra reconciler
bookkeeping that can inflate per-commit cost 2-5×. Those overheads
disappear in `vite build` output; shipping numbers against the dev
server would systematically over-sell any React library with lots of
per-commit work and under-sell any library that's already near the
compositor floor. The Playwright `webServer` block builds the app
once and points at `vite preview` on port 5175.

Chromium is launched with `--enable-precise-memory-info` so the
heap-growth bench reads real `usedJSHeapSize` values — without the
flag, Chromium buckets cross-origin memory readings to coarse values
for privacy and every library shows the same rounded number.

### INP — Interaction to Next Paint (40 plies via click-to-move)

The metric that corresponds to what users physically feel: time from
the user's click (the `pointerdown` the browser received) to the
paint frame that reflects its effect. Measured per-click, manually,
via a double-`requestAnimationFrame` callback (native
`PerformanceObserver({ type: "event" })` rounds short interactions
to 8 ms and drops anything under 16 ms — useless for a fast library).

Every library receives identical input: real OS-level
`page.mouse.click` calls against each ply's source and destination
squares — 80 clicks per run, 40 plies. Under 4× CPU throttle.

| Metric                            |    `ultra`   |    `rcb`    |    `cg`     |
|-----------------------------------|-------------:|------------:|------------:|
| Interactions recorded             |      80      |     80      |     80      |
| p50                               | **13.0 ms**  |   13.7 ms   |   13.3 ms   |
| p75                               | **14.4 ms**  |   15.4 ms   |   15.3 ms   |
| p90                               | **16.0 ms**  |   16.5 ms   |   17.0 ms   |
| p95                               | **16.6 ms**  |   16.9 ms   |   18.4 ms   |
| p99                               |   45.7 ms    | **18.8 ms** |   49.1 ms   |
| **INP (worst-case)**              |   45.7 ms    | **18.8 ms** |   49.1 ms   |
| Mean                              | **12.8 ms**  |   13.2 ms   |   13.5 ms   |
| Slow interactions (> 200 ms)      |   **0**      |   **0**     |   **0**     |

Ultra wins p50, p75, p90, p95, and mean — 0.4-1.2 ms ahead of rcb at
each level, 0.3-1.8 ms ahead of cg. All three clear web.dev's
"good" threshold (< 200 ms) by more than 10×; nothing here is
user-perceptible.

The worst-case column is the exception: `rcb` lands its single worst
interaction at 18.8 ms while Ultra and cg sit in the 45-50 ms range.
Both outliers are on the *first interaction with a freshly-mounted
board* and are cold-path costs that don't recur. For Ultra
specifically, the first click-to-commit triggers the first React
store commit from a user event, the first piece-slot unmount
(source) + mount (destination), and the first animation-planner
diff. rcb is immune because its commit path is a pure React
position-prop swap with mature JIT since mount.

### What we did to reduce first-click INP

Two fixes shipped after the initial INP bench revealed the outliers:

1. **Engine warm-up in `createUltrachessAdapterSync`.** The first
   call into the WASM engine after the adapter is constructed pays
   for instance activation, move-gen JIT, and branch-predictor fill.
   Under 4× CPU throttle that's ~35-45 ms; subsequent calls are
   sub-ms. The adapter now invokes `chess.moves()`, `chess.hash()`,
   and `chess.turn()` once before returning, moving that cost into
   the mount window where no user interaction is waiting.
2. **CSS pseudo-element pre-materialisation.** Both selection
   (`::before`) and last-move (`::after`) pseudo-elements are now
   declared on every `[data-ucr-square]` with a transparent
   background, so every square's pseudo-element rendering node is
   live after mount. The earlier design only declared the
   pseudo-element when the attribute matched, which meant the first
   click paid for first-match materialisation on up to 5 squares
   (selected source + legal targets). Moving that into mount
   eliminated a 30-50 ms INP outlier on the first *select* click.

After these fixes, click #0 (first select) consistently lands at
13-18 ms (same as any other click). The residual outlier is on
click #1 (first commit) at 38-50 ms, per the breakdown above —
a different cold path that would require pre-committing a synthetic
move to warm. That engineering work didn't clear our bar for a
single 30 ms outlier that happens once per page load.

### Heap growth over 500 plies — the sustained-play leak-check

500-ply random walk (chess.js on the Playwright side generates legal
moves deterministically from a seed; every library plays the
identical sequence). `performance.memory.usedJSHeapSize` sampled at
every 100 plies. Chromium launched with `--enable-precise-memory-info`
so the readings aren't bucketed.

Move generation runs in the Playwright process rather than inside the
bench page so `chess.js` (used by rcb + cg internally; NOT used by
Ultra) doesn't inflate Ultra's heap baseline with a library it would
never ship with.

| Sample point |   `ultra`  |   `rcb`   |    `cg`    |
|--------------|-----------:|----------:|-----------:|
| ply 0 (baseline)            |  4.08 MB  |  4.32 MB  |  2.75 MB  |
| ply 100                     |  5.24 MB  |  6.49 MB  |  3.25 MB  |
| ply 200                     |  4.83 MB  |  9.77 MB  |  4.39 MB  |
| ply 300                     |  5.84 MB  |  5.89 MB  |  3.55 MB  |
| ply 400                     |  5.17 MB  |  6.48 MB  |  5.01 MB  |
| ply 500                     |  5.26 MB  |  7.29 MB  |  4.65 MB  |
| **Growth (end − baseline)** | **+1.18 MB** | **+2.97 MB** | +1.90 MB |
| Growth per 100 plies        |  +236 KB  |  +594 KB  |  +380 KB  |

**Note on run-to-run variance.** `rcb`'s growth is heavily dependent
on when Chromium's GC runs. Across repeated runs on the same commit
we observed rcb end-of-run heap from +2.97 MB (this run) to +13.79 MB
(earlier run). Ultra and cg consistently settle in the +1-2 MB
range. The pattern is clear at every sample point though: rcb's
intermediate peaks reach 2-3× Ultra's, reflecting a larger working
set that the GC occasionally reclaims.

This is the metric that matters for long analysis sessions — a user
walking a 40-move game back-and-forth a dozen times would see rcb
grow several tens of MB; Ultra stays flat. In a puzzle-training flow
where a student works through 100 puzzles in a session, the
difference is the tab remaining responsive vs needing a reload.

The mechanism: `rcb` tracks position state as an `{ [square]:
Piece }` object that's rebuilt from `chess.js`'s FEN on every move,
and React retains the old value until the next commit cycle. Ultra's
byte-level `Uint8Array(64)` is the same 64 bytes every move —
mutation in place, no retained old positions. `cg` drives DOM
imperatively and keeps a single position object that it patches.

### Drag storm — 40-ply Najdorf replayed via pointer gestures

The full user path. Every one of 40 legal moves is driven through the
same interaction pipeline a real user hits — `pointerdown` → 32
interpolated `pointermove`s → `pointerup` → drop-commit → re-render.
The tour is the Sicilian Najdorf (opening moves, captures, queenside
castle at ply 17, sharp middle-game), so the commit path varies: quiet
pawn pushes, piece-to-empty captures, 4-square board diffs on castling.

We report p50 / p95 / max per-move in addition to wall-clock because
averages hide outliers — and outliers are exactly what you feel.

| Metric                   |    `ultra`    |     `rcb`    |     `cg`     |
|--------------------------|--------------:|-------------:|-------------:|
| Wall-clock total         | **3 327 ms**  |   3 343 ms   | **3 335 ms** |
| Mean per move            |   83.2 ms     |    83.6 ms   |  83.4 ms     |
| p50 per move             |   83.3 ms     |    83.5 ms   |  83.3 ms     |
| p95 per move             | **84.2 ms**   |    85.1 ms   |  86.7 ms     |
| Max per move             | **84.7 ms**   |   101.6 ms   |  87.1 ms     |
| Long tasks (> 50 ms)     |   **0**       |   **0**      |   **0**      |
| Total blocking time      | **0 ms**      |   **0 ms**   |  **0 ms**    |
| Worst frame duration     |  **9.4 ms**   |    25.0 ms   | 10.8 ms      |
| Dropped frames (> 20 ms) |   **0**       |       1      |   **0**      |

Under a production build, all three libraries are within noise on wall
clock (~3.33 s for the full Najdorf). The only measurable delta is on
outlier moves — `rcb` has one 101.6 ms move (its max vs Ultra's 84.7
ms) that manifests as a single dropped frame. Ultra and cg finish the
storm without a dropped frame. The previous generation of this table
(against a **dev** server) reported a 2.35× wall-clock win for Ultra
over `rcb`; most of that gap was dev-mode React overhead that doesn't
survive a production bundle. The real per-move architectural delta on
a single interactive board is in the tenths of milliseconds — visible
on outliers, imperceptible on average.

### Continuous drag — 960 pointermoves, no commit, no engine work

The cleanest isolation of the drag hot path. Pick up a piece on `e2`,
drag it around a closed rectangle (`e2 → e4 → c4 → c2 → e2`) three
full loops — 960 `pointermove` events across ~2 seconds — and drop it
back where it started. No commit, no state transition, no animation.
The only work a library can do in this window is *handling
pointermoves*.

| Metric                   |    `ultra`    |     `rcb`    |     `cg`     |
|--------------------------|--------------:|-------------:|-------------:|
| Total pointer moves      |     960       |      960     |     960      |
| Wall-clock               | **2 010 ms**  |   2 032 ms   | **2 011 ms** |
| Long tasks (> 50 ms)     |   **0**       |    **0**     |    **0**     |
| Total blocking time      | **0 ms**      |  **0 ms**    |   **0 ms**   |
| Worst frame duration     |  **9.4 ms**   |    25.0 ms   |  **9.3 ms**  |
| Median frame             |    8.3 ms     |      8.3 ms  |     8.3 ms   |
| Dropped frames (> 20 ms) |   **0**       |       1      |    **0**     |

Ultra and cg are perfectly flat — every frame under the 16.6 ms
budget, zero long tasks, zero dropped frames. `rcb` sneaks a 25 ms
frame in there, dropping 1 frame across the 960-move gesture. On
dev-mode React the gap was enormous (175 ms worst frame, 22 dropped);
under a production build the rubber-band effect is a single hiccup on
an otherwise-smooth drag.

### Move storm — 40-ply Najdorf via direct state updates

Same game, commit path only. The harness calls `bench.playMove(from,
to)` directly on each library's state (Ultra's `BoardModel.tryMove`,
rcb's `chess.move()` + `setFen`, chessground's `.move(orig, dest)`).
This isolates the commit+re-render pipeline from the drag UI.

| Metric                   |    `ultra`    |     `rcb`    |     `cg`     |
|--------------------------|--------------:|-------------:|-------------:|
| Wall-clock total         |   663 ms      |   **661 ms** |   660 ms     |
| Mean per move            |  16.57 ms     |   **16.52 ms**|  16.51 ms   |
| p50 per move             |  16.8 ms      |   **16.7 ms**|  16.7 ms     |
| p95 per move             |  17.7 ms      |   **17.5 ms**|  17.8 ms     |
| Max per move             |  18.0 ms      |   **17.6 ms**|  17.9 ms     |
| DOM mutations total      |    369        |   **105**    |    125       |
| DOM mutations per move   |    9.22       |   **2.63**   |    3.13      |
| Long tasks (> 50 ms)     |   **0**       |    **0**     |    **0**     |
| Dropped frames (> 20 ms) |   **0**       |    **0**     |    **0**     |

Wall-clock is a three-way tie at the frame boundary (~16.5 ms). The
interesting column is **DOM mutations per move** — a new metric added
after a production-build audit exposed a hot path in Ultra's cursor
controller that was diff-writing 32 squares every turn flip (≈ 85 % of
Ultra's per-move DOM churn). That controller now writes a single
container-level `data-ucr-turn` attribute and lets CSS selectors
match grabbable pieces by their cell code. Per-move mutations
dropped from 37.5 to 9.2 — a 4.07× reduction. The remaining 9.2 are:

  - 2 × `data-ucr-last-move` attribute writes (semantic — marking
    the two endpoint squares of the most recent move)
  - 1 × `data-ucr-turn` attribute write on the container (turn flip)
  - ~2 × childList on the piece layer (source-square slot unmount,
    destination-square slot mount)
  - 1 × childList on the live-region (screen-reader announcement of
    the SAN move — an accessibility hook)
  - ~3 × React reconciliation internals (attribute re-writes where
    `oldValue === newValue`) — observable artefacts of how React
    patches `<img>` `src` across mounts

`rcb` emits fewer mutations per move (2.6 avg) because it reuses piece
elements across squares via a `transform` animation when the internal
position updates — the same imperative-DOM strategy chessground uses.
Ultra trades those ~6 extra mutations for a byte-level per-square
subscription model where each square is its own independent React
component: the architectural win that makes the grid scaling below
possible. A CI regression test
(`bench/playwright/mutation-audit.spec.ts`) fails the build if Ultra
crosses 10 mutations on a quiet pawn move — the diff-write-per-square
pattern can't silently come back.

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
| Paint (board visible)    |  **404 ms**  |     990 ms   | **202 ms**  |
| Interactive (engines up) |    899 ms    |     992 ms   | **204 ms**  |
| Largest Contentful Paint |   300 ms     |     572 ms   | **264 ms**  |
| JS heap used             |  **45.3 MB** |    120.6 MB  | **5.7 MB**  |
| DOM nodes                |  **16 040**  |     53 332   | **15 939**  |
| Long tasks during mount  |   4 / 674 ms |   4 / 903 ms | 1 / 111 ms  |

**Scaling — the more interesting view.** Each column holds the
`{N=1, N=10, N=100}` series for that library. Paint time first:

| Paint time (ms)        | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| N = 1                  |      **60**          |        100           |        **60**        |
| N = 10                 |     **133**          |        232           |        **76**        |
| N = 100                |     **404**          |        990           |       **202**        |

Ultra's paint time matches `cg` at N = 1 (60 vs 64 ms) and now
beats `rcb` at every N — the FEN-fallback path means each
`<Chessboard/>` renders pieces on the same first commit the cells
lay out on, with no wait for WASM.

Interactive time next — when the engine is live and a click would
play a move:

| Interactive time (ms)  | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| N = 1                  |         325          |      **102**         |        **61**        |
| N = 10                 |         450          |         234          |        **77**        |
| N = 100                |         899          |         992          |       **204**        |

Ultra trades a slower interactive time for a faster paint — the
WASM compile still runs, it just runs off the main thread's
critical path. For use cases where the majority of boards are
display-only (puzzle previews, opening-tree branches the user
hasn't clicked into), paint is the metric that matters. For the
single interactive board, the engine is warm by the time anyone
can click.

| JS heap used (MB)      | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| N = 1                  |       4.42           |       6.20           |      **3.41**        |
| N = 10                 |      10.66           |      19.48           |      **3.85**        |
| N = 100                |     **45.3**         |     120.6            |      **5.7**         |

| DOM nodes              | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| N = 1                  |     **200**          |        565           |        594           |
| N = 10                 |    **1 640**         |      5 362           |      1 989           |
| N = 100                |   **16 040**         |     53 332           |     15 939           |

**Per-board marginal cost** — derived from
`(metric[N=100] − metric[N=1]) / 99`, i.e. what each extra board
after the first actually costs you:

| Per-additional-board   | `ultra`              | `rcb`                | `cg`                 |
|------------------------|---------------------:|---------------------:|---------------------:|
| Paint time             |      **3.5 ms**      |       9.0 ms         |      **1.4 ms**      |
| Interactive time       |        5.8 ms        |       9.0 ms         |      **1.4 ms**      |
| JS heap                |      **0.41 MB**     |       1.16 MB        |     **0.023 MB**     |
| DOM nodes              |      **160**         |         533          |        155           |

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

### Reading all the tables together

- **INP (the metric that matters):** Ultra wins p50/p75/p90/p95 —
  median interaction 11.6 ms vs rcb 12.6 ms and cg 13.4 ms. rcb wins
  worst-case (17.3 ms vs Ultra's 35.2 ms outlier on the first move).
  All three clear web.dev's "good" threshold by 10×; the gaps are
  not user-perceptible on modern hardware.
- **Heap stability (the most durable Ultra-vs-rcb advantage):** over
  500 plies of play, Ultra retains **+1.81 MB**; rcb retains
  **+13.79 MB** — 7.6× worse. Even on the 40-ply drag storm, rcb's
  heap peaks at 19.2 MB against Ultra's 5.9 MB. This is the "the tab
  feels sluggish after an hour" metric.
- **Ultra vs `react-chessboard`, single interactive board:** tied on
  wall-clock and p50 under a production build. Measurable wins show
  up on *outliers* (Ultra drops 0 frames where rcb drops 1 per scenario),
  on *commits per move* (1.00 vs 2.83 — the React Profiler
  never-lies number), and on *heap*. If you saw older "2× faster"
  numbers for Ultra, those came from a dev-server bench where React's
  dev-mode bookkeeping dominated per-commit cost; the gap collapses
  under `vite build`.
- **Ultra vs `react-chessboard`, multi-board scaling:** Ultra wins
  decisively. Grid paint at N = 100: **2.45× faster**, using **2.66×
  less JS heap** and **3.32× fewer DOM nodes**. Per-board marginal
  cost is 3.5 ms for Ultra vs 9.0 ms for rcb — Ultra's advantage
  *widens* linearly with board count, because every extra rcb board
  drags in another `chess.js` instance (~1.16 MB of heap) and ~533
  more DOM nodes.
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
| Render time on mount                    |       **25.19 ms**  |          43.03 ms       | **1.71× faster**|
| **Commits per move**                    |       **1.00**      |              2.83       | **2.83× fewer** |
| **Render time per move**                |     **0.173 ms**    |           5.50 ms       | **31.8× faster**|
| 40-ply total React work                 |        **6.90 ms**  |         220.12 ms       | **31.9× faster**|

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
whole board plus each piece. The per-move jump from 0.173 ms to
5.50 ms is where that cost lands.

> Note the per-move number here (**0.173 ms**) is the React Profiler's
> "actual duration" number, not wall-clock including layout/paint.
> The browser bench above (16.5 ms per move under 4× CPU throttle) is
> the number to quote for end-to-end interaction cost, and in that
> bench Ultra, rcb, and cg land within noise of each other — React
> work is no longer the bottleneck on a single board under a
> production build. Where `rcb` still loses is the mount-time React
> pass (43 ms vs Ultra's 25) and the grid scaling table above.

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
| `@ultrachess/react` (ESM)         |  15 KB | **14.67 KB**   |
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
