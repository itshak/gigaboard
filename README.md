# ultrachess-react

[![npm version](https://img.shields.io/npm/v/@ultrachess/react?color=%23cb3837&label=npm&logo=npm)](https://www.npmjs.com/package/@ultrachess/react)
[![license](https://img.shields.io/npm/l/@ultrachess/react)](./LICENSE)

Highly opinionated React chessboard for teams that want the board to be an engineered subsystem, not a pile of drag handlers around a FEN string.

- State lives in a `BoardModel`, not in component props. The React surface receives a stable `game` handle and subscribes to exactly the slices it renders.
- The board snapshot is a `Uint8Array(64)`. Each square subscribes to one byte; a normal move touches only the changed squares instead of reconciling the whole board.
- Hot paths are kept out of React. Drag writes through refs, arrows draw on Canvas 2D, and piece glides run through WAAPI.
- Product affordances ship as first-class behavior: premoves, ghost overlays, modifier-key arrow colors, bundled move sounds, optional mobile haptics, a polished green default theme, Neo pieces, and orientation changes.
- Accessibility is part of the API: WAI-ARIA grid, roving tabindex, keyboard parity for pointer actions, `prefers-reduced-motion`, and axe-clean stories.
- Server rendering is a real export. `@ultrachess/react/server` emits static board markup with zero client JS and the same DOM shape the interactive board hydrates over.
- Budgets are explicit: **1 React commit per move**, **0 React work per drag frame**, **< 16 KB gzip** for the interactive surface, and CI gates for size, render count, and frame time.

Benchmarks are included because the architecture should be accountable, not because every interaction is magically faster. Read the measurements in [`BENCH.md`](./BENCH.md); standards and architecture live in [`docs/`](./docs).

---

## Install

```bash
bun  add @ultrachess/react @ultrachess/themes @ultrachess/pieces ultrachess
npm  install @ultrachess/react @ultrachess/themes @ultrachess/pieces ultrachess
pnpm add @ultrachess/react @ultrachess/themes @ultrachess/pieces ultrachess
yarn add @ultrachess/react @ultrachess/themes @ultrachess/pieces ultrachess
```

`ultrachess` is a peer dependency — installed once, shared across every board on the page. `@ultrachess/themes` and `@ultrachess/pieces` stay separate, tree-shakable packages; `@ultrachess/react` uses the green theme and Neo pieces by default so a bare `<Chessboard/>` does not render as an unfinished placeholder. React 18.3+ or 19 is required. The WASM module is lazy-loaded by `ultrachess` on first `Chess.create()`; SSR-only static boards ship zero client JS.

---

## Benchmarks And Budgets

Apple-silicon MacBook, Chromium shipped with Playwright 1.50, Node 25.7.0. Every number below regenerates from a clean checkout — `bun install && bun run turbo bench && bun run bench:playwright -w apps/benchmarks`. Results are committed to [`apps/benchmarks/bench-results/`](./apps/benchmarks/bench-results/) so CI surfaces regressions as JSON diffs.

Short names: **`ultra`** = `@ultrachess/react`, **`rcb`** = [`react-chessboard`](https://github.com/Clariity/react-chessboard) 5.10, **`cg`** = [`chessground`](https://github.com/lichess-org/chessground) 9.2 (wrapped with `chess.js` for rules, as Lichess does).

### Real-browser head-to-head (Playwright + Chromium, production build, 4× CPU throttle)

Every interaction bench below replays the **same 40-ply Sicilian Najdorf** — quiet opening, captures, queenside castle at move 17, sharp middle-game. The *drag storm* drives the game through pointer gestures (full user path); the *move storm* drives it through direct state updates (commit path only); the *continuous drag* is a sustained 960-pointermove rectangle loop without commit, isolating the drag hot path.

Benchmarks run against a **production** Vite build (`vite build && vite preview`) — not the dev server — so React's dev-mode overhead doesn't inflate any library's per-commit cost.

| Metric                                          |   `ultrachess-react` (React) |  `react-chessboard` (React) |  `chessground` (vanilla TS) |
|-------------------------------------------------|-----------------------------:|----------------------------:|----------------------------:|
| **INP — p50** (click to next paint)             |    **13.0 ms**               |  13.7 ms                    | 13.3 ms                     |
| **INP — p75**                                   |    **14.4 ms**               |  15.4 ms                    | 15.3 ms                     |
| **INP — p95**                                   |    **16.6 ms**               |  16.9 ms                    | 18.4 ms                     |
| **INP — worst case** (first-interaction cold)   |    45.7 ms                   | **18.8 ms**                 | 49.1 ms                     |
| Interactions exceeding 200 ms "poor" threshold  |    **0**                     | **0**                       | **0**                       |
| Drag storm (40 drags) — wall clock              | **3.33 s**                   | 3.36 s                      | 3.33 s                      |
| Drag storm — p95 / move                         | **84.2 ms**                  |  91.5 ms                    |  84.4 ms                    |
| Drag storm — max / move                         | **84.7 ms**                  | 103.6 ms                    |  **84.4 ms**                |
| Drag storm — dropped frames                     | **0**                        |   1                         | **0**                       |
| Continuous drag — max frame (960 pointermoves)  | **9.4 ms**                   |  25.0 ms                    | **9.3 ms**                  |
| Continuous drag — dropped frames                | **0**                        |   1                         | **0**                       |
| Move storm (40 plies) — ms per move             | **16.5 ms**                  |  16.5 ms                    | **16.5 ms**                 |
| Move storm — p95                                | **17.7 ms**                  |  17.9 ms                    | **17.7 ms**                 |
| Move storm — DOM mutations / move               |    9.2                       |  **2.6**                    |  3.1                        |
| Move storm — React commits / move               |    **1.00**                  |  2.83                       | *(no React)*                |
| **Heap growth over 500-ply random game**        |  **+1.18 MB**                |  +2.97 MB                   |  +1.90 MB                   |
| Heap peak during 40-ply drag storm              |  **5.93 MB**                 |  20.35 MB                   | **3.50 MB**                 |
| 100-board grid — wall-clock mount               | **899 ms**                   |  992 ms                     | **204 ms**                  |
| 100-board grid — JS heap                        | **45.3 MB**                  | 120.6 MB                    | **5.7 MB**                  |
| 100-board grid — DOM nodes                      | **16 040**                   | 53 332                      | **15 939**                  |

**Single-board interaction (INP + drag/move storm) — all three are inside the good band.** Ultra's INP distribution is tight: p50 13.0 ms, p95 16.6 ms. `rcb` has the best absolute worst case at 18.8 ms vs Ultra's 45.7 ms first-move cold-path outlier. All three libraries stay an order of magnitude below web.dev's 200 ms "poor" threshold; none of these gaps are perceptible on modern hardware. Drag storm wall-clock is a three-way tie at ~3.33 s.

**Where the architecture pays off:**

- **Memory stability under sustained play.** Over a 500-ply random walk, Ultra's heap grows **+1.18 MB** (best), tied with cg at +1.90 MB. `rcb` grows **+2.97 MB** this run — variable across runs (observed 2.97 → 13.79 MB across repeated runs; rcb's heap retention is volatile, Ultra's is flat). During the 40-ply drag storm, rcb's heap peaks at 20.4 MB against Ultra's 5.93 MB — 3.4× Ultra's working set. This is the metric that shows up as "the tab feels sluggish after 30 minutes of analysis."
- **Multi-board scaling.** At 100 boards Ultra uses **2.66× less JS heap** (45 MB vs 121 MB) and **3.32× fewer DOM nodes** (16 040 vs 53 332) than `rcb`. Paint time per extra board: 3.5 ms vs 9.0 ms. For puzzle walls, opening trees, analysis previews, game-list boards — the gap widens per board.
- **Render ownership.** Ultra holds at exactly **1.00 React commits per move** (byte-level `useSyncExternalStore` per square). `rcb` averages 2.83 because a position update fans through more React work. This is the contract the rest of the architecture is built around.

**Honest losses:**

- **Worst-case INP.** `rcb` has a tighter worst-case interaction (18.8 ms vs Ultra's 45.7 ms outlier). Ultra's outlier is a single first-move-commit cold path on the first interaction after mount — first React store-commit from a user event, first piece-slot mount/unmount, first animation-planner diff. Improving it requires pre-committing a synthetic move on mount; the engineering cost to eliminate a 30 ms single outlier that happens once per page load didn't clear our bar. Fixes we *did* ship — pre-materialising CSS `::before`/`::after` pseudo-elements on every square at mount, plus warming the WASM engine's hot paths in the adapter — eliminated the first-SELECT outlier (was 52 ms, now 14 ms) and tightened p50-p95 across the board.
- **DOM mutations per move.** Ultra emits 9.2, `rcb` emits 2.6 — `rcb` reuses piece elements across squares via transform, Ultra mounts/unmounts per affected square as a natural consequence of its per-byte subscription model. The mutation count doesn't affect wall-clock on a single board but is a legitimate architectural difference. Guarded by a CI test with budget ≤10 (`apps/benchmarks/bench/playwright/mutation-audit.spec.ts`).
- **Cold mount.** Chessground is ~8 ms faster to LCP (no framework, no WASM).
- **Grid scaling footprint vs `cg`.** `cg` wins raw resource footprint at 100 boards (5.7 MB vs Ultra's 45.3 MB). The cost `cg` pays is a GPL-3.0 license and bring-your-own-rules engine. Ultra is the React option for teams that want similar rendering discipline without leaving React.

### React layer (Profiler API, 40-ply Najdorf replay)

| Metric                      | `@ultrachess/react` | `react-chessboard` 5.10 | Result          |
|-----------------------------|--------------------:|------------------------:|-----------------|
| **Commits per move**        |           **1.00**  |                  2.83   | **2.83× fewer** |

This is the architectural metric and the one worth quoting: Ultra fires exactly 40 commits for the 40-ply Najdorf; rcb fires 113. Count, not a time measurement — identical result on dev or prod React, run-to-run. A move only ever touches at most four squares, each subscribing to its own byte in the board's `Uint8Array(64)` via `useSyncExternalStore`, and the rest of the board is skipped at React's reconciliation entry.

> An older version of this table cited per-commit `actualDuration`
> numbers from the React Profiler, claiming "31.8× lower React work
> per move." Those numbers were measured under **dev React** inside
> vitest + happy-dom — dev-mode bookkeeping inflates both sides but
> amplifies the gap non-linearly. The absolute ms numbers don't
> match what a shipped app pays, so we dropped them from the headline.
> See [BENCH.md](./BENCH.md#react-layer--ultrachessreact-vs-react-chessboard-510) for the current numbers with the caveat intact. The wall-clock numbers that matter for shipped code are in the head-to-head table above, measured under a real `vite build`.

### Engine (`@ultrachess/core` + `ultrachess` WASM vs `chess.js`)

| Scenario                         | `@ultrachess/core` | `chess.js`          | Ratio      |
|----------------------------------|-------------------:|--------------------:|-----------:|
| `tryMove` + `undo`               |    **278 ns/op**   |     33 104 ns/op    | **119×**   |
| `legalMoves` (mid-game, verbose) |    **156 ns/op**   |    454 276 ns/op    | **2 906×** |
| Position key (hash / FEN)        |   **6.0 ns/op**    |        737 ns/op    | **123×**   |
| 40-ply game replay + rewind      |   **16.2 µs/op**   |      2.85 ms/op     | **177×**   |

The React layer needs verbose moves to decorate legal-target squares; this is where the engine gives the UI headroom for analysis flows, puzzle batches, and opening trees. Construction cost is real: ~250 ms one-time WASM compile/instantiate (the same ~255 ms long task you see on cold mount; it amortises across every subsequent board on the page — see the grid table in BENCH.md).

---

## Entry points

| Import                                | Needs `"use client"` | Gzip       | Use when                                                             |
|---------------------------------------|----------------------|-----------:|----------------------------------------------------------------------|
| `@ultrachess/react`                   | yes                  |  **20.01 KB** | the interactive board — hooks, drag, animation, drawable arrows, premoves, haptics, viewOnly. |
| `@ultrachess/react/server`            | no (RSC)             |   **2.37 KB** | diagrams, PGN viewers, shareable position URLs; zero client JS.   |
| `@ultrachess/core`                    | no                   |   **3.74 KB** | framework-agnostic state + engine adapter; plug into RN, Jazz CRDT. |
| `@ultrachess/pieces/{alpha,cburnett,chesscom,merida,neo}` | yes | **~660 B** / set | one image-backed piece set; `neo` is the React default. |
| `@ultrachess/themes/{blue,brown,green,wood}` | yes       | **~205 B** / theme | one CSS-variable record; `green` is the React default.                       |

A typical board-shipping app costs roughly **`core` + `react` + the default Neo pieces + the default green theme ≈ 22.0 KB gzipped**. Every export is `sideEffects: false`; unused alternate pieces/themes are pruned by any modern bundler. Budgets are enforced per-package by `size-limit` in CI.

---

## Quick tour

One runnable example hitting every core capability. With no `theme`, `pieces`, or `sound` props, the board renders the green theme, Neo pieces, and built-in move sounds. Sound pools are created lazily on the first move cue, including controlled `positionFen` transitions after the initial sync; pass `sound={false}` to keep audio fully disabled, and `haptics` to enable mobile-only tactile move feedback independently from audio.

```tsx
"use client";

import { Chessboard, useChessGame } from "@ultrachess/react";
import { decodePackedMove, moveToUci } from "@ultrachess/core";

export default function Board() {
  // Engine is async — `game` is null for the first render, then fills in.
  const game = useChessGame();            // { fen, orientation, onMove, ... }

  return (
    <Chessboard
      game={game}
      fallbackFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      orientation="white"

      // interaction
      allowDrag
      allowDrawingArrows
      allowPremove={false}            // default — premoves are an online affordance
      onMove={(m) => console.log("played", moveToUci(decodePackedMove(m)))}

      // look & feel
      showLegalTargets="rings"        // "rings" | "dots" | false
      highlightLastMove
      showCheckHighlight
      showIllegalFlash
      showCoordinates
      animation={{ durationMs: 60, easing: "cubic-bezier(.22,.61,.36,1)" }}
    />
  );
}
```

When you want a different look, import one theme and one piece set from their sub-paths:

```tsx
import { cburnett } from "@ultrachess/pieces/cburnett";
import { wood } from "@ultrachess/themes/wood";

<Chessboard game={game} theme={wood} pieces={cburnett} />;
```

Zero-JS static board for a React Server Component (an article, PGN viewer, opening-tree cell):

```tsx
// no "use client" — renders entirely on the server
import { StaticChessboard } from "@ultrachess/react/server";

export default function Diagram() {
  return (
    <StaticChessboard
      fen="r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4"
      orientation="white"
    />
  );
}
```

The static board produces the same DOM shape as the interactive one, so you can hydrate an interactive `<Chessboard/>` over it without a layout shift. Pair that with `fallbackFen` and the user never sees a flash of empty board during WASM init.

### Warming the engine at app boot

By default, `useChessGame()` kicks off WASM init inside a `useEffect` — which means the ~250 ms compile happens *after* React has mounted. The user sees pieces (via `fallbackFen`) but can't move one until init completes. Call `preloadEngine()` as high up the module graph as you can and the init overlaps with HTML parse, JS download, and hydration — so by the time `useChessGame()` runs, the engine is already ready:

```tsx
// Next.js App Router: app/layout.tsx
import { preloadEngine } from "@ultrachess/react";

preloadEngine();   // fire-and-forget — runs at module-import time

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
```

It is idempotent: multiple calls resolve the same Promise. Pair with a preload hint in the HTML `<head>` to overlap the WASM *fetch* with HTML parse too:

```html
<link rel="preload" as="fetch" href="/path/to/ultrachess_bg.wasm" crossorigin>
```

With both in place, the WASM bytes arrive and compile before React even mounts — the 250 ms cold-mount tax disappears into the gaps between other work.

---

## API

Signatures are TypeScript. Everything below is exported from `@ultrachess/react`.

### Components

| Symbol                              | Notes                                                                                      |
|-------------------------------------|--------------------------------------------------------------------------------------------|
| `<Chessboard game theme pieces …/>` | Top-level interactive board. Client component. Full prop list in [`packages/react/src/types.ts`](./packages/react/src/types.ts). |
| `<StaticChessboard fen …/>`         | Server-only; `@ultrachess/react/server`. No client JS, hydration-parity DOM.                |

### Engine lifecycle

| Signature                                                            | Notes                                           |
|----------------------------------------------------------------------|-------------------------------------------------|
| `preloadEngine(): Promise<void>`                                     | Start `ultrachess` WASM init ahead of component mount. Call once at app boot; idempotent. |

### Hooks

| Signature                                                            | Notes                                           |
|----------------------------------------------------------------------|-------------------------------------------------|
| `useChessGame(opts?): BoardModel \| null`                            | Owns a `BoardModel` + `ultrachess` adapter for the component lifetime; `null` until init completes. |
| `useBoardSnapshot(game): BoardSnapshot`                              | Whole-board subscription. Use for small boards or debug overlays. |
| `useBoardSlice(game, selector)`                                      | Subscribe to a derived slice with referential stability. |
| `useSquareCell(game, index): BoardCell`                              | Byte-level subscription — the hook every `Square` uses internally. |
| `useDrag(game, opts)`                                                | Imperative drag controller bound to `pointerdown` — refs-only, zero state writes per frame. |
| `useClickToMove(game)`                                               | Click-to-select / click-to-drop flow, composable with `useDrag`. |
| `useKeyboardNav(game)`                                               | Arrow-key focus movement, Enter to pick/drop, Escape to cancel, `P` for promotion. |
| `useArrowGesture(game, opts)`                                        | Right-click drag → arrow; four modifier-keyed colour channels (default / shift / alt / ctrl). |
| `useMoveSound(game, opts)`                                           | Wires the seven-cue bank lazily and returns a direct cue trigger; usable standalone without `<Chessboard/>`. |
| `useMoveHaptics(game, opts)`                                         | Wires mobile-only tactile feedback for the same move cues and returns a direct cue trigger, independent from sound. |
| `AnimationRunner`                                                    | Low-level WAAPI scheduler used by the board; exposed for custom piece layers. |

### Configuration types

| Type                     | Notes                                                                            |
|--------------------------|----------------------------------------------------------------------------------|
| `ChessboardProps`        | Full prop surface for `<Chessboard/>`.                                           |
| `Theme`                  | `Readonly<Record<string, string>>` — a CSS-custom-property record.               |
| `PieceRenderer`          | `(args: { cell, square }) => ReactNode` — swap any piece for a custom node.      |
| `LegalTargetStyle`       | `"rings" \| "dots" \| false`.                                                    |
| `Orientation`            | `"white" \| "black"`.                                                            |
| `AnimationOptions`       | `{ durationMs?: number; easing?: string }`.                                      |
| `ArrowColors`            | Per-channel overrides: `{ default?, shift?, alt?, ctrl? }`.                      |
| `MoveSoundOptions`       | `{ enabled, volume, preload, sources, perspective }` — the seven cues are `moveSelf`, `moveOpponent`, `capture`, `castle`, `moveCheck`, `promote`, `gameEnd`. |
| `MoveHapticOptions`      | `{ enabled, patterns, intensity, mobileOnly, perspective }` — uses the same seven cues as sound and defaults to mobile/coarse-pointer devices. |

### Core (framework-agnostic, `@ultrachess/core`)

The React layer delegates all state to `@ultrachess/core`. Import it directly when you're building a non-React renderer, React Native, or plugging a collaborative backend (Jazz CRDT, Yjs, Liveblocks).

- `createBoardModel(adapter, opts)` — state machine owning position, history, selection, premove.
- `createBoardStore(model)` — `useSyncExternalStore`-compatible snapshot of the 64-byte board.
- `createUltrachessAdapter(fen?)` — default `EngineAdapter` wrapping `ultrachess`. Swap for `chess.js` or a variant engine without touching the React layer.
- `createLegalMoveIndex(model)` — hash-keyed LRU of legal moves; ≥ 95 % hit rate on typical play.
- `createDragController(model)`, `createArrowModel()`, `createPremoveBuffer(model)`, `planAnimations(prev, next)`.

### Errors

Engine-level errors come from `ultrachess` and propagate unchanged: `IllegalMoveError`, `InvalidFenError`, `DisposedError`, `AbiVersionMismatchError`.

---

## How it works

**Byte-level subscription.** The board is a `Uint8Array(64)`; each cell encodes piece + colour in one byte. The store produces snapshots whose identity is preserved when the subscribed slice hasn't changed, so a move that touches 2–4 bytes produces 2–4 tiny re-renders and nothing else. Hover produces zero. Selection produces one. No memo boilerplate, no `React.memo` on every square — the shape of the data is what makes the equality check free.

**Layered rendering.** Each concern lives on the substrate where it's cheapest. The 8×8 board grid is static DOM (laid out once, `role="grid"`). Squares are DOM with per-byte subscriptions. Pieces live in a single `PieceLayer` and move via `element.animate(...)` — the Web Animations API runs on the compositor, never re-enters React, and is cancelled cleanly under `prefers-reduced-motion`. Arrows paint on a single `<canvas>` via imperative 2D calls. The drag layer is one absolutely-positioned DOM element with a ref; `pointermove` writes `style.transform` directly. Consequence: zero React work per frame during drag, hover, or arrow-draw.

**Legal-move cache, hash-keyed.** `ultrachess.hash()` is an O(1) pointer load (~0.34 ns native). Caching `from → legal-targets` by `(hash, from)` costs nothing to key and pays off immediately — ≥ 95 % hit rate in typical play. Invalidation is implicit: a new position has a new hash. Wrong hash = cache miss = engine call = correct answer.

**Animation pipeline.** On every store commit, `animation-planner.ts` diffs the previous and new `Uint8Array(64)` snapshots and emits an `AnimDescriptor[]` describing what moved, captured, promoted, or appeared. `useAnimation` schedules WAAPI animations on the relevant DOM nodes. React is not involved for the duration of the animation. The completion callback resolves any pending promotion promise / `onMove` callback.

**Server rendering.** `@ultrachess/react/server` is a pure React Server Component. It imports no client modules, emits no handlers, declares no refs. The markup shape is byte-identical to the interactive board, which means you can SSR a static board on the critical render path and swap in the interactive one later without layout shift. `fallbackFen` on the interactive board paints pieces from a FEN on the very first client commit — no wait for a `useEffect`, no flash of empty board during WASM init.

More in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — diagrams, engine-adapter protocol, extension points.

---

## Accessibility

- WAI-ARIA grid pattern: `role="grid"` on the board, `role="gridcell"` on each square, `aria-label` including algebraic coordinate and piece.
- Roving tabindex keyboard navigation: Tab to the board, arrows to move focus, Enter to pick / drop, Escape to cancel, `P` for promotion menu.
- Screen-reader live region announcing the last SAN move (`aria-live="polite"`).
- `prefers-reduced-motion: reduce` collapses WAAPI glides to 0 ms and suppresses the illegal-flash animation.
- Colour contrast ≥ 4.5:1 for coordinates, ≥ 3:1 for board squares against the page background.
- axe-core zero serious / critical violations across every story and example. Enforced in CI.

---

## Correctness

- **Differential fuzz.** Core state is compared byte-for-byte with `ultrachess` at every ply across 10 k random games on PR, 100 k nightly. Any disagreement (FEN, legal-move set, hash, check / mate / stale / draw) is a P0.
- **Property tests (fast-check).** `(snapshot, move)` round-trips, `legal-move-index` cache-hit properties, `PackedMove` encode/decode across all 2¹⁶ inputs.
- **Visual regression.** Playwright + Loki screenshot matrix across 4 themes × 5 piece sets × 2 orientations × 3 viewports × a state set covering start position, common openings, Kiwipete, K+Q vs K, check, mate, stalemate, selection rings, drag in progress, promotion dialog open, 1/5/25 simultaneous arrows, and the keyboard focus ring. Pixel diff threshold: 0.05 %.
- **Hydration parity.** `document.body.innerHTML` pre-hydration === post-hydration for the SSR static board.
- **Perf budgets.** Bundle gzip, render-count per move/hover/drag, frame time under 4× CPU throttle, legal-move cache hit rate — all enforced. Any > 10 % regression blocks merge.

Full matrix in [`docs/TESTING.md`](./docs/TESTING.md).

---

## Bundle size (measured, `size-limit` enforced)

| Package                           | Budget | Measured       |
|-----------------------------------|-------:|---------------:|
| `@ultrachess/core`                |   6 KB |  **3.74 KB**   |
| `@ultrachess/react` (ESM)         |  16 KB | **15.85 KB**   |
| `@ultrachess/react/server` (RSC)  |   4 KB |  **2.37 KB**   |
| `@ultrachess/pieces/*` per set    |   2 KB |  **~660 B**    |
| `@ultrachess/themes/*` per theme  |   1 KB |  **~205 B**    |

A board-shipping app therefore costs roughly **`core` + `react` + the default Neo pieces + the default green theme ≈ 17.8 KB gzipped**. Comparables: `react-chessboard` ~40 KB gzip + `chess.js` ~12.9 KB gzip; `chessground` ~12.3 KB JS + ~4.3 KB CSS + `chess.js`. The 158 KB `.wasm` is lazy-loaded on first use and served separately — it does not count against first-paint JS.

---

## Runtime support

| Runtime                                       | Interactive board | SSR static board |
|-----------------------------------------------|:-----------------:|:----------------:|
| React 18.3 / 19                               |         ✅        |         ✅       |
| Next.js 14 / 15 (app router, RSC)             |         ✅        |         ✅       |
| Vite / Remix / any bundler with ESM           |         ✅        |         ✅       |
| Node 20 / 22 / 24 (SSR hydration verified)    |         —         |         ✅       |
| Chromium / Firefox / Safari (evergreen)       |         ✅        |         ✅       |
| Strict CSP without `wasm-unsafe-eval`         |  ship `.wasm` via an allowed URL | ✅ |

`"sideEffects": false` on every package — unused exports prune cleanly under Rollup, esbuild, webpack ≥ 5, and the Next.js 15 bundler.

---

## Apps & examples

- [`apps/docs`](./apps/docs) — Next.js 15 documentation site.
- [`apps/benchmarks`](./apps/benchmarks) — Node microbenchmarks, React Profiler harness, and the 3-way Playwright browser bench (Ultra / rcb / cg).
- [`examples/next-showcase`](./examples/next-showcase) — comprehensive Next.js example exercising every knob on `<Chessboard/>`: theme + piece-set swap, orientation flip, legal-target style, sound, arrows, premoves, FEN presets, live status + move log.
- [`examples/next-analysis`](./examples/next-analysis) — analysis-style board with arrow drawing.
- [`examples/puzzle-trainer`](./examples/puzzle-trainer) — premove + next-puzzle flow.

---

## Limitations

- **WASM init long task on cold mount.** ~255 ms on first load (the cost of the engine's zero-allocation design). Amortises across boards: after the first, each additional board adds ~5–6 ms of mount cost. Multi-board pages benefit most from that amortisation; at 1 board, `cg` wins mount. `preloadEngine()` reclaims most of the cold-mount gap by overlapping the compile with hydration.
- **Standard chess only.** No Chess960, atomic, antichess, crazyhouse, three-check. The engine is standard-chess. For variants, swap the `EngineAdapter` for one backed by [`chessops`](https://github.com/niklasf/chessops).
- **Sound autoplay.** Browser autoplay policies apply. The first cue after a fresh page load may be silent until the user interacts with the document; every cue after that plays immediately. No workaround — this is a browser invariant.
- **Full-canvas renderer is not shipped.** `@ultrachess/react/canvas` is a scaffolding placeholder; DOM is the only live renderer in this release.
- **No PGN viewer chrome.** The library draws a board; headers, move list, variation tree, annotation UI are the application's job. [`examples/next-analysis`](./examples/next-analysis) shows one pattern.

---

## Coming from `react-chessboard` / `chessground`

**From `react-chessboard`.** Drop-in concept, not drop-in API. Key differences: `position` is replaced by `game` (a `BoardModel` from `useChessGame`); the board owns its engine via `ultrachess` instead of `chess.js`; moves arrive as `PackedMove` (a branded `u16`) instead of a verbose object, decode with `decodePackedMove(m)` when you need `from`/`to`/SAN; drag-and-drop is built in and doesn't depend on `@dnd-kit`.

**From `chessground`.** Ultra is a React library — use `<Chessboard/>` like any other component. `chessground`'s `set({ fen, turnColor, ... })` imperative API becomes declarative props. Arrows, promotion overlay, sound, and premoves are built in rather than user-supplied. The `ultrachess` engine handles rules; you no longer need to wire `chess.js` alongside.

Both integrations produce identical DOM shape for the board itself — a direct swap produces no layout shift. The engine headroom matters anywhere the host app calls the engine off the render path: analysis book-walks, puzzle next-move generation, and cloud-eval batching.

---

## Build & contribute

```bash
bun install
bun run turbo build test size         # what CI runs
bun run turbo bench                   # Node + React Profiler benches
bun run bench:playwright -w apps/benchmarks  # 3-way browser bench
bun -F @ultrachess/docs dev           # docs site → http://localhost:3000
```

Requirements: Bun ≥ 1.3, Node ≥ 20. Bun is the primary runtime; Node is used for Playwright and a handful of tooling scripts.

Read in order before your first PR:

1. [`docs/STANDARDS.md`](./docs/STANDARDS.md) — the quality bar. No exceptions.
2. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — how the layers fit together.
3. [`docs/TESTING.md`](./docs/TESTING.md) — what we test and why.
4. [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md) — budgets, profiling, and the render-count contract.
5. [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) — PR checklist and commit cadence.

Every perf claim in this README links to a committed benchmark in `apps/benchmarks`. Any PR that regresses a budget (bundle size, commits-per-move, frame time, cache hit rate) is blocked in CI.

---

## License

MIT

---

## Credits

- **[`ultrachess`](https://github.com/yahorbarkouski/ultrachess)** — the Rust-compiled WASM chess engine this library is built on. O(1) `hash()`, magic-bitboard slider attacks, single-pass legal-move generation; the reason the engine numbers exist at all.
- **[`chess.js`](https://github.com/jhlywa/chess.js)** (Jeff Hlywa) — the JavaScript lingua franca of chess on the web, our baseline across every benchmark, and the oracle `ultrachess` differentially fuzzes against. Any semantic divergence we have from `chess.js` is by construction a bug on our side.
- **[`react-chessboard`](https://github.com/Clariity/react-chessboard)** (Clariity) — the most-installed React chessboard on npm and the integration shape most consumers already know. Its documented API is what we measure against in [`BENCH.md`](./BENCH.md).
- **[`chessground`](https://github.com/lichess-org/chessground)** (Lichess) — the imperative-rendering bar we target. Its refs-only drag design and canvas arrow overlay are the north star for our hot-path architecture; the numbers we set ourselves to reach in React are theirs without React.
- **WAI-ARIA Authoring Practices — Grid pattern.** The roving-tabindex semantics and the labelling contract for `role="grid"` / `role="gridcell"` are lifted verbatim from the W3C's grid pattern write-up.
- **[Chess Programming Wiki](https://www.chessprogramming.org/)** — thirty years of collective engineering practice that underlies every technical decision in the engine layer and, transitively, everything this package does on top of it.
