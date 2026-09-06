# Testing

> How we test, what we test, and why. Read this before your first PR.

Testing is a first-class deliverable in every milestone. "I'll add the tests later" is not a plan — it's how bugs ship. In this repo, **a PR without tests is not reviewable**.

## The stack

| Layer | Tool | Where |
|---|---|---|
| Unit (core, pure logic) | `bun test` + Vitest | `packages/core`, `packages/react` |
| Integration (React components) | Vitest + `@testing-library/react` + `@testing-library/user-event` | `packages/react` |
| Property / fuzz | fast-check (in Vitest) | `packages/core` |
| Differential (engine) | Vitest | `packages/core/test/differential/` |
| Visual regression | Playwright + Loki | `apps/docs`, `examples/*` |
| Accessibility | axe-core + `@axe-core/playwright` | `apps/docs`, `examples/*` |
| Performance regression | React Profiler API + custom bench | `apps/benchmarks` |
| E2E | Playwright | `examples/*` |
| Cross-runtime | Bun + Node matrix | `packages/core` |
| Lighthouse | Lighthouse CI | `apps/docs`, Next.js examples |

## Coverage targets

- Lines: **≥ 80%**
- Branches: **≥ 85%**
- Functions: **≥ 80%**

Enforced per-package via Vitest coverage thresholds. Below these numbers, the build fails.

These floors are intentionally modest. Coverage is a weak proxy for quality — a
suite can hit 100% lines while missing every interesting case. Our real bar is
behavioural: every public symbol has example tests, state machines have
transition matrices, and the engine-integration code has a differential fuzz
run against `gigachess`. The percentage thresholds exist to catch entire
untested modules, not to drive line-counting games.

## Unit tests

**What belongs here:** pure functions, state-machine transitions, decoders, snapshot equality, branded-type round-trips.

**Rules:**
- One behavior per test. Test names read as English sentences: `"returns null when the from square is empty"`.
- No shared mutable state across tests. Every test builds its own board.
- Prefer example tests for clarity, property tests for exhaustiveness. The two reinforce each other.
- `expect` assertions only; no `chai`, no custom matchers unless registered globally.

**Property tests (fast-check):**
- `board-model` round-trips: every `(snapshot, move)` pair that the engine accepts must reproduce the engine's new snapshot byte-for-byte.
- `legal-move-index`: for any random sequence of 1,000 selections across 1,000 positions, cache-hit rate ≥ 95%.
- `packed move` encoders: `encode(decode(x)) === x` for all 2^16 inputs.

## Integration tests

**What belongs here:** anything that renders React and exercises a user-facing flow.

**Rules:**
- Query by accessible role whenever possible (`getByRole("gridcell", { name: "e2" })`). If you can't, the component has an a11y bug — fix that first.
- Use `@testing-library/user-event` (not `fireEvent`) — it simulates real browser event sequencing.
- Synthesize pointer events for drag: `pointerDown → pointerMove* → pointerUp`. Verify `DragLayer` position via `style.transform`, not React state.
- Assert on the rendered DOM or accessible tree, never on component internals.

## Differential fuzz vs. `gigachess`

The engine is the oracle. Our state machine must agree with it on every position.

- Generator: random legal games, depth 80–200 ply, 1,000+ games.
- At every ply, compare:
  - `fen()` string equality
  - `legalMoves()` set equality
  - `hash()` equality
  - `isCheck()`, `isCheckmate()`, `isStalemate()`, `isDraw()`
- Any disagreement is a P0 bug. The test prints the game history for immediate reproducibility.

## Visual regression (doubled down)

Visual bugs are the ones users see first and file last. We snapshot aggressively:

- **Tool:** Playwright driving the Next.js docs app (stories equivalent), screenshots diffed via Loki.
- **Matrix per story:**
  - Viewports: mobile (375 × 667), tablet (768 × 1024), desktop (1440 × 900).
  - Orientations: white, black.
  - Themes: brown, blue, green, wood.
  - Piece sets: cburnett, merida, alpha, neo (the full 4×4×2×3 matrix on piece-set stories; reduced matrix elsewhere).
- **States captured:**
  - Startpos.
  - After common openings (`e4`, `d4`, Sicilian, King's Indian).
  - Midgame test position (Kiwipete).
  - Endgame test position (K+Q vs K).
  - Check / checkmate / stalemate.
  - Selection + legal-target rings.
  - Drag in progress (WAAPI paused at 50%).
  - Promotion dialog open.
  - Arrows at 1 / 5 / 25 simultaneous.
  - Keyboard focus ring on a square.
- **Threshold:** pixel diff < 0.05 %. Any regression blocks merge.
- **Baselines:** committed to the repo. Updating a baseline requires a `feat:` / `fix:` Changeset entry explaining why.

## Accessibility

- axe-core runs on every story + Next.js page. Zero serious/critical violations, period.
- Scripted keyboard-only walkthroughs:
  - Open the board, focus e2, move arrow keys to e4, Enter to confirm, Undo with Ctrl+Z, promote via keyboard.
  - Draw an arrow with keyboard alone.
  - Cancel a pick with Escape.
- Manual audit: NVDA (Windows) and VoiceOver (macOS) passes recorded for every release, logged in this doc.

## Performance regression

- `apps/benchmarks` runs:
  - Per-move component re-render count (React Profiler).
  - Drag frame duration histogram (PerformanceObserver).
  - Arrow redraw count & frame time.
  - Legal-move cache hit rate.
  - `make-move` microbenchmark (includes WASM boundary).
- CI fails on **> 10 %** regression on any headline metric.
- Each benchmark writes a JSON report to `bench-results/`; the dashboard in `apps/docs` graphs history.

## E2E

- Playwright scripts exercise real user flows end-to-end against the Next.js examples:
  - Full analysis game with undo / redo / arrow drawing / premoves.
  - Puzzle trainer completing a 3-move puzzle.
  - Hydration parity: `document.body.innerHTML` pre-hydration === post-hydration for the SSR static board.
- E2E runs on PR (headless, single browser) and nightly (headed matrix: Chromium, Firefox, WebKit).

## Cross-runtime

The core package is exercised under:

- Bun (`bun test`).
- Node 20, 22, 24 (Vitest on each).
- Deno (smoke test via `deno test --allow-read`).

SSR output verified under Node 20, 22, 24.

## Lighthouse

- Lighthouse CI runs on every PR against `apps/docs` and each Next.js example.
- Budgets: perf ≥ 95, a11y ≥ 95, best practices ≥ 95, SEO ≥ 95.

## Writing a good test

1. **Name the behavior, not the implementation.** ✅ `"rejects a move into one's own king"`. ❌ `"calls isSafeMove and returns false"`.
2. **Arrange / Act / Assert** is the structure. If you can't label the three sections in your head, the test is doing too much.
3. **Fail first.** Run the test, watch it fail, then write the code. If it passes on the first run without you writing code, either the feature already exists or the test isn't testing what you think.
4. **No `await new Promise(r => setTimeout(r, 100))`.** If you're sleeping, you're hiding a race. Use `waitFor`, animation-frame microtasks, or explicit promise handles.
5. **Flake is a P0.** If a test is flaky, fix it or delete it — never `retry`.

## Local workflow

```bash
bun install
bun run turbo test                   # unit + integration, all packages
bun run turbo test:visual            # Playwright + Loki
bun run turbo bench                  # perf regression harness
bun -F gigaboard test --watch
```

Visual baselines update: `bun run turbo test:visual -- --update-snapshots`. Always include the updated snapshots in your PR and explain why they changed.
