## 1. Source Consolidation

- [x] 1.1 Migrate `@gigaboard/core` source into `packages/react/src/core` and verify source files and unit tests are intact
- [x] 1.2 Migrate `@gigaboard/pieces` source and assets into `packages/react/src/pieces`
- [x] 1.3 Migrate `@gigaboard/themes` CSS stylesheets into `packages/react/src/themes`
- [x] 1.4 Remove deprecated package directories (`packages/core`, `packages/pieces`, `packages/themes`)

## 2. Package Build & Subpath Exports

- [x] 2.1 Update `packages/react/package.json` with subpath `exports` map for `.`, `./core`, `./server`, `./pieces/*`, and `./themes/*`
- [x] 2.2 Configure `packages/react/tsup.config.ts` to build multi-entry subpaths (root, core, server, pieces, themes) emitting ESM, CJS, and `.d.ts` declaration maps
- [x] 2.3 Run `bun run build` in `packages/react` and verify all dist bundles and typings are successfully generated

## 3. Monorepo Consumers & Workspaces Migration

- [x] 3.1 Update `apps/benchmarks` imports and dependencies to use `gigaboard` and `gigaboard/core`
- [x] 3.2 Update `apps/docs` imports and dependencies to use `gigaboard` subpaths (`gigaboard/pieces/*`, `gigaboard/themes/*`)
- [x] 3.3 Update `examples/next-showcase` imports and dependencies to use `gigaboard` subpaths
- [x] 3.4 Update root workspace configuration (`package.json`, `turbo.json`, and `.size-limit.json`)

## 4. Release Automation & Documentation

- [x] 4.1 Update `.github/workflows/release.yml`, `.github/release-please-config.json`, and `.release-please-manifest.json` for single-package publishing
- [x] 4.2 Update `README.md` and documentation examples to reflect single-package installation (`bun add gigaboard` / `npm i gigaboard`) and subpath imports
- [x] 4.3 Create ADR `openspec/adr/019-gigaboard-single-package-consolidation.md` documenting the subpath architecture and monorepo consolidation decisions

## 5. Verification & Performance Budgets

- [x] 5.1 Run `bun run typecheck` across all packages and apps to verify zero TypeScript errors
- [x] 5.2 Run `bun run lint` and `bun run test` to verify all headless engine adapter, Move2, and component test suites pass
- [x] 5.3 Run `bun run size` to verify the root bundle remains <16KB gz and isolated subpaths maintain strict tree-shaking
