## Purpose

Enables native textured, patterned, and gradient chess squares via CSS custom properties, independent white and black piece outline/drop-shadow filters for low-vision accessibility, and an expanded zero-runtime theme catalog exported from `gigaboard/themes/*`.

## Requirements

### Requirement: Native Square Background Textures and Blend Modes
The board rendering components (`Chessboard` and `StaticChessboard`) SHALL support native image patterns, linear/radial gradients, and blend modes on squares via CSS custom properties `--gb-sq-light-image`, `--gb-sq-dark-image`, `--gb-sq-image-size`, and `--gb-sq-blend-mode`.

#### Scenario: Applying textured square pattern
- **WHEN** `--gb-sq-light-image` or `--gb-sq-dark-image` is defined on a board theme
- **THEN** the square element renders `backgroundImage`, `backgroundSize`, and `backgroundBlendMode` without disrupting the underlying `backgroundColor` fallback

#### Scenario: Selection and last-move overlay preservation on textured squares
- **WHEN** a square with a textured background pattern is selected or marked as a last-move square
- **THEN** the selection (`::before`) and last-move (`::after`) pseudo-elements render above the square background texture with their specified opacity and accent colors intact

### Requirement: Piece Accessibility Outlines and Filters
The board piece rendering components (`PieceLayer`, `DragLayer`, and `StaticChessboard`) SHALL support independent piece outline and filter effects via CSS custom properties `--gb-piece-filter-white` and `--gb-piece-filter-black`.

#### Scenario: Applying high-contrast drop-shadow to pieces
- **WHEN** a theme or accessibility mode sets `--gb-piece-filter-white` or `--gb-piece-filter-black` to a CSS filter (such as `drop-shadow(0 0 2px rgba(0,0,0,0.8))`)
- **THEN** white pieces and black pieces apply their respective filters to piece container images without altering piece layout or bounding boxes

#### Scenario: Preserving filter styling during piece drag
- **WHEN** a user begins dragging a piece on a board with custom piece filters configured
- **THEN** the dragged piece representation in `DragLayer` inherits the matching `--gb-piece-filter-white` or `--gb-piece-filter-black` filter during the drag interaction

### Requirement: Expanded Built-in Theme Catalog
The package SHALL provide individual zero-runtime theme definitions and stylesheets from `gigaboard/themes/<theme>` covering at least 20 chess workstation and accessible themes, including:
- Textured & patterned themes: `newspaper`, `espresso`, `cafeCreme`
- Tactile & material themes: `canvas`, `leather`, `marble`, `walnut`, `darkWood`
- Modern & high-contrast themes: `neon`, `olive`, `pink`, `purple`, `ic`, `highContrast`, `chesscomGreen`, `chesscomBlue`
- Color-vision deficiency themes: `deuteranopia`, `tritanopia`
- Classic solid themes: `green`, `brown`, `blue`, `wood`

#### Scenario: Importing an accessible colorblind theme
- **WHEN** a consumer imports `deuteranopia` or `tritanopia` from `gigaboard/themes/*`
- **THEN** high-contrast square colors and piece filter variables tuned for color vision deficiencies are loaded with a bundle cost of under 350 bytes

#### Scenario: Importing a textured newspaper theme
- **WHEN** a consumer imports `newspaper` from `gigaboard/themes/newspaper`
- **THEN** striped SVG data-URI patterns for light and dark squares are loaded via CSS custom properties without requiring external CSS overrides

### Requirement: Accessibility and Screen Reader Invariance
The board SHALL maintain full keyboard navigation (roving tabindex, arrow navigation, Enter/Space selection) and screen reader LiveRegion SAN announcements regardless of active square textures, piece filters, or theme selection.

#### Scenario: Keyboard navigation on textured high-contrast board
- **WHEN** a user navigates a board utilizing textured squares and high-contrast piece filters using keyboard arrow keys
- **THEN** roving tabindex focus moves cleanly across squares and the ARIA live region announces square coordinates and piece contents accurately

#### Scenario: Screen reader move announcement under custom theme
- **WHEN** a move is played on any custom or built-in theme
- **THEN** the live region announces the move notation in the user's active locale without any visual or CSS variable interference
