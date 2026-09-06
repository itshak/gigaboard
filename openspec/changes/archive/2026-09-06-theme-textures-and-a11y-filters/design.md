## Context

See `proposal.md` for motivation and background.

Gigaboard's visual styling is configured via CSS custom properties injected onto the board container element. The board relies on strict zero-reconciliation performance invariants:
1. `Square` mounts once and re-renders only when roving tabindex (`isFocused`) flips. Selection (`::before`) and last-move highlights (`::after`) are applied imperatively via data attributes and injected pseudo-element CSS.
2. `PieceLayer` mounts 64 slots, each subscribing to a single byte of the board model.
3. `DragLayer` pre-materializes 12 piece slots at mount and toggles visibility via GPU-accelerated opacity and `transform: translate3d(...)` (0 React re-renders per drag frame).
4. `StaticChessboard` in `gigaboard/server` renders pure HTML/CSS without client JavaScript.

All themes in `gigaboard/themes/*` are zero-runtime TypeScript objects containing CSS variable key-value pairs (`Readonly<Record<string, string>>`) with an independent tree-shaking budget (<350 bytes per theme).

## Goals / Non-Goals

**Goals:**
- Provide native CSS custom property tokens for square textures, gradients, image sizes, and blend modes without external stylesheet hacks.
- Provide native CSS custom property tokens for independent white and black piece filters (drop-shadows, outlines) to support low-vision and high-contrast accessibility.
- Preserve 100% compatibility with selection (`::before`) and last-move (`::after`) pseudo-element overlays.
- Maintain identical visual rendering and CSS variable parity across both interactive client boards (`Chessboard`) and server-rendered static boards (`StaticChessboard`).
- Expand the built-in theme catalog in `gigaboard/themes/*` from 4 to 21 themes (including textured, tactile, modern, and colorblind-accessible palettes).
- Maintain performance constraints: 0 React re-renders during drag, 1 commit per move, zero layout reflows on theme switches, and <16KB gzip interactive bundle.

**Non-Goals:**
- External raster image asset loading: We will not load external PNG/JPG textures over HTTP. Textured patterns (e.g. newspaper diagonal hatching) will use lightweight inline SVG data URIs so themes remain completely self-contained and offline-ready.
- Dynamic theme editing UI: Gigaboard provides the theme tokens, types, and theme objects; downstream consumer applications provide any user-facing theme selection menus or color pickers.
- Changing board geometry or piece SVG glyphs: Piece sets remain isolated under `gigaboard/pieces/*`.

## Decisions

### Decision 1: Token Architecture in `CSS_VARS`
We add six new CSS custom properties to `CSS_VARS` in `packages/react/src/default-theme.ts`:
- `SQ_LIGHT_IMAGE`: `"--gb-sq-light-image"`
- `SQ_DARK_IMAGE`: `"--gb-sq-dark-image"`
- `SQ_IMAGE_SIZE`: `"--gb-sq-image-size"`
- `SQ_BLEND_MODE`: `"--gb-sq-blend-mode"`
- `PIECE_FILTER_WHITE`: `"--gb-piece-filter-white"`
- `PIECE_FILTER_BLACK`: `"--gb-piece-filter-black"`

**Rationale**:
Using standard CSS custom properties allows themes, parent CSS classes, or inline styles to configure textures and piece filters uniformly. If a variable is not specified by a theme, CSS fallback defaults (`none`, `cover`, `normal`) ensure zero overhead or visual regression.

**Alternatives considered**:
- *Component props like `lightImage` / `darkImage`*: Rejected because passing image URLs as props breaks zero-runtime theming, requires prop drilling through `BoardGrid`, and forces React reconciliation when switching themes.
- *Single `--gb-piece-filter` for both colors*: Rejected because white pieces and black pieces require different contrast outlines against light and dark squares (e.g., dark drop-shadow for white pieces, bright drop-shadow for black pieces).

### Decision 2: Pure CSS Layering on `<Square />` and `<StaticChessboard />`
In `packages/react/src/components/square.tsx` and `packages/react/src/server.tsx`, square inline styling is updated from:
```tsx
backgroundColor: `var(${isLight ? CSS_VARS.SQ_LIGHT : CSS_VARS.SQ_DARK})`
```
to:
```tsx
backgroundColor: `var(${isLight ? CSS_VARS.SQ_LIGHT : CSS_VARS.SQ_DARK})`,
backgroundImage: `var(${isLight ? CSS_VARS.SQ_LIGHT_IMAGE : CSS_VARS.SQ_DARK_IMAGE}, none)`,
backgroundSize: `var(${CSS_VARS.SQ_IMAGE_SIZE}, cover)`,
backgroundBlendMode: `var(${CSS_VARS.SQ_BLEND_MODE}, normal)`
```

**Rationale**:
The CSS background painting order renders `backgroundColor` as the base layer, followed by `backgroundImage` blended using `backgroundBlendMode`. Selection highlights (`::before`) and last-move tints (`::after`) are painted as absolutely positioned pseudo-elements above the square's background. Thus, textures and gradients sit directly under the highlights without interfering with selection visibility or INP-optimized pre-materialized pseudo-elements.

**Alternatives considered**:
- *Adding a separate `<div className="gb-texture" />` child inside each square*: Rejected because it adds 64 additional DOM nodes to the board grid, increases mount time, and degrades hydration performance.

### Decision 3: Inline SVG Data URIs for Patterns and Textures
Textured themes such as `newspaper` will embed minimal, URL-encoded SVG patterns directly in the CSS variable string (e.g., `url("data:image/svg+xml,...")`).

**Rationale**:
Inline SVG data URIs require no network requests, no bundler asset loaders, and work identically in SSR (`gigaboard/server`), client SPAs, and offline environments. A striped hatching pattern in SVG takes under 150 bytes.

**Alternatives considered**:
- *Bundled raster PNGs*: Rejected due to file size, resolution scaling issues on Retina displays, and asset path configuration issues in different bundlers.

### Decision 4: Piece Filter Application in `PieceLayer`, `DragLayer`, and `StaticChessboard`
In `packages/react/src/components/piece-layer.tsx`:
```tsx
filter: `var(${cell <= 6 ? CSS_VARS.PIECE_FILTER_WHITE : CSS_VARS.PIECE_FILTER_BLACK}, none)`
```
The same filter expression is applied to each pre-materialized slot in `packages/react/src/components/drag-layer.tsx` and each piece container in `packages/react/src/components/static-piece-layer.tsx` and `packages/react/src/server.tsx`.

**Rationale**:
Applying `filter` at the slot wrapper level ensures that custom drop-shadows and outline filters follow the piece throughout all interactions, including drag-and-drop operations, without modifying individual piece SVG definitions.

**Alternatives considered**:
- *Embedding drop-shadow filters inside the piece SVG files*: Rejected because piece sets (`gigaboard/pieces/*`) are independent of board themes and should not have hardcoded board contrast assumptions.

### Decision 5: Catalog Standardization to 21 Themes
We expand `packages/react/src/themes/` to include:
1. `blue` (classic blue/slate)
2. `brown` (classic wood-brown)
3. `green` (chess.com green/cream)
4. `wood` (warm wood grain tones)
5. `espresso` (warm cream & deep roast coffee)
6. `cafeCreme` (soft latte & roasted almond)
7. `newspaper` (high-contrast monochrome with diagonal hatching)
8. `canvas` (warm textured linen/cloth tone)
9. `leather` (rich tan/saddle leather)
10. `marble` (cool stone grey & veined slate)
11. `walnut` (deep American walnut)
12. `darkWood` (ebony & dark mahogany)
13. `neon` (cyberpunk electric cyan & deep navy)
14. `olive` (sage & muted olive)
15. `pink` (soft pastel rose & crimson)
16. `purple` (lavender & deep royal violet)
17. `ic` (cold icy grey & steel)
18. `highContrast` (pure black & white with maximum piece outline)
19. `chesscomGreen` (exact chess.com web palette)
20. `chesscomBlue` (exact chess.com blue palette)
21. `deuteranopia` / `tritanopia` (scientifically tuned colorblind contrast palettes)

All themes are exported individually (`gigaboard/themes/<name>`) and in the root index registry `themes`.

## Risks / Trade-offs

- **[Risk] Complex SVG data-URIs could bloat theme bundles**
  → *Mitigation*: Keep SVG patterns geometric, minimal, and optimized (e.g. repeated 8x8 or 16x16 SVG patterns). Ensure every theme stays under 350 bytes gzipped.
- **[Risk] CSS filters on 32 pieces might impact paint performance during rapid animations**
  → *Mitigation*: `drop-shadow` filters applied to static piece slots are hardware-accelerated. In `DragLayer`, only the active ghost slot is transformed using `translate3d`, avoiding multi-element filter repaints during drags.
- **[Risk] Background images might break high contrast mode in Windows OS accessibility settings**
  → *Mitigation*: We preserve `backgroundColor` as the base fallback behind all `backgroundImage` definitions, ensuring Windows High Contrast mode media queries still see valid semantic square colors.
