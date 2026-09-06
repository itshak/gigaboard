# ADR-019: Single-Package Consolidation with Subpath Exports

**Date:** 2026-09-06
**Status:** Accepted
**Change:** `gigaboard-single-package`

---

## 1. Context

Gigaboard shipped as four npm packages in `packages/*`: `gigaboard` (React UI), `@gigaboard/core` (headless models and engine adapter), `@gigaboard/pieces` (SVG/image piece sets), and `@gigaboard/themes` (CSS-variable themes). Physical package boundaries provided separation but imposed severe overhead:

1. Consumers installed up to 4 packages (`npm i gigaboard @gigaboard/core @gigaboard/pieces @gigaboard/themes`).
2. The `@gigaboard` npm scope required organization membership and permission management.
3. Multi-package versioning in release-please required coordinated bumps and risked version-mismatch bugs.
4. Modern Node/bundler `exports` subpaths solve code splitting and tree-shaking with zero runtime overhead.

See `openspec/changes/gigaboard-single-package/proposal.md` and `design.md` for motivation.

---

## 2. Decision

### A. Single `gigaboard` Package with Subpath Exports

Consolidate all sources under `packages/react` (the `gigaboard` package) and expose strict boundaries via `package.json` `exports`:

- `gigaboard` → `dist/index.{js,cjs,d.ts}` — interactive `<Chessboard />`, hooks (`useChessGame`, `useAnimation`, `useDrag`, `useArrowGesture`), types.
- `gigaboard/core` → `dist/core.{js,cjs,d.ts}` — headless `BoardModel`, `BoardStore`, `createGigachessAdapter`, Move2 bitfields. Zero React, zero DOM.
- `gigaboard/server` → `dist/server.{js,cjs,d.ts}` — RSC `<StaticChessboard />`, zero client JS, hydration parity.
- `gigaboard/pieces` → `dist/pieces.{js,cjs,d.ts}` — registry (`pieceSets`); `gigaboard/pieces/*` → `dist/pieces/*.js` per set (`neo`, `cburnett`, `merida`, `alpha`, `chesscom`, ~660 B/set).
- `gigaboard/themes` → `dist/themes.{js,cjs,d.ts}` — registry (`themes`); `gigaboard/themes/*` → `dist/themes/*.js` per theme (`green`, `brown`, `blue`, `wood`, ~205 B/theme).
- `gigaboard/canvas` retained for compatibility (`dist/canvas.js`).

*Alternative considered:* Single barrel `import { Chessboard, createGigachessAdapter } from 'gigaboard'`.
*Rejected because:* Node/SSR import would load React DOM hooks; bundling all piece SVGs into main entry would explode the <16 KB gz budget. Subpaths enforce isolation.

### B. Source Layout

```
packages/react/src/
├── index.ts               # Root export (Chessboard, hooks, types)
├── core/                  # Former @gigaboard/core (BoardModel, gigachess adapter, move2)
├── server.tsx             # StaticChessboard (gigaboard/server)
├── pieces/                # Former @gigaboard/pieces (factory, default-pieces, sets/*, index)
└── themes/                # Former @gigaboard/themes (green, brown, blue, wood, index)
```

Remove `packages/core`, `packages/pieces`, `packages/themes`. Migrate their vitest suites into `packages/react/test/core/`, `test/pieces-smoke.test.tsx`, `test/themes-smoke.test.ts` with updated relative imports (`../src/core/index.js`, etc.). Update all `packages/react/src` imports from `@gigaboard/core` to `./core/index.js` / `../core/index.js`.

*Alternative considered:* Keeping `packages/core` as internal workspace-only package.
*Rejected because:* Single source tree simplifies build pipelines, TypeScript project references, and eliminates internal symlink issues.

### C. Multi-Entry Build (`tsup`)

`packages/react/tsup.config.ts` builds all subpaths with ESM + CJS + `.d.ts`:

```ts
entry: {
  index: 'src/index.ts',
  core: 'src/core/index.ts',
  server: 'src/server.tsx',
  canvas: 'src/renderers/canvas.ts',
  pieces: 'src/pieces/index.ts',
  'pieces/neo': 'src/pieces/sets/neo.ts',
  // ... cburnett, merida, alpha, chesscom
  themes: 'src/themes/index.ts',
  'themes/brown': 'src/themes/brown.ts',
  // ... blue, green, wood
}
```

`external: ["react", "react-dom", "web-haptics", "gigachess"]` plus automatic dependency externalization ensures `gigaboard/core` contains zero `react` references (verified via bundle grep + size-limit). `gigachess` moves from transitive (`@gigaboard/core`) to direct `dependencies`. `tsconfig` adds `"types": ["node"]` + `@types/node` for `process.env["NODE_ENV"]` guards in core.

### D. Consumers & Release

- `apps/benchmarks`, `apps/docs`, `examples/next-showcase` (plus `next-analysis`) depend solely on `gigaboard: workspace:*`; imports rewritten `@gigaboard/core` → `gigaboard/core`, `@gigaboard/pieces/*` → `gigaboard/pieces/*`, `@gigaboard/themes/*` → `gigaboard/themes/*`.
- Root `workspaces: ["packages/*", "apps/*", "examples/*"]` unchanged (now resolves to single package).
- Release automation simplified to single package: `release-please-config.json` tracks only `packages/react` (`gigaboard`, component `gigaboard`); `.release-please-manifest.json` is `{"packages/react": "1.3.2"}`; `release.yml` publishes one provenance-enabled artifact.

### E. Breaking Change & Migration

`@gigaboard/core` → `gigaboard/core`, `@gigaboard/pieces/neo` → `gigaboard/pieces/neo`, `@gigaboard/themes/brown` → `gigaboard/themes/brown`. Runtime APIs (`<Chessboard>`, `createGigachessAdapter`, `BoardModel`) unchanged. Documented in `README.md` (single `bun add gigaboard` / `npm i gigaboard`) and `docs/MIGRATION.md`.

---

## 3. Consequences

- **Adoption:** One install, no org permissions, no version drift. `bun add gigaboard` suffices.
- **Performance:** Preserved — 1 commit/move, 0 commits/drag-frame, <16 KB gz interactive (size-limit: 24 KB root, 4 KB server, 10 KB core, 2 KB/set, 1 KB/theme). `gigaboard/core` verified React-free.
- **Accessibility:** Unchanged — WAI-ARIA grid, roving tabindex, LiveRegion SAN, `prefers-reduced-motion`.
- **Risk:** Existing `@gigaboard/*` imports break → mitigated via README migration table and release notes.
- **Risk:** Unintentional React in `gigaboard/core` → mitigated via size-limit + bundle grep.
- **Risk:** CSS/asset resolution in Next.js/Vite/Webpack → verified `gigaboard/themes/*` JS exports work across bundlers; MP3s still copied to `dist/sounds/`.
