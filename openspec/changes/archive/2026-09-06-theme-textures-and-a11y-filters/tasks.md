## 1. CSS Variable Tokens and Type Definitions

- [x] 1.1 Add new CSS custom properties (`SQ_LIGHT_IMAGE`, `SQ_DARK_IMAGE`, `SQ_IMAGE_SIZE`, `SQ_BLEND_MODE`, `PIECE_FILTER_WHITE`, `PIECE_FILTER_BLACK`) to `CSS_VARS` in `packages/react/src/default-theme.ts` and verify with TypeScript compilation.

## 2. Square Background Layering (Interactive & Static)

- [x] 2.1 Update `<Square />` in `packages/react/src/components/square.tsx` to layer `backgroundImage`, `backgroundSize`, and `backgroundBlendMode` variables and verify selection/last-move pseudo-elements remain visible on top of textured backgrounds.
- [x] 2.2 Update `<StaticChessboard />` in `packages/react/src/server.tsx` to match `<Square />` square texture styles for SSR hydration parity.

## 3. Piece Filter Application across Layers

- [x] 3.1 Apply piece filter CSS variables (`--gb-piece-filter-white`, `--gb-piece-filter-black`) to `PieceSlot` in `packages/react/src/components/piece-layer.tsx` and `StaticPieceLayer` in `packages/react/src/components/static-piece-layer.tsx`.
- [x] 3.2 Apply piece filter CSS variables to drag ghost slots in `packages/react/src/components/drag-layer.tsx` and static piece slots in `packages/react/src/server.tsx`.

## 4. Built-in Theme Catalog Expansion

- [x] 4.1 Create textured and patterned themes (`newspaper`, `espresso`, `cafeCreme`) in `packages/react/src/themes/` with embedded SVG patterns and verify valid CSS variable outputs.
- [x] 4.2 Create tactile and material themes (`canvas`, `leather`, `marble`, `walnut`, `darkWood`) in `packages/react/src/themes/` and verify valid CSS variable outputs.
- [x] 4.3 Create modern, high-contrast, and colorblind themes (`neon`, `olive`, `pink`, `purple`, `ic`, `highContrast`, `chesscomGreen`, `chesscomBlue`, `deuteranopia`, `tritanopia`) in `packages/react/src/themes/`.
- [x] 4.4 Update `packages/react/src/themes/index.ts` to export all 21 themes, update `package.json` subpath exports, and verify module resolution.

## 5. Automated Testing and Verification

- [x] 5.1 Add unit tests in `packages/react/test/themes.test.ts` verifying all 21 theme objects define valid CSS variables, SVG patterns render properly, and bundle size constraints (<350 bytes/theme) are respected.
- [x] 5.2 Add component tests in `packages/react/test/square-textures.test.tsx` verifying square texture inline styles and piece filter application in both client and SSR modes.
- [x] 5.3 Run full verification suite (`bun test`, `bun run build`, and typecheck) and ensure zero regressions across performance and accessibility standards.
