## Why

The current board implementation (@ultrachess/react and @ultrachess/core) is tethered to `ultrachess` (WASM) and a non-standard 16-bit packed move layout. On cold mount, WASM adds a 255 ms CPU block and forces an asynchronous engine lifecycle (`game` starts as `null`), requiring fallback rendering and hydration steps. Furthermore, castling currently hardcodes King landing squares (`g1`/`c1`) and fails to support canonical "King captures Rook" wire encoding (`Move2`), creating friction and requiring translation shims for downstream applications like BlindBase.

Switching to `gigachess` (pure JS bitboard engine) and native `Move2` enables:
1. Instant, 100% synchronous board mounting (0 ms long tasks, no async `null` gap).
2. Direct binary interoperability with `turbochess` (frontend) and `turbochess-rs` (backend).
3. Seamless dual-input castling (move King 2 squares OR drop King onto Rook), with the board ALWAYS outputting canonical King-captures-Rook notation (`Move2` / Chess960 wire format).
4. Zero-BigInt 64-bit Zobrist caching (`{ lo, hi }`) for maximum V8 throughput.
5. Clean package rebranding to `gigaboard`.

## What Changes

- **Engine Replacement**: Deprecate and replace `ultrachess` (WASM) with `gigachess` (pure JS/TS bitboard engine) via `createGigachessAdapter`.
- **Synchronous Lifecycle**: `createBoardModel` and `useChessGame` become fully synchronous (`useMemo` / immediate state), eliminating the `game === null` async gap and cold-mount INP outliers.
- **Native Move2 Encoding**: Standardize `PackedMove` across `@ultrachess/core` and UI on the 16-bit `Move2` wire format (`from: 6b | to: 6b | promo: 4b`).
- **Castling Dual-Input & Canonical Recording**:
  - **Interaction**: Users can castle by dragging the King 2 squares (e.g., `e1 → g1` / `e1 → c1`) OR directly onto the corresponding Rook (e.g., `e1 → h1` / `e1 → a1`).
  - **Output Invariant**: The board and `onMove` event ALWAYS record and emit the move as King captures Rook (`e1h1`, `e1a1` / `Move2` `from = 4, to = 7`).
  - **Compositor Animation**: WAAPI FLIP glide smoothly coordinates both the King landing (`g1`/`c1`) and Rook landing (`f1`/`d1`) regardless of input gesture.
- **Zero-BigInt Zobrist Hashing**: Support `gigachess`'s 32-bit unsigned `{ lo, hi }` pair format in `EngineAdapter` and board cache keys.
- **Package Rebranding**: Set the published package name to `gigaboard`.

## Capabilities

### New Capabilities
- `gigaboard-move2-castling`: Native 16-bit `Move2` binary move representation, dual-gesture castling input (2-square jump or King-on-Rook), and canonical King-captures-Rook event emission.
- `gigaboard-gigachess-adapter`: Pure JavaScript `GigachessAdapter` with zero-WASM instant initialization and incremental `{ lo, hi }` Zobrist hashing.

### Modified Capabilities
<!-- None -->

## Impact

- **Breaking Changes**:
  - `PackedMove` bit layout changed to match `Move2` (`from | to << 6 | promo << 12`). Code assuming bits 14–15 represent move kind must use `gigachess` move inspection helpers.
  - `onMove` for castling now reports `e1h1` / `e1a1` (King captures Rook) instead of `e1g1` / `e1c1`.
- **Dependencies**: Drops `ultrachess` WASM peer dependency; depends directly on `gigachess`.
- **Performance**: Eliminates 255 ms cold-start compilation task; reduces bundle size by ~158 KB.
