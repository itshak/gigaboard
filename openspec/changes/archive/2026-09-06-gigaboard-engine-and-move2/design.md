## Context

The board layer is transitioning from `ultrachess` (WASM) to `gigachess` (pure TypeScript/JavaScript) to eliminate WASM startup latency, bundle bulk, and asynchronous mounting complexity. In addition, the binary move format must align with `turbochess` and `turbochess-rs` via `Move2`, while supporting dual-gesture castling input that always records canonical King-captures-Rook moves.

## Goals / Non-Goals

**Goals:**
- Replace `@ultrachess/core`'s engine adapter with `createGigachessAdapter`, providing synchronous initialization (<0.5 ms).
- Standardize on `Move2` 16-bit word format (`from: 6b | to: 6b | promo: 4b`).
- Support dual-input castling (moving King 2 squares or onto Rook) while always recording canonical King-captures-Rook.
- Eliminate asynchronous `useChessGame` mount gap: `<Chessboard />` renders interactive pieces on frame 0.
- Preserve 1 commit/move, 0 commits/drag-frame, and WAAPI compositor glides.
- Rename published package to `gigaboard`.

**Non-Goals:**
- Running heavy chess engine search or batch evaluation in the UI component (those tasks belong in Tauri/Rust backend via IPC or Web Workers).
- Maintaining backward-compatibility with `ultrachess`'s 16-bit move bit layout (bits 14–15 as kind).

## Decisions

### 1. Synchronous GigachessAdapter
- **Decision**: Implement `createGigachessAdapter` wrapping `gigachess`'s `Chess` class.
- **Rationale**: `gigachess` is pure JS with 18.7M nodes/s perft. Because no WASM compilation is needed, the adapter is built synchronously. This simplifies `useChessGame` to `useMemo` or initial `useState` without an async gap.
- **Alternative considered**: Keeping WASM as an optional fallback. Rejected because it retains WASM bundling overhead and complexity for no demonstrable UI benefit.

### 2. Move2 (16-bit) Wire Format
- **Decision**: Define `PackedMove` as `(from & 0x3f) | ((to & 0x3f) << 6) | ((promo & 0x0f) << 12)`.
- **Rationale**: Matches `turbochess/src/packedMove.ts` and `turbochess-rs/src/moves2.rs`, enabling zero-copy binary streaming with Tauri IPC and BlindBase.
- **Alternative considered**: Storing moves as `{ from, to, promotion }` objects. Rejected because binary `u16` avoids GC allocation on high-frequency replay.

### 3. Dual-Gesture Castling with Canonical Output
- **Decision**:
  - In `dragController` / `onDrop` / `selectSquare`, if a King moves 2 squares (e.g. `4 → 6` or `4 → 2`), resolve it to King-captures-Rook (`4 → 7` or `4 → 0`).
  - If a King is dropped directly on friendly Rook (`4 → 7` or `4 → 0`), accept it as castling.
  - The board model commits and emits the canonical move (`from = 4, to = 7` or `e1h1`).
  - The animation planner outputs `{ kind: "castle", kingFrom: 4, kingTo: 6, rookFrom: 7, rookTo: 5 }` so the WAAPI glide animates both pieces to their standard board squares.
- **Rationale**: Preserves the standard chess user experience (players instinctively drag King 2 squares) while satisfying BlindBase's and Chess960's canonical wire format.

### 4. Zero-BigInt 64-bit Zobrist Hashing
- **Decision**: Represent position keys as `{ lo: number, hi: number }` (or packed 64-bit strings) in `LegalMoveIndex`.
- **Rationale**: `gigachess` calculates incremental Polyglot Zobrist keys in two 32-bit uints to avoid V8 `BigInt` allocation on hot move paths.

## Risks / Trade-offs

- **[Risk]** Existing downstream code relying on `e1g1` castling notation will see `e1h1`.
  → *Mitigation*: BlindBase is being updated simultaneously to natively consume `e1h1` (removing its legacy `adaptChessgroundDrop` wrapper).
- **[Risk]** Breaking changes to `PackedMove` bit layout.
  → *Mitigation*: Export `packMove` / `unpackMove` from `gigaboard` matching `turbochess`'s canonical helpers.
