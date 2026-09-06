## Why

Currently, `gigaboard` themes only configure solid square background colors (`--gb-sq-light`, `--gb-sq-dark`) because `<Square />` renders with hardcoded inline style `backgroundColor: var(...)`. As a result, patterned and textured boards (such as Lichess's diagonal-striped Newspaper theme or BlindBase's grain-textured Espresso / Café Crème themes) cannot be represented as pure theme objects and require downstream consumers to write fragile external CSS overrides with `!important` targeting internal `[data-gb-square]` selectors.

Furthermore, low-vision and high-contrast accessibility workflows frequently require distinct outline filters (e.g. `drop-shadow(...)`) around pieces so they pop against both light and dark squares, which `gigaboard` currently lacks first-class support for in its `PieceLayer` and `DragLayer`.

Finally, `gigaboard/themes` currently only ships 4 basic solid themes (`green`, `brown`, `blue`, `wood`). Expanding this catalog to 20+ battle-tested themes from major chess workstations (including textured and accessible colorblind palettes) will make `gigaboard` a batteries-included, drop-in chessboard for any modern chess workstation or website.

## What Changes

- **Native Square Background Textures & Gradients**:
  - Add CSS custom properties to `CSS_VARS`:
    - `SQ_LIGHT_IMAGE: "--gb-sq-light-image"`
    - `SQ_DARK_IMAGE: "--gb-sq-dark-image"`
    - `SQ_IMAGE_SIZE: "--gb-sq-image-size"`
    - `SQ_BLEND_MODE: "--gb-sq-blend-mode"`
  - Update `<Square />` and `<StaticChessboard />` to layer `backgroundImage`, `backgroundSize`, and `backgroundBlendMode` without interfering with selection (`::before`) or last-move (`::after`) pseudo-elements.
- **Native Piece Accessibility Outlines & Filters**:
  - Add CSS custom properties to `CSS_VARS`:
    - `PIECE_FILTER_WHITE: "--gb-piece-filter-white"`
    - `PIECE_FILTER_BLACK: "--gb-piece-filter-black"`
  - Update `PieceLayer`, `DragLayer`, and `StaticChessboard` piece containers/images to apply `filter: var(--gb-piece-filter-white, none)` and `filter: var(--gb-piece-filter-black, none)`.
- **Expanded Built-in Theme Catalog in `gigaboard/themes/*`**:
  - Add textured themes: `newspaper`, `espresso`, `cafeCreme`.
  - Add tactile & material themes: `canvas`, `leather`, `marble`, `walnut`, `darkWood`.
  - Add modern & high-contrast themes: `neon`, `olive`, `pink`, `purple`, `ic`, `highContrast`, `chesscomGreen`, `chesscomBlue`.
  - Add accessible color-vision deficiency themes: `deuteranopia`, `tritanopia`.
  - All themes remain lightweight zero-runtime objects maintaining <300 B/theme bundle budget.

## Capabilities

### New Capabilities
- `theme-textures-and-a11y-filters`: Native CSS custom properties for square textures, gradients, and blend modes; piece outline/drop-shadow filter variables for low-vision accessibility; and an expanded catalog of 20+ themes exported from `gigaboard/themes/*`.

### Modified Capabilities
<!-- No requirement changes to existing move generation, bitboard engine adapters, or roving tabindex -->

## Impact

- **Affected Code**:
  - `packages/react/src/default-theme.ts` (CSS_VARS additions)
  - `packages/react/src/components/square.tsx` (background-image / size / blend-mode layering)
  - `packages/react/src/components/piece-layer.tsx` and `drag-layer.tsx` (piece filter styling)
  - `packages/react/src/server.tsx` (SSR parity for square textures and piece filters)
  - `packages/react/src/themes/*` (new theme definitions and index exports)
- **APIs**: Backwards-compatible additive CSS variable API. Existing themes and custom theme objects continue to work without modification.
- **Performance**: Zero React commits during theme switching; square textures and piece filters are resolved directly by browser layout/paint engines with 0ms script overhead.
- **Accessibility**: First-class support for high-contrast piece drop-shadows and colorblind-friendly board themes without external stylesheet hacks.
