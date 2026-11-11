# confirmed-position-move-feedback Specification

## Purpose

Provide exactly one host-confirmed, correctly classified semantic move cue for controlled and interactive chessboards, independently of managed arrow visuals and input modality.

## Requirements

### Requirement: Arrow-independent host-confirmed move sounds

When `sound.trigger="position"`, GigaBoard SHALL emit exactly one semantic move cue for an accepted host-controlled single-ply move, including when the local model already holds the accepted FEN. The presence, emptiness, identity, or contents of `managedArrows` SHALL NOT determine whether that cue is emitted.

#### Scenario: Already-applied local move with an arrow array
- **WHEN** `game.tryMove` succeeds and the host later publishes the resulting `positionFen` with `managedArrows=[]` or a non-empty array
- **THEN** GigaBoard invokes `onCue` exactly once with the correct move-kind key
- **AND** initial hydration and the pre-acceptance speculative model commit produce no cue.

#### Scenario: Mouse click-to-move equals drag feedback
- **WHEN** a legal move is initiated by drag or click-to-move and acknowledged by the host
- **THEN** both input paths deliver identical one-time semantic feedback under the same cue policy.

#### Scenario: Arrow, theme or rerender updates
- **WHEN** a confirmed controlled position remains unchanged while managed arrows, animation, orientation, props, or React effect execution change
- **THEN** no extra move sound is emitted
- **AND** arrow visuals continue to update as requested.

#### Scenario: Rejected or cancelled move
- **WHEN** the host rejects/rolls back a speculative local move without accepting its position
- **THEN** no accepted-move cue is emitted
- **AND** the consumer may still independently announce illegal input.

### Requirement: Correct capture semantics across controlled transitions

GigaBoard SHALL classify confirmed captures accurately using the original move or authoritative accepted transition metadata when available, with conservative board-diff inference for unambiguous FEN-only transitions. `san-priority` SHALL retain capture precedence for every capturing chess move. The public default cue policy SHALL remain backward-compatible.

#### Scenario: Captures with metadata or FEN only
- **WHEN** a single legal ordinary capture, en passant, capture-check, capture-mate or capture-promotion is accepted, with either valid UCI metadata or a one-ply inferable FEN change
- **THEN** `onCue` receives `capture` exactly once with `cuePolicy="san-priority"`
- **AND** no ordinary, check, promotion or terminal cue replaces it.

#### Scenario: Noncapture special moves
- **WHEN** a noncapturing check, castling, promotion or ordinary move is accepted under `san-priority`
- **THEN** respectively `moveCheck`, `castle`, `promote` or `moveSelf`/`moveOpponent` is delivered exactly once.

#### Scenario: Non-move and ambiguous FEN replacement
- **WHEN** an initial load, rejected move, unchanged FEN, or non-single-ply replacement is encountered
- **THEN** GigaBoard SHALL NOT assert a capture based solely on appearance/disappearance animation descriptors
- **AND** the consumer's explicit sound enabled/disabled settings remain authoritative.

### Requirement: Consumer-owned playback and accessible integration

GigaBoard SHALL preserve an injected `onCue` as the sole playback handoff, without instantiating its built-in HTMLAudio pool when that callback is provided. Semantic sound triggers SHALL not change keyboard handling, focus, screen-reader announcements, localization, or default drag/animation behavior.

#### Scenario: Injected host playback
- **WHEN** `sound.onCue` is supplied for a controlled or model-triggered board
- **THEN** one correctly classified cue is sent to that callback without a second built-in player
- **AND** all existing keyboard focus and screen-reader feedback remain available to the host.

#### Scenario: Consumer disables board sound
- **WHEN** `sound.enabled=false` or `sound=false`
- **THEN** no move cue is emitted for mouse, keyboard, controlled-FEN, or internal model changes.
