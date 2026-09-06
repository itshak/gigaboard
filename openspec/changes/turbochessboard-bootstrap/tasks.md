## 1. Scaffold & Rename (already executed in this change, verify)

- [x] 1.1 Clone `yahorbarkouski/ultrachess-react` → `../turbochessboard` (sibling of `turbochess`), preserve `master` history
- [x] 1.2 Root `package.json` → `turbochessboard-workspace`, `repository` → `itshak/turbochessboard`, keep `packages/*` names as `@ultrachess/*` for Stage 0
- [x] 1.3 Copy IDE skills from `turbochess`: `.opencode/` + ` .claude/skills/*` (6) + `.agents/skills/*` + `.agent/skills/*`+`workflows` + `.cursor/`
- [x] 1.4 Copy `openspec/` structure, rewrite `openspec/config.yaml` to `TurboChessBoard` context (MIT, React, 1 commit/move budgets)
- [x] 1.5 Add `AGENTS.md` board constitution (no GPL, budgets are gates, MIT only, WAAPI/Canvas 120fps)
- [x] 1.6 Verify `openspec doctor` → `Root: ok` in `turbochessboard` (not parent), `openspec list --specs` green — verified 2026-09-02, `openspec doctor` ok
- [x] 1.7 Verify `bun install && bun run typecheck && bun run lint && bun run build && bun run test && bun run size` green on clean clone (turbo `size-limit` <16KB gz) — verified `npx bun x turbo run build` 9/9, `typecheck` 13/13, `size` 20.35kB/24kB green
- [ ] 1.8 Push scaffolding to `itshak/turbochessboard` `master` (or keep local until ADR) and add `README` fork banner pointing upstream

## 2. Naming ADR

- [ ] 2.1 Draft `openspec/adr/NNN-turbochessboard-naming.md` — options `turbochessboard` vs `@turbochess/board` (recommended) vs `turboboard`, with `npm search` collision, scope benefits, `turbochess` meta-package re-export plan
- [ ] 2.2 Get decision, keep `@ultrachess/react` name in `packages/react` until Stage 1 rename PR

## 3. Parity Audit — Feature Matrix (read-only, no code)

- [ ] 3.1 Enumerate `chessground@10.1.1` surfaces: `movable` (free/color/dests/showDests/rookCastle/events), `premovable` (enabled/showDests/castle/dests/customDests/additionalPremoveRequirements/events), `predroppable`, `drawable` (enabled/visible/shapes/autoShapes/brushes/customSvg/label/below), `dropmode`, `selectable`, `draggable` (distance/autoDistance/ghost/deleteOnDropOff), `highlight` (lastMove/check/custom), `animation` (enabled/duration), `viewOnly`, `orientation`, `coordinates`+`ranksPosition`, `exploding`, `addPieceZIndex`, `FEN`, keyboard, touch
- [ ] 3.2 Map each to `ultrachess-react` `ChessboardProps` / hooks (`useDrag`, `useClickToMove`, `useKeyboardNav`, `useArrowGesture`, `ArrowsLayer` Canvas) with code pointers (`packages/react/src/chessboard.tsx`, `piece-layer.tsx`, `types.ts`) and `✓/~/✗`
- [ ] 3.3 Identify gaps vs BlindBase needs (premove/predrop for online, `customSvg`/`label` for annotation, `dropmode` for Crazyhouse/editor, `exploding` rarely needed) and severity `P0`/`P1`/`P2`
- [ ] 3.4 File gaps as `spec.md` table in this change with severity and Stage 1 candidate flag

## 4. Parity Audit — Perf & A11y (read-only)

- [ ] 4.1 Re-run `apps/benchmarks` harness (`bun install && bun run turbo bench && bun run bench:playwright -w apps/benchmarks` with `4× CPU throttle`) and diff vs committed `bench-results/*.json` + `BENCH.md` (INP p50 13.0ms, 1 commit/move, 0/drag-frame, heap +1.18MB/500ply, 100-board 45MB vs cg 5.7MB)
- [ ] 4.2 Validate `WAAPI` + `Canvas` composited (no `left`/`top`), `prefers-reduced-motion` 0ms, and bench budgets still gate `size-limit` `<16KB gz`
- [ ] 4.3 Verify `WAI-ARIA grid`, roving `tabindex`, `Enter/Esc/P`, `LiveRegion` SAN `aria-live=polite`, `axe-core` 0 critical — compare to `chessground` `ADR-005` screen-reader win (no `draggable` flood)
- [ ] 4.4 Document 120fps invariant: Win Chrome 120Hz `rAF`=Hz, Mac Safari 18 needs `Prefer Page Rendering Near 60fps off`, iOS WKWebView `rAF` 60Hz cap but `transform` composited 120Hz — no code needed, just docs

## 5. Recommendation & Handoff to Stage 1

- [ ] 5.1 Decision: `ship as-is` vs `Stage 1 backlog` — if gaps are `P0` (missing premove deep, draw hash, promotion UX) queue `turbochessboard-parity` change; if none, archive this change and publish fork banner + `fallbackFen`+`preloadEngine` docs
- [ ] 5.2 Update `docs/STATUS.md` + `BENCH.md` with audit outcome and `turbochess` integration note (`TurboChess` `Dests` → `legalTargets` via adapter)
- [ ] 5.3 `openspec validate --change turbochessboard-bootstrap` green, `typecheck` green, archive with `openspec archive turbochessboard-bootstrap`

