# Architecture

> How Gigaboard is structured, and why.

## The one-sentence version

A framework-agnostic state core (`gigaboard/core`) owns a `gigachess` engine handle and exposes a `useSyncExternalStore`-compatible byte-level snapshot; a layered React renderer (`gigaboard`) subscribes per square, animates via WAAPI, and paints arrows on a Canvas overlay — so a single move costs ≤ 4 component re-renders, hover costs 0, and drag costs 0 re-renders per frame.

## Packages

```
gigaboard/core     zero React, zero DOM. State machine + engine adapter.
gigaboard           components, hooks, renderers (DOM default, Canvas opt-in).
gigaboard/pieces   SVG piece sets, tree-shakeable per set.
gigaboard/themes   CSS variables per theme.
```

Each package ships ESM + CJS + `.d.ts` via `tsup`, `sideEffects: false`, sub-path exports for anything optional.

## Data flow

```
                ┌───────────────────────┐
                │   gigachess           │
                └──────────┬────────────┘
                           │ engine-adapter
                ┌──────────▼────────────┐
                │   board-model         │
                │   (position, history, │
                │    selection, premove)│
                └──────────┬────────────┘
                           │ subscribe-store
                           │ (Uint8Array(64) snapshot)
                ┌──────────▼────────────┐
                │   useSyncExternalStore │
                └──────────┬────────────┘
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐      ┌──────▼──────┐     ┌─────▼─────┐
   │ Square  │      │ PieceLayer  │     │ Highlight │
   │ (×64)   │      │ (WAAPI FLIP)│     │  Layer    │
   └─────────┘      └─────────────┘     └───────────┘

   ┌──────────────────────────────────────────────────┐
   │ Canvas overlay: ArrowsLayer                      │
   │ DOM overlay:    DragLayer (refs, no React)       │
   └──────────────────────────────────────────────────┘
```

Key invariants:

- The store's `getSnapshot()` returns the **same reference** when nothing changed at the subscribed slice. Equality checks never allocate.
- Each `Square` selects `board[i]` (a byte). A move touches only 2–4 bytes; untouched squares bail out at React's reconciliation entry.
- Pieces live in one `PieceLayer`; their positions are `transform: translate3d(x,y,0)`. Moves don't re-render pieces — they're animated via WAAPI.
- Arrows and the moving drag-piece are *not React-rendered per frame*. They're imperative overlays.

## Why layered rendering

Pure DOM has great dev ergonomics (a11y, CSS, SSR) but bad hot paths (arrow redraws trigger React reconciliation; drag re-renders per frame). Pure Canvas has great hot paths but loses everything DOM gives you. We keep each layer on the substrate where it's cheapest:

| Concern | Layer | Substrate | Why |
|---|---|---|---|
| Board grid | `BoardGrid` | DOM, static | Rendered once; layout anchor |
| Square state | `Square` ×64 | DOM, subscribed | Per-byte subscription, tiny re-renders |
| Highlights | `HighlightLayer` | DOM, absolute | Separated so selection doesn't re-render pieces |
| Pieces | `PieceLayer` | DOM + WAAPI | Transform + WAAPI = zero React per-frame |
| Arrows | `ArrowsLayer` | Canvas 2D | Imperative, no DOM cost |
| Drag | `DragLayer` | DOM, refs only | One element, `style.transform` writes |

Full-Canvas renderer (post-1.0) is a plug-in alternative, not the default.

## Engine adapter protocol

`gigaboard/core` speaks to the engine through a single interface:

```ts
interface EngineAdapter {
  makeMove(from: SquareIndex, to: SquareIndex, promotion?: PieceType): PackedMove | null;
  undo(): PackedMove | null;
  legalMoves(square?: SquareIndex): ReadonlyArray<PackedMove>;
  fen(): string;
  turn(): Color;
  hash(): bigint;
  isGameOver(): boolean;
  dispose(): void;
}
```

The default adapter is `createGigachessAdapter()` — wraps `gigachess`. Users can plug an alternative (`chess.js`, a variant engine) without touching the React layer.

## Legal-move cache

`legal-move-index.ts` keyed by `engine.hash()`. Size-bounded LRU. On `selectSquare(from)`:

1. Look up `from → Uint8Array<toIndex>` by `(hash, from)`.
2. Miss: call `engine.legalMoves(from)`, decode `moveTo(m)` once, store.
3. Hit rate on typical play: ≥ 95% (measured in benchmarks).

## Animation pipeline

1. On every store commit, `animation-planner.ts` diffs the previous and new `Uint8Array(64)` snapshots.
2. Emits `AnimDescriptor[]` describing what moved, captured, promoted, or appeared.
3. `useAnimation` schedules WAAPI animations on the relevant piece DOM nodes.
4. React is **not involved** for the duration of the animation.
5. Completion callback resolves any pending promotion promise / onMove callback.

## Server rendering

- `gigaboard/server` is a pure server component: takes a FEN, renders static SVG pieces on a CSS grid. No client JS.
- The interactive `<Chessboard/>` is a client component — its `"use client"` is at the component file level, not in a layout, so static boards on the same page stay on the server.

## Extension points

- `renderPiece={{ wK: (ctx) => <CustomKing/> }}` swaps any piece.
- `renderSquare={(ctx) => <Overlay/>}` wraps each square for puzzle / annotation UIs.
- `engine={customAdapter}` replaces the engine entirely.
- `renderer="canvas"` switches to the full-canvas renderer (post-1.0).

## Future targets

- **React Native** (`@gigaboard/react-native`, M8+): shares `gigaboard/core` verbatim; a new renderer package substitutes `react-native-svg` for DOM.
- **Jazz CRDT** (`@gigaboard/jazz`, post-1.0): collaborative adapter maps `board-model` state into a `CoMap` for real-time multiplayer.
