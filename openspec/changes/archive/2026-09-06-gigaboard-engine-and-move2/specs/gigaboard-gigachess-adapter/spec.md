## Purpose

Provides a zero-WASM, pure JavaScript chess engine adapter wrapping gigachess with synchronous initialization and incremental zero-BigInt 64-bit Zobrist hashing.

## ADDED Requirements

### Requirement: Engine Adapter SHALL Initialize Synchronously

The system SHALL provide `createGigachessAdapter(fen?: string): EngineAdapter` that instantiates synchronously without requiring asynchronous WASM compilation or top-level await.

#### Scenario: Synchronous construction on frame 0
- **WHEN** `createGigachessAdapter()` is called with an optional starting FEN
- **THEN** an active, fully validated `EngineAdapter` instance is returned immediately in the same JavaScript task

### Requirement: Board Model Creation SHALL Support Synchronous React Mounting

The React hook `useChessGame` and the model factory `createBoardModel` SHALL support immediate synchronous creation so that `<Chessboard game={game} />` is fully interactive on the first render commit without an intermediate `game === null` state.

#### Scenario: No blank board or fallback delay
- **WHEN** a component mounts using `const game = useChessGame({ fen: startpos })`
- **THEN** `game` is non-null on the initial render, and pieces are immediately grabbable and responsive to pointer events

### Requirement: Incremental Zobrist Hash SHALL Support 32-bit Integer Pairs

The engine adapter and legal move cache index SHALL support 64-bit Zobrist keys formatted as `{ lo: number, hi: number }` (matching Polyglot and gigachess constants) to avoid `BigInt` heap allocations on hot paths.

#### Scenario: Hash cache lookup during move selection
- **WHEN** a square is selected and legal targets are queried
- **THEN** the cache keys on the `{ lo, hi }` Zobrist key without constructing heap-allocated `BigInt` primitives
