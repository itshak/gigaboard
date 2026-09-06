# Proposal: TurboChessBoard Fork — Scaffold, Rename & Chessground Parity Audit

## Why

TurboChess (`turbochess`) successfully removed the `chessops` GPL taint via a clean-room MIT engine, but `@lichess-org/chessground` (GPL-3.0-or-later) remains the last GPL dependency in the workstation (`BlindBase`). User is React-native and wants a wrapper-free board with chessground-level performance (1 commit/move, 0 React/frame drag, 120fps GPU) without GPL.

Research (2026-09-02) shows `cm-chessboard` (SVG) is a poor base (full `redrawPieces()` recreate, `SVGTransform` alloc) while MIT alternatives already solve the hard parts:
- `@ultrachess/react` (Yahor Barkouski, MIT) — `Uint8Array(64)` per-byte `useSyncExternalStore`, WAAPI compositor glides, Canvas arrows, `BENCH.md` tied with chessground at `13.0ms p50 INP`, 899ms/100 boards vs chessground 204ms — React-native, no wrappers, `<16KB gz`.
- `@pech/chess-board` (EduardoPech, MIT) — HTML `div.grid` + `diff.ts` pooling, `2093 LOC` vanilla.

Best path is **fork `ultrachess-react` as `turbochessboard`** (folder `../turbochessboard`, proposed npm `@turbochess/board`), scaffold openspec + all IDE skill folders like `turbochess`, and do a *read-only* parity audit vs `chessground` before writing any board code. The library is already marketed as fast chessground alternative — we may need few changes, but must validate that it gives *everything* chessground does for BlindBase (premove/predrop/draw arrows/circles, promotion, orientation, check/lastMove highlights, viewOnly, touch, keyboard+LiveRegion) and identify weak spots / perf opportunities.

This change is **Stage 0: scaffolding + audit**. No board behavior is changed yet; it reuses the upstream as-is behind the new workspace name and produces the gap analysis that Stage 1 will implement.

## What Changes

- **Fork & workspace rename**:
  - Cloned `https://github.com/yahorbarkouski/ultrachess-react` → `/Users/ais/Projects/turbochessboard` (sibling of `turbochess`), kept `master` history, set `origin` to `itshak/turbochessboard` planned remote.
  - Root `package.json` `name` → `turbochessboard-workspace`, `repository` → `itshak/turbochessboard` (packages keep `@ultrachess/*` names for now — ADR decides `@turbochess/board` vs `turbochessboard` vs `turboboard`).
  - Added `AGENTS.md` (board constitution: no GPL, budgets are gates, MIT only, 120fps GPU) and `openspec/config.yaml` tailored to board.

- **OpenSpec + IDE scaffolding**:
  - Copied `.opencode/` (skills + plugin), `.claude/skills/*`, `.agents/skills/*`, `.agent/skills/*` + `workflows/`, `.cursor/commands+skills` from `turbochess`.
  - Copied `openspec/` structure, reset `config.yaml` context to TurboChessBoard (see `openspec/config.yaml`), kept `adr/` history.

- **Parity audit artifact** (no code yet):
  - Systematic feature matrix `ultrachess-react` vs `chessground@10.1.1` (20 modules, 3088 LOC) on: `movable/dests`, `premovable` (incl. `castle`+`customDests`), `predroppable`, `drawable` (arrows/circles `brushes`, `customSvg`, `label`), `dropmode`, `animation` (duration/easing), `highlight` (lastMove/check/custom), `selectable`, `draggable` (distance/autoDistance/ghost/deleteOnDropOff), `viewOnly`, `orientation`, `coordinates`, `exploding` (Atomic), 3D `zIndex`, `FEN` import, keyboard (roving tabindex + LiveRegion), touch, `showDests`/`showPremoveDests`.
  - Perf audit vs chessground: INP, commits/move, drag-frame, heap growth, `WAAPI` vs `rAF` 120Hz on Win/Mac, `Canvas` arrow hash-gate, bounds memoization.
  - Gap list + prioritized `Stage 1` enhancement backlog (if any) — may conclude "ship as-is".

- **Naming ADR** (part of this change): evaluate `turbochessboard` (folder) vs `turbo-board` vs `@turbochess/board` vs `turboboard`. Recommendation inside `design.md`.

## Capabilities

### New Capabilities
- `turbochessboard-bootstrap`: Defines fork scaffolding, rename, openspec/IDE setup, and the invariant that `main` builds+benches green before any board change.
- `turbochessboard-parity-audit`: Defines the read-only chessground parity matrix, perf analysis method, and required accessibility budgets (WAI-ARIA grid, 1 commit/move, <16KB gz).

### Modified Capabilities
- None — this is greenfield fork. Upstream specs (`purechess-*`, `turbochess-*`) remain in `openspec/specs/` for reference but are not modified.

## Impact

- **Public API**: None yet — consumers still `import { Chessboard } from "@ultrachess/react"`; Stage 1 may re-export as `@turbochess/board`.
- **Build**: `bun install` + `turbo run build test size` must still pass in both `turbochessboard` and `turbochess`.
- **License**: Stays MIT (upstream MIT). No GPL introduced; `chessground` never read by implementer.
- **Accessibility & i18n**: Audit must verify LiveRegion SAN, keyboard parity, `prefers-reduced-motion` — any gap becomes Stage 1 spec requirement.
- **Risk**: Low — read-only audit + scaffolding; biggest risk is naming churn before `npm publish`. Mitigated by ADR.
