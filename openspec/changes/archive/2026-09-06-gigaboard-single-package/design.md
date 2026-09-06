## Context

Gigaboard currently splits its codebase across four packages in `packages/*`: `gigaboard` (React UI), `@gigaboard/core` (headless models and engine adapter), `@gigaboard/pieces` (SVG piece sets), and `@gigaboard/themes` (CSS custom property themes). While this provided physical package boundary separation, it imposes severe overhead:
1. Consumers must install up to 4 packages (`npm i gigaboard @gigaboard/core @gigaboard/pieces @gigaboard/themes`).
2. Requiring `@gigaboard` scope on npm necessitates managing npm organization membership and permissions.
3. Multi-package versioning in release-please requires coordinated bump workflows and creates potential version mismatch bugs for consumers.
4. Modern Node/bundler package exports (`exports` field with subpaths) solve physical code splitting and tree-shaking with zero runtime overhead.

See `proposal.md` for motivation and ADR 018 for recent branding context.

## Goals / Non-Goals

**Goals:**
- Consolidate all code under the single `gigaboard` npm package.
- Provide clean subpath exports: `gigaboard`, `gigaboard/core`, `gigaboard/server`, `gigaboard/pieces/*`, `gigaboard/themes/*`.
- Ensure zero bundle pollution: importing `gigaboard/core` must not bundle React or DOM APIs; importing `gigaboard/pieces/neo` must not bundle other piece sets.
- Maintain identical public APIs (`<Chessboard>`, `createGigachessAdapter`, `BoardModel`, etc.).
- Update all consumers in the monorepo (`apps/docs`, `apps/benchmarks`, `examples/next-showcase`).
- Simplify CI release workflow to publish only `gigaboard`.

**Non-Goals:**
- Breaking public TypeScript types or runtime component interfaces (only the import specifiers change).
- Moving outside the monorepo structure (monorepo is retained for `apps/docs`, `apps/benchmarks`, `examples/next-showcase`).
- Changing engine bitboard or move2 implementation.

## Decisions

### Decision 1: Subpath Exports via `exports` Map
Use modern standard package `exports` in `gigaboard/package.json`:
- `.` → `dist/index.{js,mjs,d.ts}` (React interactive `<Chessboard />`, hooks)
- `./core` → `dist/core.{js,mjs,d.ts}` (headless `BoardModel`, `BoardStore`, `createGigachessAdapter`, Move2 bitfields)
- `./server` → `dist/server.{js,mjs,d.ts}` (React Server Component static board)
- `./pieces/*` → `dist/pieces/*.{js,mjs,d.ts}` (individual piece set renderers)
- `./themes/*` → `dist/themes/*` (CSS stylesheets and definitions)

*Alternative considered:* Single barrel export `import { Chessboard, createGigachessAdapter } from 'gigaboard'`.
*Rejected because:* Importing `gigaboard` in Node/SSR would load React DOM hooks; bundling all piece SVGs into the main entry would explode the <16KB gz bundle budget. Subpaths provide strict boundary isolation.

### Decision 2: Source Code Directory Organization
Consolidate sources inside the main package (`packages/react` renamed or treated as `packages/gigaboard`):
```
packages/react/src/
├── index.ts               # Root export (Chessboard, hooks, types)
├── core/                  # Former @gigaboard/core (BoardModel, gigachess adapter, move2)
├── server/                # Former gigaboard/server (StaticChessboard)
├── pieces/                # Former @gigaboard/pieces (neo, cburnett, merida, etc.)
└── themes/                # Former @gigaboard/themes (green, brown, blue, etc.)
```
Remove `packages/core`, `packages/pieces`, and `packages/themes`.

*Alternative considered:* Keeping `packages/core` as an internal workspace-only package unbundled.
*Rejected because:* Single package source tree simplifies build pipelines, TypeScript project references, and eliminates internal symlink issues.

### Decision 3: Multi-Entry Build with `tsup`
Configure `tsup.config.ts` to output all subpath entrypoints with dedicated DTS generation:
- `entry: { index: 'src/index.ts', core: 'src/core/index.ts', server: 'src/server/index.ts', 'pieces/neo': 'src/pieces/neo.ts', ... }`
- Clean dist output with ESM and CJS bundles, plus CSS asset copying.

### Decision 4: Single Package Release Automation
Simplify `.github/workflows/release.yml` and release configs:
- Remove multi-package release loops and `@gigaboard/*` publishing.
- Publish `gigaboard` in a single provenance-enabled job.

## Risks / Trade-offs

- **[Risk] Consumer Breaking Change**: Existing imports from `@gigaboard/core` or `@gigaboard/pieces` break.
  → *Mitigation:* Document migration in README and release notes (`@gigaboard/core` → `gigaboard/core`, `@gigaboard/pieces/neo` → `gigaboard/pieces/neo`).
- **[Risk] Unintentional React inclusion in `gigaboard/core`**:
  → *Mitigation:* Automated size-limit check and bundle analyzer verifying that `gigaboard/core` contains zero references to `react` or `react-dom`.
- **[Risk] CSS Asset Resolution in Next.js / bundlers**:
  → *Mitigation:* Verify `gigaboard/themes/*.css` exports work across Vite, Webpack 5, and Next.js Turbopack.
