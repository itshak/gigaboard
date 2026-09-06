## Why

Managing 4 separate packages (`gigaboard`, `@gigaboard/core`, `@gigaboard/pieces`, `@gigaboard/themes`) introduces high developer friction (installing multiple packages, managing `@gigaboard` org permissions on npm, version drift) with zero bundle size benefit over modern package `exports` subpaths. Consolidating into a single `gigaboard` package with clean subpath exports (`gigaboard`, `gigaboard/core`, `gigaboard/server`, `gigaboard/pieces/*`, `gigaboard/themes/*`) streamlines adoption, publication, and consumption while maintaining strict tree-shaking and zero-DOM headless execution.

## What Changes

- **Consolidate Multi-Package Monorepo into Unified Package**: Merge `@gigaboard/core`, `@gigaboard/pieces`, and `@gigaboard/themes` directly into the `gigaboard` package.
- **Export Subpaths (`package.json` `exports`)**:
  - `gigaboard`: React interactive chessboard `<Chessboard />`, hooks (`useChessGame`, `useAnimation`, `useDrag`, `useArrowGesture`), and interactive types.
  - `gigaboard/core`: Headless model, store, Move2 bitfields, and engine adapter (`createGigachessAdapter`, `BoardModel`, `BoardStore`) without React or DOM dependencies.
  - `gigaboard/server`: React Server Component static board `<StaticChessboard />` for zero-JS SSR.
  - `gigaboard/pieces/*`: Individual SVG piece sets (`neo`, `cburnett`, `merida`, `alpha`, `chesscom`) maintaining ~660 B/set budget.
  - `gigaboard/themes/*`: Zero-runtime CSS themes (`green`, `brown`, `blue`, `wood`) maintaining ~205 B/theme budget.
- **BREAKING**: Replaces external package imports `@gigaboard/core`, `@gigaboard/pieces/*`, and `@gigaboard/themes/*` with `gigaboard/core`, `gigaboard/pieces/*`, and `gigaboard/themes/*`.
- **Single-Artifact CI & Publishing**: Replaces 4-package release matrix with single `gigaboard` publish pipeline, eliminating npm organization ownership prerequisites.
- **Simplify Monorepo Workspaces**: Apps (`docs`, `benchmarks`, `examples/next-showcase`) depend solely on `gigaboard` with workspace protocol.

## Capabilities

### New Capabilities
- `gigaboard-single-package`: Unified single package distribution providing standard subpath exports for React, headless core, server static board, piece sets, and themes with strict isolation and tree-shaking guarantees.

### Modified Capabilities
<!-- No requirement changes to existing engine adapter or move2 rules -->

## Impact

- **Affected Code**: `packages/react` (becomes consolidated root package `gigaboard`), `packages/core`, `packages/pieces`, `packages/themes` (sources consolidated into `packages/react/src` submodules or top-level package source).
- **APIs**: Import paths change from `@gigaboard/*` to `gigaboard/*`. Runtime API signatures (`<Chessboard>`, `createGigachessAdapter`, `BoardModel`) remain unchanged.
- **Dependencies**: Drops inter-package dependencies; consumers only run `npm install gigaboard` (or `bun add gigaboard`).
- **Release Automation**: `.github/workflows/release.yml`, `.github/release-please-config.json`, and `.release-please-manifest.json` simplified from multi-package tracking to single package.
- **Accessibility & Performance**: Preserves WAI-ARIA grid, keyboard navigation, LiveRegion SAN announcements, 1 commit/move, 0 commits/drag-frame, and <16KB gz bundle budget.
