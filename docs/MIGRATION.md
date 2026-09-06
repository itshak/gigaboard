# Migrating from `react-chessboard` to `gigaboard`

This is the full migration guide for teams currently shipping [`react-chessboard`](https://github.com/Clariity/react-chessboard) who are evaluating `gigaboard`. It assumes you have a working `react-chessboard` integration and want the shortest path to a more opinionated board: owned state, a built-in engine adapter, strict render boundaries, accessibility, SSR, and measured budgets.

If you're starting greenfield, you don't need this document — read [`README.md`](../README.md) and copy the quick-tour snippet.

---

## 1. What you gain, what you give up

**Gain:**

- **A different ownership model.** The board owns a `BoardModel`; your app drives it through a stable handle instead of rebuilding a position prop on every move.
- **Tighter React boundaries.** Measured in [`BENCH.md`](../BENCH.md): 1.00 React commits per move for the 40-ply Najdorf, versus 2.83 for `react-chessboard`.
- **Better sustained-session and multi-board behavior.** The Playwright bench shows lower heap growth during long play and materially lower heap/DOM cost at 100 boards.
- **~55 % smaller bundle** for the typical "one piece set + one theme" app: `core` + `react` + pieces + theme ≈ **22.3 KB gzip** vs `react-chessboard` ~40 KB + `chess.js` ~12.9 KB.
- **Built-in engine via `gigachess`.** No more wiring `chess.js` alongside the board for legal move decoration or analysis UI helpers. Zero WASM compile latency!
- Built-in drawable arrows with modifier-key channels, premoves, sound, keyboard navigation, WAI-ARIA grid, SSR static board.

**Give up / trade-offs:**

- **Standard chess only.** No Chess960, variants. `react-chessboard` doesn't handle rules either, but the `chessops`/`chess.js` stacks you might have paired with it do. Variants require a custom `EngineAdapter`.
- **Different mental model.** `react-chessboard` is a view over a `position` string you own. `gigaboard` owns its own state (`BoardModel`) and gives you a handle. See §2.
- **`PackedMove` instead of verbose move objects.** A branded `u16` with a decoder, not `{ from: "e2", to: "e4", san: "e4", ... }`. See §5.
- **No built-in PGN viewer chrome.** Move list, headers, variation tree — still your job.

If those give-ups are dealbreakers, stop here. Otherwise:

---

## 2. The mental-model shift

`react-chessboard` is **stateless**:

```tsx
const [game, setGame] = useState(new Chess());  // YOU own chess.js
<Chessboard
  position={game.fen()}                          // YOU push FEN in
  onPieceDrop={(from, to) => {                   // YOU validate & commit
    const move = game.move({ from, to });
    setGame(new Chess(game.fen()));
    return move !== null;
  }}
/>
```

`gigaboard` is **stateful**:

```tsx
const game = useChessGame();                     // owns its engine + state
<Chessboard game={game} onMove={(m) => {/* ack */}}  />
```

The board ships with its engine baked in. Moves are validated internally; you get an `onMove` callback *after* commit. You don't push a FEN on every render — you call `game.load(fen)` / `game.tryMove(...)` / `game.undo()` when app state changes. React subscribes to the model at byte granularity and re-renders only the squares that actually changed.

If this sounds like `chessground` — it is, but wrapped in idiomatic React with hooks. The imperative escape hatch (`game.tryMove`, `game.setArrows`, etc.) is there when you need to drive the board from outside.

> **TL;DR.** Stop thinking of the board as a function of `position`. Think of it as a `<Chessboard game={...}/>` that you command through the `game` handle.

---

## 3. Install and replace

```bash
bun remove react-chessboard chess.js
bun add gigaboard @gigaboard/pieces @gigaboard/themes
```

`gigaboard` defaults to the green theme, Neo pieces, and bundled move sounds; `@gigaboard/pieces` and `@gigaboard/themes` remain separate tree-shakable packages for customisation. `react` 18.3+ or 19 is required. `chess.js` can stay if your app logic depends on it (PGN parsing, SAN generation outside the board) — it no longer needs to drive the board.

---

## 4. Minimal port

### Before — `react-chessboard` v4/v5

```tsx
"use client";
import { useState, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";

export function Board() {
  const [game, setGame] = useState(() => new Chess());
  const fen = useMemo(() => game.fen(), [game]);

  function onPieceDrop(from: string, to: string) {
    const copy = new Chess(game.fen());
    const move = copy.move({ from, to, promotion: "q" });
    if (!move) return false;
    setGame(copy);
    return true;
  }

  return (
    <Chessboard
      position={fen}
      onPieceDrop={onPieceDrop}
      boardOrientation="white"
      customDarkSquareStyle={{ backgroundColor: "#779952" }}
      customLightSquareStyle={{ backgroundColor: "#edeed1" }}
      animationDuration={60}
    />
  );
}
```

### After — `gigaboard`

```tsx
"use client";
import { Chessboard, useChessGame } from "gigaboard";

export function Board() {
  const game = useChessGame();                         // BoardModel | null

  return (
    <Chessboard
      game={game}
      fallbackFen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
      orientation="white"
      animation={{ durationMs: 60 }}
      onMove={(m) => { /* already committed — this is an ack */ }}
    />
  );
}
```

Things gone: `useState`, the `Chess` clone-on-every-move dance, the manual FEN plumbing, the `onPieceDrop → boolean` contract, and the need to wire a presentable board by hand. Things new: `game` handle and `fallbackFen` to paint pieces immediately.

---

## 5. Move objects — `PackedMove`, not `{ from, to, san }`

`react-chessboard` gives you string coordinates in callbacks (`from: "e2"`, `to: "e4"`). `gigaboard` emits a `PackedMove` — a branded `u16` that encodes `from | to | promotion | kind`. Decode only when you need to:

```ts
import { decodePackedMove, moveToUci } from "@gigaboard/core";

onMove={(m) => {
  const { from, to, promotion, kind } = decodePackedMove(m);
  // from / to are `SquareIndex` (0..63, LERF: 0 = a1, 63 = h8)
  console.log(moveToUci(decodePackedMove(m)));        // "e2e4"
}}
```

Why: the hot path stays a single 16-bit integer, and any networking / persistence layer gets a compact wire format for free. For analysis UIs that want SAN, walk history through `game.engine` (see §13) or keep `chess.js` around for SAN-of-move generation.

SquareIndex ↔ algebraic:

```ts
const file = sq & 7;         // 0..7 = a..h
const rank = sq >> 3;        // 0..7 = 1..8
const algebraic = `${"abcdefgh"[file]}${rank + 1}`;
```

---

## 6. Prop-by-prop mapping

| `react-chessboard`                              | `gigaboard`                                                                                                  |
|-------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `position` (FEN string)                         | Replaced by `game` + `fallbackFen`. For imperative resets call `game.load(fen)` / `game.reset()`.            |
| `onPieceDrop(from, to, piece) => boolean`       | `onMove(m: PackedMove)` — fires *after* a successful move. Drop-gating: use `canDragPiece`.                  |
| `onPieceClick(piece, square)`                   | `useClickToMove(game)` hook (already wired inside `<Chessboard/>`); or listen via `onSquareMouseEnter/Leave`. |
| `onSquareClick(square, piece)`                  | Built-in click-to-move. Per-square overrides via `renderSquare`.                                             |
| `onSquareRightClick`                            | Built-in as arrow drawing (`allowDrawingArrows`, `arrowColors`). Disable with `allowDrawingArrows={false}`.  |
| `boardOrientation`                              | `orientation` (`"white" \| "black"`).                                                                        |
| `arePiecesDraggable`                            | `allowDrag`.                                                                                                 |
| `isDraggablePiece({ piece, sourceSquare })`     | `canDragPiece({ square, cell })`. `cell` is a `BoardCell` byte — use `pieceTypeOf(cell)` / `colorOf(cell)`.  |
| `boardWidth`                                    | Removed. The board fills its container; set CSS `width` / `height` on the wrapper. See §10.                  |
| `customBoardStyle`                              | `style` + `className` on `<Chessboard/>`.                                                                    |
| `customDarkSquareStyle` / `customLightSquareStyle` | Use a `Theme` (`@gigaboard/themes/*`) or author your own `Record<string, string>` of CSS vars — see §11.   |
| `customSquareStyles`                            | `renderSquare(ctx) => ReactNode` — absolute-positioned overlay per square.                                    |
| `customPieces`                                  | `pieces: PieceRenderer` — a `(args: { cell, square }) => ReactNode`. See §12.                                 |
| `customArrows`                                  | `game.setManagedArrows([...])` (engine-owned) or `game.addArrow(...)` (ad-hoc). See §14.                      |
| `customArrowColor`                              | `arrowColors={{ default, shift, alt, ctrl, myBrush: "#f80" }}`.                                              |
| `showBoardNotation`                             | `showCoordinates` (default `true`). Rank edge controlled by `ranksPosition: "left" \| "right"`.              |
| `animationDuration`                             | `animation={{ durationMs: 60, easing: "cubic-bezier(.22,.61,.36,1)" }}`.                                      |
| `onPromotionCheck(from, to, piece)`             | Automatic. The engine knows when a move is a promotion.                                                       |
| `onPromotionPieceSelect(piece, from, to)`       | `onPromote(ctx): PieceType \| Promise<PieceType>`. Omit for the built-in overlay.                             |
| `promotionDialogVariant`                        | Built-in overlay is the only one shipped. Full customisation via your own `onPromote` that returns a Promise. |
| `showPromotionDialog` (controlled)              | Not controlled — resolution happens inside `onPromote`. If you need a custom UI, own the promise yourself.    |
| `areArrowsAllowed`                              | `allowDrawingArrows` (default `true`).                                                                       |
| `id`                                            | Not needed — the board doesn't namespace globals. Pass `className` / `ariaLabel` for your own hooks.          |

Anything not in this table is either (a) a feature `gigaboard` doesn't have, documented in §17, or (b) a default behaviour with no knob because it didn't need one (e.g. the legal-target highlights are always present and styled via `showLegalTargets: "rings" | "dots" | false`).

---

## 7. The board handle — imperative actions you used to do on `chess.js`

`BoardModel` (what `useChessGame` returns) exposes every action you used to perform on your `chess.js` instance. Do **not** re-implement these — the engine's already loaded inside the board.

| `chess.js`               | `game: BoardModel`                           | Returns                          |
|--------------------------|----------------------------------------------|----------------------------------|
| `game.move({ from, to })` | `game.tryMove(from, to, promotion?)`         | `PackedMove \| null`             |
| `game.undo()`            | `game.undo()`                                | `PackedMove \| null`             |
| `(manual)` redo          | `game.redo()`                                | `PackedMove \| null`             |
| `game.load(fen)`         | `game.load(fen)`                             | `void`                           |
| `game.reset()`           | `game.reset()`                               | `void`                           |
| `game.fen()`             | `game.engine.fen()` or `game.getSnapshot().board` + `turn` | `string` / snapshot    |
| `game.moves({ verbose, square })` | `game.legalFrom(square)`            | `ReadonlySet<SquareIndex>`        |
| `game.in_check()`        | `game.getSnapshot().inCheck`                 | `boolean`                        |
| `game.game_over()`       | `game.getSnapshot().isGameOver`              | `boolean`                        |
| `game.turn()`            | `game.getSnapshot().turn`                    | `Color` (0 = White, 1 = Black)   |
| `game.history({ verbose })` | History is reconstructable via `engine` — see `adapters/gigachess.ts`. | — |
| `game.fen()` hash        | `game.getSnapshot().hash`                    | `bigint` — O(1) Zobrist key      |

All of these commit a single snapshot (≤ 1 React commit). `game.load(fen)` is what replaces the `position` prop when app state needs to jump to an arbitrary FEN — e.g. scrubbing through a PGN, loading a puzzle, undoing beyond the engine's own history:

```tsx
// "load next puzzle" — same as <Chessboard position={newFen}/> used to do
useEffect(() => { game?.load(puzzle.fen); }, [puzzle.id, game]);
```

---

## 8. Reading board state outside `onMove`

Three hooks, in decreasing granularity:

```ts
// Whole snapshot — re-renders on every commit. Use for debug panels, small boards.
const snap = useBoardSnapshot(game);

// Derived slice with referential stability. Use for "is in check?" badges, captured-piece
// counts, anything where a whole-snapshot subscription would over-render.
const inCheck = useBoardSlice(game, (s) => s.inCheck);

// Byte-level subscription — what every <Square/> uses internally. You'll rarely call
// this yourself unless you're building a custom renderer.
const cell = useSquareCell(game, toSquareIndex(27));
```

Prefer `useBoardSlice` in app code. It's cheap and it keeps the "≤ 1 commit per move" budget intact.

---

## 9. Drag-and-drop — and the `@dnd-kit` footnote

`react-chessboard` v4 depended on `react-dnd`; v5 moved to `@dnd-kit`. In both cases you could sometimes hit conflicts with other drag-and-drop surfaces on the same page.

`gigaboard` has **zero** drag-library dependency. The drag layer is raw `pointerdown` / `pointermove` / `pointerup` written to `style.transform` on a single absolutely-positioned DOM node. No React state writes per frame. It cannot conflict with `@dnd-kit`, `react-dnd`, `dnd-kit`, or any app-level drag surface because it doesn't play in the same event bus.

If you had custom drag-gating (`isDraggablePiece`), port it to `canDragPiece`:

```tsx
<Chessboard
  game={game}
  canDragPiece={({ square, cell }) => {
    // tutorial: "only white, only pawns"
    return colorOf(cell) === Color.White && pieceTypeOf(cell) === PieceType.Pawn;
  }}
/>
```

The predicate fires at drag-start, not per pointer sample.

---

## 10. Sizing

`react-chessboard` had a `boardWidth` prop. We don't. The board fills its container as a square via aspect-ratio CSS — size it from the outside:

```tsx
<div style={{ width: 480, maxWidth: "100%" }}>
  <Chessboard game={game} />
</div>
```

Responsive grids "just work": put `<Chessboard/>` in a CSS grid cell and it adapts. If you want fixed pixel dimensions, set them on the wrapper.

---

## 11. Themes and square styling

Two paths, depending on how much you're customising.

**Pre-built themes.** Import a palette and pass it:

```tsx
import { green } from "@gigaboard/themes/green";
import { brown } from "@gigaboard/themes/brown";
// …blue, wood
<Chessboard game={game} theme={green} />
```

**Custom palette.** `Theme` is `Readonly<Record<string, string>>` — CSS custom properties written onto the outer board element. The contract is documented in [`packages/react/src/default-theme.ts`](../packages/react/src/default-theme.ts) (`CSS_VARS`). Minimal custom theme:

```ts
const myTheme = {
  "--gb-sq-light": "#edeed1",
  "--gb-sq-dark":  "#779952",
  "--gb-last-move": "rgba(155, 199, 0, 0.41)",
  "--gb-selected": "rgba(20, 85, 30, 0.5)",
} satisfies Theme;
```

**Per-square overlays.** `customSquareStyles` → `renderSquare`:

```tsx
<Chessboard
  game={game}
  renderSquare={({ index, isLight, label }) =>
    hint.has(index) ? (
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,0,0,.15)" }} />
    ) : null
  }
/>
```

The callback returns React nodes that render absolute-positioned inside each square. Use this for move-suggestion highlights, piece-heat-maps, puzzle target squares.

---

## 12. Custom pieces

`react-chessboard`'s `customPieces` took a `{ wP: Component, wN: Component, ... }` record. Ours takes a single `PieceRenderer`:

```tsx
import type { PieceRenderer } from "gigaboard";
import { pieceTypeOf, colorOf, Color, PieceType } from "@gigaboard/core";

const myPieces: PieceRenderer = ({ cell, square }) => {
  const color = colorOf(cell);
  const type  = pieceTypeOf(cell);
  // return an SVG that fills its 12.5% × 12.5% slot
  return <svg viewBox="0 0 45 45" width="100%" height="100%">{/* … */}</svg>;
};

<Chessboard game={game} pieces={myPieces} />
```

Or import a full pre-built set from `@gigaboard/pieces/{alpha,cburnett,chesscom,merida,neo}`. Each is a tree-shakable sub-path at ~660 B gzip.

**Stability matters.** Return referentially-stable React nodes — ideally stateless SVG. A renderer that allocates new closures per call forces per-commit re-rendering and you'll lose the commit-count win.

---

## 13. Keeping `chess.js` around for app logic

You don't need `chess.js` to *drive* the board, but you might keep it for:

- **SAN-of-move generation** outside the render path (move lists, PGN export).
- **PGN parsing** (`chess.js` is still the most convenient).
- **Game-over classification** if you want `Checkmate / Stalemate / Insufficient material / 50-move / Threefold` strings.

Treat it as a sidecar keyed off `onMove`:

```tsx
const chess = useMemo(() => new Chess(), []);
<Chessboard
  game={game}
  onMove={(m) => {
    const { from, to, promotion } = decodePackedMove(m);
    chess.move({ from: sqToAlg(from), to: sqToAlg(to), promotion: promoLetter(promotion) });
    setMoveList((list) => [...list, chess.history().at(-1)!]);
  }}
/>
```

Because `chess.js` plays no part in the hot drag / render path, its 33 µs `tryMove` doesn't show up in frame budgets. Keep it off the render path and you get both things: the Ultra engine for the board, `chess.js` for PGN chrome.

---

## 14. Arrows — user-drawn and programmatic

`react-chessboard`'s `customArrows` is a controlled list. We have two channels.

**User-drawn** (right-click drag). Built in, modifier-keyed colours:

```tsx
<Chessboard
  game={game}
  allowDrawingArrows
  arrowColors={{
    default: "#15781B",
    shift:   "#003088",
    alt:     "#882020",
    ctrl:    "#cc8800",
  }}
/>
```

**Programmatic** (engine hints, coach annotations). Managed arrows survive user click-to-dismiss:

```ts
import { makeArrow } from "@gigaboard/core";

useEffect(() => {
  if (!game || !bestMove) return;
  game.setManagedArrows([
    makeArrow({ from: bestMove.from, to: bestMove.to, color: "#15781B", managed: true }),
  ]);
}, [bestMove, game]);
```

`setManagedArrows` replaces the engine-owned set without touching whatever the user drew. `addArrow` / `removeArrow` / `clearUserArrows` / `clearManagedArrows` / `clearArrows` cover everything else.

---

## 15. SSR and Next.js

`react-chessboard` is a client component; it either breaks SSR or dynamically imports. We ship both:

```tsx
// Static (RSC — zero client JS). Drop into MDX, docs, PGN viewers, diagrams.
import { StaticChessboard } from "gigaboard/server";
<StaticChessboard fen="r1bqkb1r/..." orientation="white" />

// Interactive (client). "use client" required in the parent.
"use client";
import { Chessboard, useChessGame } from "gigaboard";
```

Both emit the **same DOM shape**, so you can SSR the static board on the critical render path and hydrate the interactive one over it — zero layout shift, zero flash-of-empty-board.

**Warm the engine at app boot:**

```tsx
// app/layout.tsx
import { preloadEngine } from "gigaboard";
preloadEngine();                                     // fire-and-forget
export default function RootLayout({ children }) { return <html><body>{children}</body></html>; }
```

---

## 16. Common pitfalls during migration

1. **Still passing a `position` string every render.** There's no such prop. `useChessGame` owns position; call `game.load(fen)` when app state needs to jump. Doing it in a `useMemo`-style "compute FEN from app state, feed to board" pattern fights the library — you'll commit and thrash.
2. **`onMove` returns a boolean in your head.** It doesn't. The move is already committed. To *gate* a move, use `canDragPiece` (for drag) or the engine's legal-move check at click time. To *react* to a move, use `onMove`.
3. **Rebuilding the model on every render.** Don't call `createBoardModel` in render — use `useChessGame`. If you spread `options` into the hook, make sure the fields that trigger re-init (`fen`) are stable.
4. **Expecting `{ san, from, to }` in the callback.** `onMove` delivers a `PackedMove`. Decode with `decodePackedMove(m)`. For SAN, keep `chess.js` as a sidecar (§13).
5. **Setting `animationDuration: 0` and still seeing glides.** We honour `prefers-reduced-motion: reduce` globally; but if your OS pref doesn't match your test, pass `animation={{ durationMs: 0 }}` explicitly.
6. **Style resets clobbering CSS vars.** Themes work by writing `--gb-*` custom properties on the board's outer element. A global `* { all: unset }` or a CSS-in-JS `:root` reset that shadows those vars will break the theme. Scope any resets so they don't leak into the board subtree.

---

## 17. Feature parity — what we have, what we don't

### We have (that `react-chessboard` has or ~has)

- ✅ Drag-and-drop (built in, no `@dnd-kit`)
- ✅ Click-to-move (built in, composable with drag)
- ✅ Custom pieces (`PieceRenderer`)
- ✅ Custom square overlays (`renderSquare`)
- ✅ Board orientation flip (`orientation`)
- ✅ Coordinates on/off (`showCoordinates`, `ranksPosition`)
- ✅ Animation duration / easing (`animation`)
- ✅ Arrows — user-drawn **and** programmatic (`allowDrawingArrows`, `setManagedArrows`)
- ✅ Promotion overlay — built-in, or override with `onPromote`
- ✅ Board-orientation-specific drag gating (`canDragPiece`)
- ✅ Check highlight (`showCheckHighlight`)
- ✅ Last-move highlight (`highlightLastMove`)

### We have (that `react-chessboard` does not)

- ✅ **Built-in rules engine.** No separate `chess.js` dependency for move validation.
- ✅ **Premoves with ghost-piece overlay** (`allowPremove`).
- ✅ **Keyboard navigation** (arrows/Enter/Escape/P) — opt-out, not opt-in.
- ✅ **WAI-ARIA grid + screen-reader live region.**
- ✅ **Sound bank** (seven chess.com-parity cues, MP3s bundled, no CDN).
- ✅ **`StaticChessboard` for RSC** (zero client JS).
- ✅ **Illegal-flash red glow** on rejected moves (`showIllegalFlash`).
- ✅ **Byte-level subscription** — squares subscribe independently, commits scale with moves not with board size.
- ✅ **`prefers-reduced-motion`** respected at the renderer level.

### We don't have (yet — or by design)

- ❌ **Chess960 / variants.** `EngineAdapter` is swappable — [`chessops`](https://github.com/niklasf/chessops)-backed adapters land outside this package.
- ❌ **Full-canvas renderer.** Scaffolding placeholder; DOM is the only live renderer.
- ❌ **PGN viewer chrome** (move list, variation tree, headers, annotations UI). The library draws a board; chrome is your job. See [`examples/next-analysis`](../examples/next-analysis) for one pattern.
- ❌ **Controlled promotion dialog.** Built-in or via `onPromote: () => Promise<PieceType>`. There's no `isPromotionDialogOpen` prop — own the promise if you need full control.
- ❌ **Drop-in prop-for-prop compatibility.** Names, shapes, semantics all evolved. Use this document.

---

## 18. Porting checklist

Paste into your tracking tool, tick as you go.

- [ ] Swap `react-chessboard` + `chess.js` for `gigaboard` + `@gigaboard/pieces` + `@gigaboard/themes`.
- [ ] Delete the `useState<Chess>` and `setGame(new Chess(...))` plumbing.
- [ ] Replace `position={fen}` with `game={useChessGame()}` + `fallbackFen`.
- [ ] Rewrite `onPieceDrop` as `onMove` + (if needed) `canDragPiece`.
- [ ] Audit every call that used the chess instance — route to `game.tryMove / undo / load / reset / legalFrom / getSnapshot`.
- [ ] Replace `customPieces` with a `PieceRenderer` or import a bundled set.
- [ ] Replace `customDark/LightSquareStyle` with a `Theme`.
- [ ] Replace `customSquareStyles` with `renderSquare`.
- [ ] Replace `customArrows` with `setManagedArrows` (or let users right-click draw).
- [ ] Rename `boardOrientation → orientation`, `animationDuration → animation.durationMs`, `showBoardNotation → showCoordinates`, `arePiecesDraggable → allowDrag`.
- [ ] Remove `boardWidth`; size the wrapper via CSS.
- [ ] Call `preloadEngine()` in your root layout.
- [ ] For any SSR/MDX boards, swap in `StaticChessboard` from `gigaboard/server`.
- [ ] (Optional) Keep `chess.js` as a sidecar for SAN / PGN off the render path.
- [ ] Verify Lighthouse / React Profiler: commits-per-move should collapse to 1 and per-move render time to < 1 ms.

When the checklist is done, run the perf harness locally:

```bash
bun run turbo bench                      # Node + Profiler
bun run bench:playwright -w apps/benchmarks     # real browser, 4× throttle
```

Regressions block CI; green-bar gives you a hard number to cite in the PR.

---

## 19. Where to look next

- [`README.md`](../README.md) — API surface at a glance.
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — layer diagram, adapter protocol, extension points.
- [`docs/PERFORMANCE.md`](./PERFORMANCE.md) — the budgets this library holds itself to.
- [`packages/react/src/types.ts`](../packages/react/src/types.ts) — the canonical prop documentation.
- [`examples/next-showcase`](../examples/next-showcase) — every knob on `<Chessboard/>` wired to a live control.
- [`examples/next-analysis`](../examples/next-analysis) — analysis-style board with arrows; closest to an `"rcb replacement in an analysis UI"` shape.
- [`BENCH.md`](../BENCH.md) — numbers behind every perf claim above.

Questions, gaps, or a migration scenario this doc didn't cover? Open an issue — this guide is maintained in-tree and evolves with the library.
