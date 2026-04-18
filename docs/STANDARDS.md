# Engineering Standards

> The single source of truth for how we write code in this repo. Every PR must comply. When in doubt, this doc wins.

Ultra Chess React is a performance-critical, public-facing React library. Users put our code in the hot path of interactive UIs; a sloppy re-render or a 2 KB accidental dependency hurts everyone downstream. These standards exist so that speed, clarity, and correctness are the default — not something we add later.

---

## 1. TypeScript

### 1.1 Strictness is non-negotiable

`tsconfig.base.json` enables every strict flag TypeScript offers:

- `strict`, `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `alwaysStrict`.
- `exactOptionalPropertyTypes` — `{ x?: string }` means "absent or string", never `undefined`.
- `noUncheckedIndexedAccess` — indexed access returns `T | undefined`. Narrow before use.
- `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `noImplicitReturns`.
- `noUnusedLocals`, `noUnusedParameters` (prefix unused args with `_` if intentional).
- `isolatedModules` + `verbatimModuleSyntax` — every file must be independently compilable; type-only imports must use `import type`.

Do not relax any of these locally. If a rule is wrong for a file, fix the code, not the rule.

### 1.2 No `any`, ever

- `any` is banned by Biome (`noExplicitAny: error`).
- At external boundaries (e.g. parsing JSON, WASM return values), use `unknown` and narrow with a type predicate or a discriminated union. The narrowing is part of the contract.
- Do not use `as` except for genuine branding or when narrowing after a runtime check you're confident in. Document non-obvious casts with a single-line comment explaining the invariant.

### 1.3 Branded primitives for domain values

Raw `number` / `string` for things that mean different things is a bug farm. Use branded types:

```ts
export type SquareIndex = number & { readonly __brand: "SquareIndex" };
export type PackedMove  = number & { readonly __brand: "PackedMove" };
```

Constructors (`toSquareIndex(x: number): SquareIndex`) should validate in dev and be a no-op cast in production via `/*#__PURE__*/` helpers. This costs zero runtime and catches entire classes of bugs at compile time.

### 1.4 Types: `type` by default, `interface` when extensible

- Use `type` for object shapes and unions. Default.
- Use `interface` only for public APIs that third parties may declaration-merge to extend (e.g. a user supplying a custom `PieceRenderer`).
- Prefer discriminated unions over boolean flags:

  ```ts
  // ❌ Booleans accumulate impossible states
  type State = { isDragging: boolean; isAnimating: boolean; isPromoting: boolean };

  // ✅ One state, knowable at a glance
  type State =
    | { kind: "idle" }
    | { kind: "dragging"; from: SquareIndex; pointer: PointerInfo }
    | { kind: "animating"; descriptor: AnimDescriptor }
    | { kind: "promoting"; from: SquareIndex; to: SquareIndex };
  ```

### 1.5 Public symbols need TSDoc

Anything exported from `src/index.ts` has:

- A one-line summary.
- `@param` / `@returns` when non-obvious.
- `@example` for components and hooks.
- `@remarks` for performance notes or constraints.

### 1.6 Immutability

- `readonly` on public fields.
- `ReadonlyArray<T>` / `ReadonlyMap` / `ReadonlySet` on return types.
- Snapshots produced by the store are frozen (`Object.freeze` in dev builds, elided in prod via `if (process.env.NODE_ENV !== "production")`).

### 1.7 Error handling

- Typed error classes, mirroring `ultrachess`: `IllegalMoveError`, `InvalidFenError`, `EngineDisposedError`.
- Never `catch` silently. If you swallow an error, comment the invariant that justifies it.
- Results where both outcomes are expected return a discriminated union, not a thrown error.

---

## 2. React

### 2.1 Components are functions, not classes

- Function components only. No `React.Component`, no `React.FC` (hides children typing and rejects generics).
- Props type is `type FooProps = { ... }` declared in the same file.
- Default values via destructuring: `function Foo({ size = 64 }: FooProps)`.

### 2.2 State lives in stores, not Context

- Engine state and board state live in `@ultrachess/core` stores, subscribed via `useSyncExternalStore`.
- Context is for **services** (the store instance, config) — never for state that changes. A Context whose value changes is a silent re-render grenade.
- Each `Square` subscribes only to its byte in the `Uint8Array(64)` snapshot. Equality compares a byte, not an object; React skips untouched squares.

### 2.3 Memoization is earned, not assumed

- `useMemo` / `useCallback` only when they guard a dependency-tracked child that would otherwise re-render. Otherwise, the allocation and the dep-array are worse than just letting it run.
- `React.memo` on leaf components whose props are primitives or stable references.
- Prefer fewer props over more props — stability is easier when there's less to stabilize.

### 2.4 No `useEffect` for derived state

- Derived from props/state? Compute it inline or with `useMemo`.
- Need to subscribe to an external store? `useSyncExternalStore`.
- Need to sync with the DOM after render? That is the only real use for `useEffect`.
- Writing to state inside `useEffect` because of other state is almost always a bug — model the relationship explicitly.

### 2.5 Refs for imperative hot paths

- During drag: read pointer coords, write `element.style.transform` in a `pointermove` handler. **Zero React state writes per frame.**
- During animation: WAAPI (`element.animate(...)`) started from a commit effect; React has no idea the animation is happening.
- Expose imperative handles via `useImperativeHandle` only when a parent genuinely needs them (focus management, measurement).

### 2.6 `"use client"` is a last resort

- Default-server. A component is client-only if it needs: event handlers, browser APIs, `useState`/`useEffect`, or subscription to a client store.
- Draw the client boundary as close to the leaf as possible. A `"use client"` at the top of your tree pulls the whole tree into the client bundle — that's a regression against our SSR goals.

### 2.7 JSX style

- Self-closing tags for elements without children.
- Props on their own line when there are three or more, sorted with the most-identifying prop first (`id`/`key`/`role` before style/handlers).
- Conditional rendering: `{x && <Foo/>}` only when `x` is definitively boolean; use `x != null && <Foo/>` otherwise to avoid rendering literal `0` or `""`.

---

## 3. Next.js (App Router)

### 3.1 Server components first

- `app/` pages are server components by default.
- Mark client leaves with `"use client"`; keep the boundary tight.
- Use `next/dynamic` with `{ ssr: false }` only for things that genuinely cannot render on the server (e.g. canvas measurements). The board itself renders on the server.

### 3.2 No top-level `await` in client bundles

- `ultrachess` initializes asynchronously in the client. Load it inside a `useEffect`, or use `ultrachess/inline` and initialize synchronously.
- Top-level `await` in a client module breaks older bundlers and breaks `next/dynamic` chunking.

### 3.3 CSS variables via `useInsertionEffect`

- Theme vars are injected in `useInsertionEffect` so they beat first paint.
- Never use `useLayoutEffect` on the first-paint path — it causes hydration jank.

### 3.4 Streaming / suspense

- Board interactivity is below the fold in docs; wrap with `<Suspense>` and a lightweight fallback so the rest of the page streams immediately.

### 3.5 Metadata, viewport, image

- Use the app router metadata API exclusively. No manual `<head>` writes.
- `next/font` for typography — never link a CDN font in `<head>`.
- `next/image` for any raster asset; SVG pieces render inline.

---

## 4. Performance

### 4.1 Budgets are contracts

| Package | Gzip budget |
|---|---|
| `@ultrachess/core` | 6 KB |
| `@ultrachess/react` | 14 KB |
| `@ultrachess/pieces` (per set) | 2 KB |
| `@ultrachess/themes` (per theme) | 1 KB |

CI blocks any PR that pushes over budget. A budget increase requires a Changeset + an ADR justifying it.

### 4.2 Render-count budgets

- Hover (square or piece): **0 re-renders**.
- Arrow draw-gesture: **0 re-renders** (canvas imperative).
- Drag frame: **0 re-renders per frame** (refs + transform).
- Single move: **≤ 4 component re-renders** (from-square, to-square, optional captured-piece component, highlight layer delta).

Enforced by `apps/benchmarks` + React Profiler assertions in CI.

### 4.3 Tree-shaking rules

- `"sideEffects": false` in every package `package.json`.
- Barrels only at `src/index.ts`, hand-curated. No `export * from "./x"` unless the whole module is genuinely part of the public API.
- Separate sub-paths for optional features: `@ultrachess/react/canvas`, `@ultrachess/pieces/sets/cburnett`.

### 4.4 Measure, don't guess

- Every perf claim in the README links to a committed benchmark in `apps/benchmarks`.
- Suspect a regression? Run the benchmark locally, commit the numbers, then make your change. Diff the numbers in the PR.

---

## 5. Files, naming, structure

- Files: `kebab-case.ts`, `PascalCase.tsx` for components.
- Components: PascalCase, one per file, file name matches component name.
- Hooks: `useXxx.ts`, verbs describing what they do (`useChessGame`, not `useGame`).
- Folders: plural for collections (`components/`, `hooks/`, `renderers/`), singular for categories (`server/`, `types.ts`).
- One public symbol per file. Co-locate types in the file that owns them.
- Tests live in `test/` next to the package source, mirroring the structure.

---

## 6. Imports & dependencies

- Relative imports only within a package (no path aliases).
- Cross-package imports by package name (`@ultrachess/core`) with `workspace:*` version ranges in `package.json`.
- `import type` for type-only imports (enforced).
- External dependencies: minimize ruthlessly. A new dep needs a Changeset line justifying it. "It would be convenient" is not a justification.

---

## 7. Accessibility

- Board is `role="grid"`; squares are `role="gridcell"`; `aria-label` includes algebraic coordinate and piece.
- Full keyboard parity with pointer: Tab to board, arrows to move focus, Enter to pick/drop, Escape to cancel, `P` for promotion menu.
- `prefers-reduced-motion` collapses animations to 0 ms.
- Screen-reader live region: `<div aria-live="polite" class="sr-only">` announces last SAN move.
- Color contrast ≥ 4.5:1 for coordinates, ≥ 3:1 for board squares against background.
- axe-core zero serious/critical violations across every story and Next.js example. Enforced in CI.

---

## 8. Testing

See [`TESTING.md`](TESTING.md) for the full matrix. The high-level principles:

- **No PR merges without a failing-then-passing test.** The test comes first.
- Unit tests for pure logic; integration for hooks + components; visual for rendering; E2E for flows; perf for budgets; a11y for compliance.
- Coverage ≥ 80% lines / 85% branches on every package. Coverage is a floor,
  not a goal — behavioural testing (example + property + differential) is what
  we actually care about. See [`TESTING.md`](TESTING.md).
- Flake is a P0 bug — fix the test or delete it, never retry.

---

## 9. Commits, PRs, releases

- **Conventional Commits**: `feat:`, `fix:`, `perf:`, `refactor:`, `test:`, `docs:`, `chore:`, `build:`, `ci:`.
- One logical change per commit. Squash is OK at merge time; don't do it during review.
- Every user-visible change ships with a `.changeset/*.md` describing the change and the semver bump.
- PR title matches the Changeset summary. PR description must reference the ADR or test that validates the change.
- No direct commits to `main`.

### 9.1 Commit cadence — commit early, commit often

> "A commit is a save point. Don't skip save points."

Commit frequently so we never lose work and so the history tells a clear story:

- **After every milestone.** When an `M0`, `M1`, `M2`, … milestone exits (its
  exit-criteria gates pass), commit. No milestone is "done" in memory only —
  it's done when a commit proves it.
- **After every heavy decision.** When you finalise an architectural choice,
  change a public API shape, flip a config that affects every package, or land
  a `docs/` update that others will read, commit the decision as its own
  atomic unit. Decisions need to be reviewable in isolation.
- **At natural pause points within a milestone.** If a milestone is multi-day
  or multi-package, commit each sub-piece as it lands (code + tests + docs in
  the same commit). `git log --oneline` should read like a sentence.
- **Before risky refactors.** Always commit a green state before a rewrite
  you're not sure about, so `git reset --hard HEAD` is safe.

Never:

- Carry large uncommitted work across sessions. If the branch is dirty at
  context-switch time, either commit a WIP or stash — pick one, don't let
  untracked files accumulate.
- Bundle unrelated changes into a single commit. A milestone commit contains
  only that milestone's work. If you fixed a typo along the way, that's a
  separate `docs:` commit.

Workflow at each commit boundary:

1. `bun run ci` is green (lint + typecheck + build + test + size).
2. Relevant docs updated.
3. Commit message follows Conventional Commits and states what and why.
4. Push — pushed work is backed up, unpushed work is a local gamble.

---

## 10. Documentation

- Public API: TSDoc on every exported symbol.
- Architecture decisions: ADRs in `docs/adr/NNN-short-title.md` (Michael Nygard format: Context / Decision / Consequences).
- User-facing guides: MDX in `apps/docs/content/`.
- Every example in `/examples/*` has a runnable README with the one-liner to start it.

---

## 11. Review checklist

Before you open a PR, verify:

- [ ] Tests added/updated and pass locally.
- [ ] `bun run ci` passes (lint + typecheck + build + test + size).
- [ ] No new `any`, no new `// @ts-ignore`, no new `// eslint-disable`.
- [ ] No new dependency without a Changeset justifying it.
- [ ] Render-count budgets hold (see `apps/benchmarks` results in the PR description).
- [ ] Visual regression baselines updated only intentionally.
- [ ] Docs / ADR / Changeset included as needed.

If you can't check every box, the PR isn't ready.
