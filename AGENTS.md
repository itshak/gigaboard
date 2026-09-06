# AGENTS.md — Gigaboard AI Agent Instructions

> Fork of `ultrachess-react` (Yahor Barkouski, MIT). This file is the canonical README for AI agents working on Gigaboard.

---

## Project Overview

**Gigaboard** is the fastest React chessboard UI — MIT fork of `ultrachess-react`, built to be the 1:1 `chessground` replacement without GPL taint.

- **License:** MIT (upstream MIT, no GPL)
- **Language:** TypeScript 5.9+ strict, React 18.3/19, Vite, Turborepo, Bun
- **Runtime:** Browser ESM, Node 20+ for SSR static board
- **Upstream:** https://github.com/yahorbarkouski/ultrachess-react
- **Planned repo:** https://github.com/itshak/turbochessboard
- **NPM packages:** `gigaboard` (packages/react), `@gigaboard/core`, `@gigaboard/pieces`, `@gigaboard/themes`.

---

## Architecture & Tech Stack

| Layer | Technology |
|---|---|
| **State** | `Uint8Array(64)` board, `useSyncExternalStore` per-byte subscription — 1 commit/move, 0 React/frame drag |
| **Animation** | Web Animations API (`element.animate`) on compositor, `planAnimations(prev,next)` diff |
| **Arrows** | Single `<canvas>` imperative 2D |
| **Drag** | Refs-only `pointermove` → `style.transform` on drag layer, no state writes |
| **Engine** | `@gigaboard/core` + `gigachess` bitboard engine (`createGigachessAdapter`) — zero WASM, instant sync init |
| **SSR** | `gigaboard/server` RSC — zero JS, hydration-parity DOM |
| **Themes/Pieces** | `@gigaboard/themes/*`, `@gigaboard/pieces/*` tree-shakable |

---

## Build & Test Commands

```bash
bun install                              # install (Bun primary, or npx --yes bun@1.3.10 install)
bun run build                            # build all packages (turbo run build)
bun run typecheck                        # turbo run typecheck — MUST pass
bun run lint                             # biome lint
bun run test                             # turbo run test
bun run bench                            # Node + React Profiler benches
bun run size                             # size-limit budgets

# Playwright bench (separate app, needs browser):
npx playwright install chromium
bun --cwd apps/benchmarks run bench:playwright   # 3-way bench vs rcb/cg (4× throttle)

# Quick verification (one at a time, no trailing comments):
bun run build
bun run typecheck
bun run size
```

---

## Repository Map

```
gigaboard/
├── packages/
│   ├── react/            # gigaboard
│   │   └── src/          # chessboard.tsx, hooks/*, components/*
│   ├── core/             # @gigaboard/core — BoardModel, BoardStore, gigachess adapter
│   ├── pieces/           # @gigaboard/pieces/* — 660B/set
│   └── themes/           # @gigaboard/themes/* — 205B/theme
├── apps/
│   ├── benchmarks/       # Playwright 1.50 Chromium bench harness, bench-results/*.json
│   └── docs/             # Next.js 15 docs
├── examples/
│   └── next-showcase/    # comprehensive example
├── openspec/             # spec-driven changes, ADRs
└── dist/ (via turbo)
```

---

## Project Constitution — ALWAYS Follow

### 1. No Wrappers, No GPL
- **NEVER** depend on `chessground` or any GPL code — this fork exists to eliminate that taint.
- **ALWAYS** keep React-native API (`<Chessboard game>`), not `chessground.set({...})` imperative.

### 2. Performance Budgets Are Gates
- **MUST** keep 1 commit/move, 0 commits/drag-frame, <16KB gz interactive (`packages/react`).
- **ALWAYS** run `bun run bench` before claiming perf wins — see `BENCH.md` budgets.
- **NEVER** add main-thread work per pointermove — refs-only.

### 3. Accessibility & 120fps
- **MUST** maintain WAI-ARIA grid, roving tabindex, LiveRegion SAN, `prefers-reduced-motion` collapsing WAAPI to 0.
- **ALWAYS** animate via `transform`/`opacity` composited (WAAPI/Canvas), not `left`/`top` — GPU 120Hz on Win/Mac, `rAF` 60Hz on iOS WKWebView is expected.
- **ALWAYS** test keyboard parity (Tab, arrows, Enter, Esc, P promotion).

### 4. MIT Clean
- **MUST** stay MIT/Apache-2.0/ISC deps only. No GPL, no `wasm-unsafe-eval` without allow.

---

## Key Files for Audit vs Chessground

- `packages/react/src/chessboard.tsx:1` — top composition, `useAnimation`, `useDrag`, `useArrowGesture`
- `packages/react/src/components/piece-layer.tsx` — per-byte `useSquareCell`, grid, WAAPI
- `packages/react/src/hooks/use-drag.ts` — refs-only drag
- `packages/react/src/hooks/use-animation.ts` — WAAPI scheduler
- `apps/benchmarks/bench-results/*.json` — committed bench outputs
