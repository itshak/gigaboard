## Context

This is Stage 0 of TurboChessBoard — fork `ultrachess-react` (MIT, 1.2.3) to `turbochessboard` (sibling of `turbochess`), scaffold openspec+IDE skills like `turbochess`, and run a read-only parity audit vs `chessground@10.1.1` before any code changes. Upstream is already fast (BENCH.md 13.0ms p50 INP tied with chessground, 1 commit/move, WAAPI+Canvas) and React-native (no wrappers). We need to validate it covers everything chessground does for BlindBase and surface only high-ROI enhancements.

## Goals / Non-Goals

**Goals:**
- Fork history intact, workspace renamed, openspec `config.yaml` + `AGENTS.md` board-appropriate, all IDE skill folders present (opencode/claude/agents/agent/cursor) so `openspec list` works in both repos.
- Naming ADR resolved (recommendation, not publish yet).
- Reproducible parity matrix chessground features → ultrachess-react props/hooks, gap severity (P0 block / P1 nice / P2 out-of-scope).
- Perf audit method using committed `BENCH.md` harness + local `4× CPU throttle` Playwright repro.
- Recommendation: ship-as-is vs Stage 1 backlog.

**Non-Goals:**
- Changing board rendering, animation, or public API in this change.
- Publishing to npm or deleting upstream `@ultrachess/*` package names.
- TurboChess engine integration (`@ultrachess/core` → TurboChess adapter) — Stage 1.

## Decisions

### D1: Folder vs NPM Name

- **Decision:** Folder `turbochessboard` (what we cloned to `../turbochessboard`) is workspace root. NPM name decision deferred to ADR but **recommended:** `@turbochess/board` for consistency with `turbochess` (`turbochess/chessops`, `turbochess/board`). Alternative `turbochessboard` (unscoped) collides search with `turbochess`; `turboboard` is cute but loses discoverability.
- **Why:** `AGENTS.md` already lists `Planned repo: itshak/turbochessboard` and `NPM proposed: @turbochess/board`. Scoped `@turbochess/*` keeps BlindBase imports symmetric and allows `turbochess` meta-package to re-export board.
- **Rejected:** Staying `@ultrachess/react` — would hide fork ownership and bench attribution.

### D2: Keep Upstream Package Names for Stage 0

- **Decision:** `package.json` workspace `name` → `turbochessboard-workspace` (done), but `packages/react/package.json` keeps `name: @ultrachess/react` + `version: 1.2.3` in this change. Rename to `@turbochess/board` lands in Stage 1 change after audit closes, to keep diff reviewable and `bun run build` green.
- **Trade-off:** Slight confusion until Stage 1, mitigated by `AGENTS.md` note.

### D3: Scaffolding Copy List

- **Sources from `turbochess`:**
  - `.opencode/` (entire, incl. `node_modules`? copy without `node_modules`? we copied whole — acceptable, but `.gitignore` already ignores)
  - `.claude/skills/openspec-*` (6 skills)
  - `.agents/skills/openspec-*` + `.agents/.openspec-target`
  - `.agent/skills/openspec-*` + `.agent/workflows/`
  - `.cursor/commands+skills`
  - `openspec/` — copy then rewrite `config.yaml` `context` to board; keep `adr/`+`specs/` history for ref
  - `AGENTS.md` → `AGENTS.md.turbochess-reference` + fresh `AGENTS.md` board constitution
- **Not copied:** `node_modules/`, `dist/`, `bench/data/*.pgn`, `.git` history (kept upstream history separate).

### D4: Audit Methodology (Read-Only)

- **Source of truth for chessground:** `lichess-org/chessground/src/{types,state,config,board,render,anim,svg,drag,draw}.ts` (10.1.1, 3088 LOC, GPL — read by auditor only, not implementer). Features enumerated from `README` feature list + `types.ts:132` `HeadlessState`.
- **Method:**
  1. Build matrix `rows = chessground features`, `cols = ultrachess-react prop/hook/layer` (`ChessboardProps` in `types.ts`, `chessboard.tsx` composition, `useDrag`, `useArrowGesture`, `useKeyboardNav`, `LiveRegion`).
  2. For each row, mark `✓`/`~`/`✗` + code pointer (`chessboard.tsx:50`, `piece-layer.tsx`, `arrows-layer.tsx` Canvas hash, etc.) and gap severity.
  3. Perf: re-run `apps/benchmarks` harness locally (`bun install && bun run bench:playwright -w apps/benchmarks`) under 4× throttle, compare INP/commits/heat to committed `bench-results/*.json` + chessground `BENCH.md` numbers.
  4. Output: `openspec/changes/turbochessboard-bootstrap/specs/turbochessboard-parity-audit/spec.md` gap table + `design.md` Stage 1 backlog (if any).

### D5: Accessibility & 120fps Invariants

- **Keep:** `WAI-ARIA grid`, `roving tabindex`, `aria-live="polite"` SAN LiveRegion, `prefers-reduced-motion` collapsing WAAPI, `axe-core` 0 critical (all from upstream `docs/TESTING.md`).
- **120fps:** Validate `WAAPI` + `Canvas` stay composited (`transform`/`opacity` only), not `left`/`top`. Win Chrome = 120Hz `rAF`; Mac Safari 18 needs flag off; iOS WKWebView `rAF` capped 60Hz but `transform` still 120Hz — document, don't fight.

## Risks / Trade-offs

- **[Risk]** Copying `openspec/specs/purechess-*` pollutes board specs.
  - **Mitigation:** Stage 0 keeps them read-only; Stage 1 change will `openspec archive` irrelevant specs after bootstrap.
- **[Risk]** Publishing confusion from keeping `@ultrachess/react` name.
  - **Mitigation:** `AGENTS.md` explicit, and Stage 1 renames atomically with CI provenance check.
- **[Risk]** Audit author reads GPL `chessground` source — future implementers must not, or taint.
  - **Mitigation:** Audit doc is *functional* (feature/behavior, not code). Stage 1 implementers read audit spec, not `chessground/src`.

## Open Questions

- Confirm `itshak/turbochessboard` org/repo creation vs `turbochess` mono-repo `packages/board`? Current scaffolding assumes standalone repo for board CI budgets (`<16KB gz`). Mono-repo alternative is cheaper but blurs budgets.
