/**
 * Abstract engine protocol.
 *
 * The board model speaks to a chess engine exclusively through an
 * `EngineAdapter`. Swapping the default `ultrachess` adapter for another
 * (chess.js, a variant engine, a custom server-backed validator) should not
 * require changes to `board-model` or any React code.
 *
 * All methods are synchronous: adapter construction absorbs any async init.
 * Every call is expected to be cheap in the steady state — `ultrachess`'s
 * WASM boundary is measured in nanoseconds. Long-running adapters should
 * cache aggressively on their own side.
 */

import type { BoardCell, Color, PackedMove, PieceType, SquareIndex } from "./types.js";

/** The engine protocol. */
export interface EngineAdapter {
  /**
   * Play a legal move. Returns the packed move on success, `null` if the move
   * is illegal in the current position. Never throws on illegal input —
   * callers may pass arbitrary from/to pairs (e.g. drag-and-drop drops onto
   * any square).
   */
  makeMove(from: SquareIndex, to: SquareIndex, promotion?: PieceType): PackedMove | null;

  /** Undo the most recent move. Returns the undone move, or `null` if none. */
  undo(): PackedMove | null;

  /**
   * Legal moves from a single origin square (`from` provided) or all legal
   * moves (`from` omitted). The returned array is fresh on every call; the
   * caller is free to retain or discard it.
   */
  legalMoves(from?: SquareIndex): readonly PackedMove[];

  /**
   * Fill `out` with the current position as 64 `BoardCell` bytes (LERF). The
   * caller supplies the buffer so adapters can avoid allocating per commit;
   * `out.length` must be `64`.
   */
  readBoard(out: Uint8Array): void;

  /** Current FEN. */
  fen(): string;

  /** Side to move. */
  turn(): Color;

  /** Zobrist hash of the current position. O(1) in `ultrachess`. */
  hash(): bigint;

  /** `true` if the side to move is in check. */
  inCheck(): boolean;

  /** `true` if the position ends the game (mate, stalemate, draw). */
  isGameOver(): boolean;

  /** Load a FEN into the engine, replacing the current position and history. */
  load(fen: string): void;

  /** Reset to the starting position. Clears history. */
  reset(): void;

  /** Release engine resources (the WASM handle in `ultrachess`). */
  dispose(): void;
}

/**
 * Opaque board-cell setter — lets adapters paint individual bytes into `out`
 * without repeatedly importing `types.ts`'s `encodeBoardCell`.
 *
 * @param out Target 64-byte buffer.
 * @param index LERF square index.
 * @param cell The pre-encoded board cell value.
 */
export function writeBoardCell(out: Uint8Array, index: SquareIndex, cell: BoardCell): void {
  out[index] = cell;
}
