# ADR-018: Monorepo Rebranding to Gigaboard and Clean GPL-Free Lineage

**Date:** 2026-09-06  
**Status:** Accepted  
**Change:** `gigaboard-engine-and-move2`  

---

## 1. Context

Gigaboard was established as an MIT fork of `ultrachess-react` (authored by Yahor Barkouski) to provide a 1:1 React-native replacement for `chessground` without GPL taint. As the project evolved into the official board layer for the `gigachess` engine ecosystem:

1. Package names retained historical `@ultrachess/*` references.
2. CSS variables (`--ucr-*`), DOM data attributes (`data-ucr-*`), and benchmark harnesses used legacy prefixes.
3. Confusion existed between the UI board package (`gigaboard`) and the bitboard move generation engine (`gigachess`).
4. Attribution requirements needed explicit alignment with MIT license obligations.

---

## 2. Decision

### A. Naming Taxonomy
Establish unambiguous naming across all monorepo workspaces and dependencies:
- **`gigaboard`** (`packages/react`): The primary React chessboard UI package.
- **`@gigaboard/core`** (`packages/core`): Framework-agnostic chessboard state machine, byte-level subscription store, and engine adapters.
- **`@gigaboard/pieces`** (`packages/pieces`): Tree-shakable SVG/image piece sets (`cburnett`, `merida`, `alpha`, `neo`, `chesscom`).
- **`@gigaboard/themes`** (`packages/themes`): Zero-runtime CSS custom-property themes (`brown`, `blue`, `green`, `wood`).
- **`@gigaboard/benchmarks`** (`apps/benchmarks`): Benchmark harness and Playwright comparison suite.
- **`@gigaboard/docs`** (`apps/docs`): Next.js documentation application.
- **`gigachess`**: Independent pure JS/TS bitboard chess engine.

### B. Token & Attribute Renaming
- **CSS Custom Properties**: All `--ucr-*` variables migrated to `--gb-*` (`--gb-board-light`, `--gb-board-dark`, `--gb-highlight-selected`, etc.).
- **DOM Data Attributes**: All `data-ucr-*` attributes migrated to `data-gb-*` (`data-gb-turn`, `data-gb-last-move`, `data-gb-grabbable`, `data-gb-selected`, `data-gb-hover`).
- **Benchmark Globals**: Harness API exports `GbBench`, `GbGrid`, `window.__gbBench__`, `window.__gbGrid__`, and `window.__gbFlash__`, while retaining `window.__ucr*` aliases during the transition window.

### C. Attribution Integrity
Retain explicit upstream credit to Yahor Barkouski (`ultrachess-react`, MIT) in:
- Root [`package.json`](file:///Users/ais/Projects/gigaboard/package.json) author field: `"author": "Itshak <aistreltsov@outlook.com> (fork of Yahor Barkouski ultrachess-react)"`
- Repository [`LICENSE`](file:///Users/ais/Projects/gigaboard/LICENSE)
- Credits section in [`README.md`](file:///Users/ais/Projects/gigaboard/README.md)

---

## 3. Consequences

- Clean and consistent identity for developers consuming `gigaboard` and `@gigaboard/*`.
- Full compliance with MIT licensing while eliminating all legacy naming artifacts.
- Zero breaking changes for CSS variables or DOM attributes going forward from v1.3.0.
