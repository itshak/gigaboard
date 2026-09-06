<p align="center">
  <h1 align="center">Gigaboard</h1>
</p>

<p align="center">
  <strong>The fastest, cleanest React chessboard UI on Earth.</strong><br>
  1:1 Chessground feature parity, zero GPL taint, 120fps GPU compositor glides, 0 drag re-renders, and instant synchronous engine integration.
</p>

<p align="center">
  <a href="https://github.com/itshak/gigaboard/actions/workflows/ci.yml"><img src="https://github.com/itshak/gigaboard/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
  <a href="https://www.npmjs.com/package/gigaboard"><img src="https://img.shields.io/npm/v/gigaboard?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://bundlephobia.com/package/gigaboard"><img src="https://img.shields.io/bundlephobia/minzip/gigaboard?style=flat-square&color=emerald" alt="bundle size"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License: MIT"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=flat-square" alt="TypeScript"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-18%20%2F%2019-61dafb?style=flat-square" alt="React 18/19"></a>
</p>

---

## ⚡ Highlights

* 🏎️ **120fps Butter-Smooth Glides**: GPU-accelerated Web Animations API (WAAPI) compositor animations with zero main-thread jank.
* 🚀 **1 Commit Per Move & 0 Drag Commits**: Per-byte `Uint8Array(64)` subscription store via `useSyncExternalStore`. Zero React re-renders while dragging pieces.
* 🛡️ **100% Permissive MIT License**: Engineered from the ground up as a pure React-native replacement for `chessground` without restrictive GPL/AGPL viral licensing.
* 🎯 **Instant Synchronous Engine**: Backed by `gigachess` (`createGigachessAdapter`) — zero WASM lag, sub-millisecond frame-0 render without blank screen flashes.
* ♿ **First-Class Accessibility (WAI-ARIA)**: Roving tabindex, full keyboard navigation (arrows, Enter, Space, promotion keys), and screen-reader `LiveRegion` announcements.
* 🎨 **Modular Themes & Crisp Piece Sets**: Tree-shakable pieces (~660B/set) and zero-runtime CSS variable themes (`--gb-*`, ~205B/theme).
* 🏹 **Hardware Canvas Arrow Engine**: Imperative high-DPI 2D canvas arrows, freehand gestures, knight L-shapes, and customizable highlight overlays.
* 📦 **SSR & React Server Components Ready**: `gigaboard/server` renders static HTML chessboards on Node/Next.js with zero hydration mismatch and zero client JS.

---

> 💡 **Pure TypeScript & Zero WASM Compile Overhead**: Unlike previous engines that mandate WebAssembly compilation, Gigaboard and GigaChess run 100% synchronously. No WASM loaders, no CORS/CSP header friction, and instant SSR support across Next.js, Remix, Node, Bun, and browser workers.

---

## 📦 Installation

```bash
# npm
npm install gigaboard gigachess @gigaboard/pieces @gigaboard/themes

# bun
bun add gigaboard gigachess @gigaboard/pieces @gigaboard/themes

# pnpm
pnpm add gigaboard gigachess @gigaboard/pieces @gigaboard/themes

# yarn
yarn add gigaboard gigachess @gigaboard/pieces @gigaboard/themes
```

---

## 🚀 Quick Start

### 1. Interactive Game (Zero-Config)

Render a fully interactive chessboard with rule enforcement, move generation, and sound in just 5 lines:

```tsx
import { Chessboard, useChessGame } from "gigaboard";

export function App() {
  const game = useChessGame();
  return <Chessboard game={game} />;
}
```

### 2. Controlled Board (Online Matches & Analysis)

Hook into moves, broadcast state to your server, or drive the board externally:

```tsx
import { Chessboard, useChessGame } from "gigaboard";

export function OnlineGame({ initialFen, onPlayerMove }) {
  const game = useChessGame({
    fen: initialFen,
    onMove: (move) => {
      console.log(`Played ${move.san} (${move.from} → ${move.to})`);
      onPlayerMove(move);
    },
  });

  return (
    <Chessboard
      game={game}
      orientation="white"
      sound={true}
    />
  );
}
```

---

## 📊 Comparison: Gigaboard vs Alternatives

Measured under Chromium on Apple Silicon (4× CPU throttle, 40-ply Sicilian Najdorf):

| Feature / Metric | 🚀 **Gigaboard** | 📦 **`react-chessboard`** | ♟️ **`chessground`** |
|---|---|---|---|
| **License** | **100% MIT** | MIT | ⚠️ **GPL-3.0 (Viral)** |
| **Architecture** | **Native React + Byte Store** | React Component | Vanilla JS Imperative Wrapper |
| **React Commits per Move** | **1.00 commit** | 2.83 commits | *(None — imperative DOM)* |
| **React Work during Drag** | **0 work (Refs-only)** | Multiple Re-renders | 0 work |
| **Engine Initialization** | **Instant Sync (<0.5 ms)** | Slow `chess.js` | Bring-Your-Own Engine |
| **100-Board Grid Memory** | **45.3 MB Heap** | 120.6 MB Heap (2.7× larger) | 5.7 MB Heap |
| **100-Board Grid DOM Nodes** | **16,040 nodes** | 53,332 nodes (3.3× more) | 15,939 nodes |
| **Animation Engine** | **Compositor WAAPI (120fps)** | CSS Transitions / rAF | Imperative Transforms |
| **Arrow Engine** | **Single 2D Canvas Layer** | SVG Elements | SVG Elements |
| **WAI-ARIA Accessibility** | **Full (Grid, LiveRegion)** | Minimal | Incomplete |
| **Keyboard Move Entry** | **Full Keyboard Parity** | Partial | Partial |
| **SSR / RSC Static Board** | ✅ **Built-in (`gigaboard/server`)** | ❌ None | ❌ None |

*See [`BENCH.md`](./BENCH.md) for full Playwright traces, long-task observations, and memory audits.*

---

## 💡 Common Recipes

### 1. Themes & Piece Sets

Mix and match tree-shakable piece sets and CSS-variable themes without bundle bloat:

```tsx
import { Chessboard, useChessGame } from "gigaboard";
import { cburnett } from "@gigaboard/pieces/cburnett";
import { wood } from "@gigaboard/themes/wood";

export function CustomBoard() {
  const game = useChessGame();
  return <Chessboard game={game} pieces={cburnett} theme={wood} />;
}
```

Available piece sets (`@gigaboard/pieces/*`):
* `neo` (default, crisp chess.com vector style)
* `cburnett` (traditional Lichess silhouette)
* `merida` (wood-tinted tournament set)
* `alpha` (minimalist mobile silhouettes)
* `chesscom` (explicit alias for neo)

Available themes (`@gigaboard/themes/*`):
* `green` (default chess.com palette)
* `brown` (classic tournament wood)
* `blue` (modern cool contrast)
* `wood` (warm natural board)

---

### 2. Drawing Arrows & Brush Highlights

Support right-click drag arrows and square highlights for streaming and analysis:

```tsx
import { Chessboard, useChessGame } from "gigaboard";

export function AnalysisBoard() {
  const game = useChessGame();

  return (
    <Chessboard
      game={game}
      drawable={{
        enabled: true,
        arrows: [
          { from: "e2", to: "e4", color: "green" },
          { from: "g1", to: "f3", color: "blue" },
        ],
        highlights: [
          { square: "e4", color: "rgba(255, 170, 0, 0.4)" },
        ],
      }}
    />
  );
}
```

---

### 3. Premoves & Fast Pacing

Enable bullet and blitz players to queue premoves smoothly:

```tsx
<Chessboard
  game={game}
  allowPremove={true}
  sound={true}
  haptics={true} // Optional mobile vibration feedback
/>
```

---

### 4. Full Keyboard & Screen Reader Accessibility

Gigaboard is built with uncompromising accessibility compliance:
* **WAI-ARIA 1.2 Grid**: Correct roles (`grid`, `row`, `gridcell`), roving tabindex, and coordinate indexing.
* **LiveRegion Move Announcer**: Automatically speaks moves in Standard Algebraic Notation (SAN) to screen readers.
* **Accessible Promotion Dialog**: Keyboard arrow trapping, auto-focus, and screen-reader announcements.
* **Custom Speech Labels**: Localize square announcements via `getSquareAriaLabel`.

```tsx
<Chessboard
  game={game}
  getSquareAriaLabel={(square, cell) => `Square ${square}, ${cell ? "occupied" : "empty"}`}
  onSquareFocus={(square, cell) => console.log(`Focused ${square}`)}
/>
```

---

### 5. Server-Side Rendering (Next.js & RSC)

Render static chessboards on the server with zero client JavaScript and 100% hydration parity:

```tsx
import { StaticChessboard } from "gigaboard/server";

export default function Page() {
  return (
    <main>
      <h1>Puzzle of the Day</h1>
      <StaticChessboard fen="r1bqk2r/pp1n1ppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R w KQkq - 0 7" />
    </main>
  );
}
```

---

## 🏛️ Monorepo Architecture

| Package | Role | Description |
|---|---|---|
| **[`gigaboard`](file:///Users/ais/Projects/gigaboard/packages/react)** | Primary UI | High-performance React chessboard component, hooks, WAAPI animations, and canvas arrows. |
| **[`@gigaboard/core`](file:///Users/ais/Projects/gigaboard/packages/core)** | Headless State | Zero-DOM `BoardModel`, per-byte `Uint8Array(64)` subscription store, and `gigachess` adapter. |
| **[`@gigaboard/pieces`](file:///Users/ais/Projects/gigaboard/packages/pieces)** | Piece Renderers | Ultra-compact URL-based piece renderers (~660 B/set). |
| **[`@gigaboard/themes`](file:///Users/ais/Projects/gigaboard/packages/themes)** | Visual Themes | Zero-runtime CSS custom-property palettes (`--gb-*`, ~205 B/theme). |

---

## 🤝 Upstream & Credits

Gigaboard was created as an MIT-licensed fork of **[`ultrachess-react`](https://github.com/yahorbarkouski/ultrachess-react)** by **Yahor Barkouski** (MIT). We are deeply grateful for Yahor's original pioneering work on per-byte React chessboard subscription architectures.

---

## 📄 License

[MIT](./LICENSE) © 2026 Itshak & Yahor Barkouski. Completely free for open-source, commercial, and proprietary projects.
