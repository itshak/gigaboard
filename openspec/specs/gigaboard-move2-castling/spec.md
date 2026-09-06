## Purpose

Provides native 16-bit Move2 binary wire format encoding, dual-input castling interaction (2-square jump or King-on-Rook), canonical King-captures-Rook event emission, and drag-release selection retention for hybrid click/drag move entry.

## Requirements

### Requirement: Board SHALL Support Dual-Input Interaction for Castling

The chessboard component SHALL accept two interaction forms for castling:
1. Dragging or clicking the King to its standard two-square landing destination (`e1 → g1` or `e1 → c1` for White; `e8 → g8` or `e8 → c8` for Black).
2. Dragging or clicking the King directly onto the castling Rook's square (`e1 → h1` or `e1 → a1` for White; `e8 → h8` or `e8 → a8` for Black, and corresponding Rook squares in Chess960).

#### Scenario: User castles by moving King 2 squares
- **WHEN** the user drags or clicks White King from `e1` to `g1` with castling rights available and empty transit squares
- **THEN** the move is accepted as legal kingside castling

#### Scenario: User castles by moving King onto Rook
- **WHEN** the user drags or clicks White King from `e1` onto the Rook on `h1` with castling rights available and empty transit squares
- **THEN** the move is accepted as legal kingside castling

### Requirement: Board SHALL Record and Emit All Castling as King-Captures-Rook

Regardless of whether the user executed castling via the two-square jump or King-onto-Rook gesture, the board state machine, history, and `onMove` callback SHALL ALWAYS record and emit the move in canonical King-captures-Rook notation (`e1h1`, `e1a1`, `e8h8`, `e8a8` / `Move2` `from = 4, to = 7`).

#### Scenario: Canonical move emission from 2-square gesture
- **WHEN** the user initiates kingside castling by dropping King on `g1`
- **THEN** `onMove` receives the canonical move where source is `e1` and destination is `h1` (`e1h1` / `from=4, to=7`)

#### Scenario: Canonical move emission from King-onto-Rook gesture
- **WHEN** the user initiates queenside castling by dropping King on `a1`
- **THEN** `onMove` receives the canonical move where source is `e1` and destination is `a1` (`e1a1` / `from=4, to=0`)

### Requirement: Board SHALL Support Full Click-to-Move and Retain Selection on Drag Abort

The chessboard component SHALL support click-to-move (click source square, then click destination square to move). Furthermore, when a user starts dragging a piece and releases it back onto its origin square (or on an invalid square without completing a move), the source square SHALL remain selected so the user can immediately click a destination square to complete the move.

#### Scenario: Click source and click target to move
- **WHEN** user clicks piece on `e2` and subsequently clicks `e4`
- **THEN** `e2` is selected on first click and move `e2 → e4` is executed on second click

#### Scenario: Drag release on origin retains selection
- **WHEN** user picks up piece on `e2`, drags it, and drops it back on `e2` (or releases on an illegal square)
- **THEN** the piece on `e2` remains selected with legal target highlights active, allowing an immediate click on a target square to execute the move

### Requirement: Compositor Animation SHALL Smoothly Coordinate King and Rook Glides

When castling is triggered by either gesture, the animation planner SHALL output a `castle` descriptor with `kingFrom`, `kingTo` (normalized landing square `g1`/`c1`), `rookFrom`, and `rookTo` (normalized landing square `f1`/`d1`), and execute simultaneous WAAPI compositor glides for both pieces.

#### Scenario: Visual glide for kingside castling
- **WHEN** kingside castling is committed
- **THEN** King animates from `e1` to `g1` and Rook animates from `h1` to `f1` on the compositor thread with zero React re-renders

### Requirement: Move Representation SHALL Conform to 16-bit Move2 Wire Format

All packed moves stored in the model history, undo/redo stacks, and emitted by the engine SHALL conform to the 16-bit `Move2` binary format:
- Bits 0..5: `from` square index (0..63)
- Bits 6..11: `to` square index (0..63)
- Bits 12..15: promotion code (0=none, 1=Knight, 2=Bishop, 3=Rook, 4=Queen)

#### Scenario: Packed move roundtrip
- **WHEN** a pawn promotion move `e7 → e8=Q` is committed
- **THEN** the move is encoded as a 16-bit word with `from=52`, `to=60`, and `promo=4`

### Requirement: Promotion Overlay SHALL Support Keyboard Navigation, Focus Management, and Speech Announcements

The built-in `PromotionOverlay` SHALL be fully navigable via keyboard arrow keys (`ArrowDown`/`ArrowRight` for next piece, `ArrowUp`/`ArrowLeft` for previous piece, `Home`/`End` for first/last piece), auto-focus the primary promotion option on open, announce active piece choices via `aria-live`, support custom/localized piece label providers, and allow direct selection via Enter/Space or shortcut keys (Q, N, R, B) and cancellation via Escape.

#### Scenario: Arrow navigation and piece announcement in promotion overlay
- **WHEN** the promotion dialog opens
- **THEN** focus is placed on the first option (Queen) and the piece is announced to the screen reader
- **WHEN** user presses `ArrowDown`
- **THEN** focus shifts to the next option (Knight) and the piece name is announced

#### Scenario: Localized piece label customization
- **WHEN** `getPromotionPieceAriaLabel` is provided (e.g., Russian, Hebrew, or custom descriptive text)
- **THEN** screen reader labels and announcements use the custom strings provided by the consumer

### Requirement: Board SHALL Support Custom Square Accessibility Labels and Focus Notifications

The chessboard component SHALL provide optional `getSquareAriaLabel` and `onSquareFocus` callbacks, allowing consumers to override default square speech strings with localized descriptions (e.g., BlindBase language and gender-aware piece adjectives) and stream focus changes directly into external screen-reader announcement queues.

#### Scenario: Custom square speech string for screen reader
- **WHEN** keyboard focus lands on square `e4` with White Pawn
- **THEN** `getSquareAriaLabel` is consulted and the square renders with the consumer's localized speech text
