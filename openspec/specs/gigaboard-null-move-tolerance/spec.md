## Purpose

Provides first-class tolerance for the null move (pass) — the `u16` sentinel word `0xffff`, spelled `"0000"` in UCI and `"--"` / `"Z0"` in PGN/SAN — so an externally supplied pass turn (e.g. from a CBH `moves2` stream) transitions the board correctly while remaining impossible to originate from a user gesture.

## Requirements

### Requirement: Null Move SHALL Be Represented by the Canonical Sentinel Word

A pass SHALL be represented by the 16-bit Move2 sentinel word `0xffff`. Spellings SHALL be `"0000"` in UCI and `"--"` in PGN/SAN, with `"Z0"` also accepted on input. No legal packed move SHALL collide with the sentinel, and consumers SHALL gate on the sentinel before unpacking because unpacking yields the meaningless `from = to = 63, promo = 15`.

#### Scenario: Sentinel is unambiguous
- **WHEN** any legal from/to/promotion triple is packed into a 16-bit Move2 word
- **THEN** the result is never `0xffff`, because Move2 promotion codes are `0..4`

#### Scenario: Unpacking the sentinel is documented as meaningless
- **WHEN** a caller unpacks `0xffff` without first checking for a pass
- **THEN** the result is `from = to = 63, promo = 15`, which the API documents as meaningless rather than a real move

### Requirement: Pass Transition SHALL Advance Turn and Both Clocks

Playing a pass SHALL leave every piece in place, clear any pending en-passant square, increment the halfmove clock, flip the side to move, and increment the fullmove number — a pass completes a **full** move, so the number advances whoever passed.

#### Scenario: White passes at the start position
- **WHEN** a pass is played from `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`
- **THEN** the position becomes `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 1 2` — identical pieces, Black to move, halfmove 1, fullmove 2

#### Scenario: Pass lapses a pending en-passant square
- **WHEN** a pass is played in a position with a capturable en-passant square
- **THEN** the en-passant field of the resulting position is `-`

#### Scenario: Pass moves no piece
- **WHEN** a pass is played
- **THEN** all 64 board cells are byte-identical before and after, and no piece is added, removed, or relocated

### Requirement: Pass SHALL Be Legal Only When the Side to Move Is Not in Check

A pass answers no check, so it SHALL be refused while the side to move is in check. The legality test SHALL be derived from the bitboards rather than a cached checkers set, so a stale cache cannot wave a pass through. A refused pass SHALL leave the position entirely unchanged and SHALL NOT throw.

#### Scenario: Pass refused in check
- **WHEN** a pass is attempted in a position where the side to move is in check
- **THEN** the pass is refused, the turn does not flip, neither clock advances, and the FEN is byte-identical to the pre-pass FEN

#### Scenario: Pass permitted when the opponent ends up in check
- **WHEN** a pass is played by a side that is not in check
- **THEN** the pass is accepted even though the resulting position places the new side to move under threat

### Requirement: Pass SHALL Schedule No Piece Animation

The animation planner SHALL emit zero descriptors for the sentinel, and no React layer SHALL derive a from/to square, last-move tint, or feedback classification from it. A pass is visually inert with respect to piece movement.

#### Scenario: Planner emits nothing for the sentinel
- **WHEN** `planAnimations` is called with the sentinel as the triggering move over two different board snapshots
- **THEN** it returns an empty descriptor list, rather than a phantom glide derived from the sentinel's `63 → 63` decode

#### Scenario: No last-move tint is painted
- **WHEN** a pass is committed
- **THEN** no square carries a last-move highlight, because the sentinel has no origin or destination

#### Scenario: Controlled UCI pass transition animates nothing
- **WHEN** a `positionTransition` of `uci: "0000"` is supplied
- **THEN** no square transition is scheduled and the transition is excluded from capture, promotion, and castle classification

#### Scenario: Pass is announced as a pass
- **WHEN** a pass is committed and the live region announces the move
- **THEN** the announcement reads `Passes.`

### Requirement: Pass SHALL Keep the Board State and Position Stack Coherent

A pass SHALL be recorded in the model's history so that `undo`, `redo`, and `goto` traverse it in the correct LIFO order alongside ordinary moves, and re-applying a pass from the redo stack SHALL replay it as a pass rather than decoding the sentinel as a from/to pair. Loading a FEN or resetting SHALL discard pass history so a later undo cannot reach a ply that no longer exists.

#### Scenario: Undo and redo traverse a pass
- **WHEN** a pass is played, then undone, then redone
- **THEN** each step returns the sentinel, the turn flips and reflips accordingly, and no animation is scheduled

#### Scenario: Pass interleaves with ordinary moves
- **WHEN** a real move, a pass, and a second real move are played and then undone one at a time
- **THEN** they are undone in strict LIFO order — the second real move, then the pass, then the first real move — returning to the original position

#### Scenario: goto walks across a pass
- **WHEN** `goto` moves the playhead back to the root and forward again across a position containing a pass
- **THEN** the history length and turn are restored at every step and the pass replays as a pass

#### Scenario: Load discards pass history
- **WHEN** a pass is played and a FEN is then loaded
- **THEN** `undo` returns null rather than unmaking a ply that the load replaced

### Requirement: Board SHALL Never Originate a Pass from a User Gesture

Gigaboard SHALL tolerate a pass but SHALL never originate one. No click, drag, keyboard, or selection path SHALL produce the sentinel, and the board SHALL expose no drag-to-null or pass affordance. `tryMove` SHALL be square-typed end to end, and an engine adapter that lacks the optional pass capability SHALL have every pass attempt refused rather than throwing.

#### Scenario: tryMove cannot express a pass
- **WHEN** `tryMove` is called for every from/to square pair and for every promotion code
- **THEN** it never returns the sentinel

#### Scenario: Gestures never report a pass
- **WHEN** the user clicks squares, drags a piece, or activates a square by keyboard
- **THEN** no move is reported as a pass, and the board never reports the sentinel as its last move

#### Scenario: No legal-target ring for a pass
- **WHEN** a pass is committed
- **THEN** the selection is cleared and the legal-target set is empty, so no ring is painted for a turn that moved nothing

#### Scenario: Adapter without pass capability refuses cleanly
- **WHEN** `pass` is called on a model whose adapter omits the pass capability
- **THEN** it returns null, commits no snapshot, and does not throw
