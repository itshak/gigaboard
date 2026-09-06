## Purpose

Fork `ultrachess-react` to `turbochessboard` and scaffold a spec-driven workspace that is build-green before any board behavior changes, plus produce a read-only chessground parity audit that gates Stage 1.

## ADDED Requirements

### Requirement: Workspace Fork SHALL Preserve Build Integrity

The system SHALL keep the upstream workspace buildable after rename: `bun install && bun run typecheck && bun run lint && bun run build && bun run test && bun run size` passes on `master` before audit.

#### Scenario: Fresh clone builds green
- **WHEN** a contributor clones `itshak/turbochessboard` and runs `bun install && bun run typecheck && bun run build`
- **THEN** turbo returns 0, packages `@ultrachess/*` produce `dist/*.js` with `sideEffects:false`, and `openspec list` shows change `turbochessboard-bootstrap` with 0 errors on `openspec doctor`

#### Scenario: Scaffold does not break benchmarks
- **WHEN** `bun run bench` (Node + Profiler) is run
- **THEN** it emits `bench-results/{core,render}.json` without regressions vs committed `BENCH.md` budgets (1 commit/move, <16KB gz react)

### Requirement: OpenSpec & IDE Skills SHALL Mirror turbochess Standard

The system SHALL provide `openspec/config.yaml` (board context), `AGENTS.md` (board constitution: no GPL, budgets are gates, MIT only), and skill folders `.opencode/skills/*`, `.claude/skills/*`, `.agents/skills/*`, `.agent/skills/*`+`workflows`, `.cursor/commands+skills` so `openspec list --specs` and `openspec status --change` work identically in both repos.

#### Scenario: `openspec list` works identically
- **WHEN** `openspec list --specs` and `openspec doctor` are run in both `turbochess` and `turbochessboard`
- **THEN** each reports `Root: ok`, `No active changes` (or only `turbochessboard-bootstrap` in board), and `AGENTS.md` is discoverable by `claude`, `cursor`, `opencode`

### Requirement: Naming ADR SHALL Be Decided Before npm Publish

The system SHALL record a naming ADR choosing among `turbochessboard` (unscoped), `@turbochess/board` (scoped, recommended), `turboboard`, with rationale and migration path for `@ultrachess/react` consumers.

#### Scenario: Naming ADR blocks publish
- **WHEN** `openspec/changes/turbochessboard-bootstrap` is archived
- **THEN** `openspec/adr/` contains an ADR `turbochessboard-naming` selecting one name, listing `packages/react` rename steps, and preserving provenance for npm

### Requirement: Parity Audit SHALL Be Read-Only and Exhaustive

The system SHALL produce a feature matrix `chessground@10.1.1` (README features + `types.ts:132` `HeadlessState`) vs `ultrachess-react` `ChessboardProps` without modifying board code. Audit is functional (behavior), not GPL code copy.

#### Scenario: Audit covers all chessground surfaces
- **WHEN** audit `spec.md` table is reviewed
- **THEN** every `HeadlessState` field (`movable.dests`/`free`/`showDests`, `premovable.enabled/castle/customDests`, `predroppable`, `drawable.shapes/autoShapes/brushes/customSvg/label/below`, `dropmode`, `selectable`, `draggable.distance/autoDistance/ghost/deleteOnDropOff`, `highlight`, `animation`, `viewOnly`, `orientation`, `coordinates`, `exploding`, `addPieceZIndex`) has a row with `✓/~/✗`, code pointer, and severity `P0/P1/P2`

#### Scenario: Audit validates perf budgets locally
- **WHEN** `bun run bench:playwright -w apps/benchmarks` is run with `4× CPU throttle` on a clean checkout
- **THEN** results are compared to committed `apps/benchmarks/bench-results/*.json` and `BENCH.md` (INP p50 13.0ms, 1 commit/move, 0 drag-frame, heap growth +1.18MB/500ply) and deltas >10% are flagged as gaps

### Requirement: Audit SHALL Include Accessibility Budgets

The system SHALL verify WAI-ARIA grid, roving tabindex, keyboard parity (arrows/Enter/Esc/P), `LiveRegion` SAN `aria-live`, `prefers-reduced-motion`, and `axe-core` 0 critical are retained vs chessground `ADR-005` a11y win.

#### Scenario: Keyboard and screen reader parity
- **WHEN** keyboard audit is run (`Tab` → board, `arrows` move focus, `Enter` pick/drop, `Esc` cancel, `P` promotion) and `VoiceOver`/`NVDA` exercised
- **THEN** every pointer action has a keyboard equivalent, LiveRegion announces SAN, and `prefers-reduced-motion: reduce` collapses WAAPI to 0ms — gaps filed as `P0` if missing, blocking Stage 1 ship-as-is decision

#### Scenario: 120fps GPU invariant is documented
- **WHEN** audit notes animation path (`WAAPI` + `Canvas` vs `left`/`top`)
- **THEN** it confirms `transform`/`opacity` composited on Win Chrome/Mac Safari 18 at 120Hz, notes iOS WKWebView `rAF` 60Hz cap but composited `transform` still 120Hz, and no code change is required for this invariant in Stage 0
