## Purpose

Provides a first-class, accessible `BoardEditor` component in `gigaboard` with unified keyboard and pointer interactions, `role="application"` mode for screen readers (bypassing JAWS/NVDA virtual cursor conflicts on single-key piece shortcuts), orientation-aware cell navigation, and live announcements.

## Requirements

### Requirement: Screen Reader Application Mode and Accessible Labeling

The `BoardEditor` root container SHALL have `role="application"`, `tabIndex={0}`, a descriptive `aria-label`, and `aria-keyshortcuts` documenting available navigation and placement keys. It SHALL announce cursor movements, piece placements, removals, and board state changes via an assertive live region and optional `onAnnounce` callback.

#### Scenario: Container focus lands in application mode
- **WHEN** keyboard focus moves to the `BoardEditor`
- **THEN** screen readers enter application mode so single-key shortcuts (`p`, `P`, `k`, etc.) reach the board without triggering screen reader browse shortcuts.

#### Scenario: Visual focus indication
- **WHEN** the editor container is focused
- **THEN** a high-contrast focus ring (default amber `#d97706` / `var(--board-editor-focus, #d97706)`) is applied around the board.

### Requirement: Cell-by-Cell Keyboard Navigation

The editor SHALL allow navigating the 64 squares using Arrow keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`) as well as `Home` and `End` for row navigation. Navigation SHALL be aware of board orientation.

#### Scenario: Navigating up from e4 with White orientation
- **WHEN** current square is `e4` with orientation `white` and `ArrowUp` is pressed
- **THEN** the active square moves to `e5` and the square name and occupying piece are announced.

#### Scenario: Navigating up from e4 with Black orientation
- **WHEN** current square is `e4` with orientation `black` and `ArrowUp` is pressed
- **THEN** the active square moves to `e3`.

#### Scenario: Home and End keys
- **WHEN** `Home` is pressed on square `e4`
- **THEN** the cursor jumps to the first file of the rank (`a4`).
- **WHEN** `End` is pressed on square `e4`
- **THEN** the cursor jumps to the last file of the rank (`h4`).

### Requirement: Direct Piece Placement Shortcuts

While navigating squares, typing a case-sensitive piece shortcut (`p`, `P`, `n`, `N`, `b`, `B`, `r`, `R`, `q`, `Q`, `k`, `K`) SHALL place that piece on the active square. Uppercase SHALL represent White pieces; lowercase SHALL represent Black pieces. Pressing the key for the piece already occupying the square SHALL toggle it off (remove it).

#### Scenario: Place White King on e1
- **WHEN** active square is `e1` and user presses `K` (Shift+k)
- **THEN** a White King is placed on `e1`, `onChange` is called with updated placement and FEN, and "White King placed on e1" is announced.

#### Scenario: Toggle piece off by pressing its key again
- **WHEN** active square has a Black Pawn and user presses `p`
- **THEN** the Black Pawn is removed from the active square, leaving it empty.

### Requirement: Piece Removal Shortcuts

Pressing `Backspace`, `Delete`, `x`, or `X` on a square SHALL remove any piece occupying that square.

#### Scenario: Deleting piece with Backspace
- **WHEN** active square has a piece and user presses `Backspace`
- **THEN** the piece is removed, leaving the square empty, and "Cleared square" is announced.

#### Scenario: Deleting empty square
- **WHEN** active square is empty and user presses `Backspace`
- **THEN** "Square is already empty" is announced and no change occurs.

### Requirement: Palette Piece Placement and Global Actions

Pressing `Enter` or `Space` SHALL place the currently selected palette piece on the active square. Pressing `Shift+Enter` or `Shift+Space` SHALL place the opposite-color variant of the palette piece.
Global shortcut keys SHALL allow:
- `c` / `C`: Clear all pieces from the board.
- `s` / `S`: Reset board to initial standard chess setup.
- `t` / `T`: Toggle side to move between White and Black.

#### Scenario: Clear board
- **WHEN** user presses `c`
- **THEN** all pieces are cleared, FEN is updated to empty board (`8/8/8/8/8/8/8/8`), and "Board cleared" is announced.

#### Scenario: Reset starting setup
- **WHEN** user presses `s`
- **THEN** all pieces reset to the standard initial position and "Reset to starting position" is announced.

### Requirement: Visual Active Square Focus Indicator and Container Props

The `BoardEditor` SHALL accept optional `id`, `onFocus`, and `onBlur` properties. When the board container has active focus, it SHALL render a dedicated visual square focus indicator overlay (`data-gb-editor-focus-square`) at the active square, ensuring sighted keyboard users can visually track which square they are navigating and placing pieces on.

#### Scenario: Visual square indicator moves with keyboard focus
- **WHEN** the board editor has keyboard focus
- **THEN** a high-contrast focus indicator overlay is visible around the active square and moves with arrow key navigation.
- **WHEN** the board editor loses focus
- **THEN** the active square focus indicator overlay is hidden.

