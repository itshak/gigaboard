/**
 * Abstract engine protocol.
 *
 * The board model speaks to a chess engine exclusively through an
 * `EngineAdapter`. Swapping the default `gigachess` adapter for another
 * (chess.js, a variant engine, a custom server-backed validator) should not
 * require changes to `board-model` or any React code.
 *
 * All methods are synchronous: adapter construction absorbs any async init.
 * Every call is expected to be cheap in the steady state. Long-running adapters
 * should cache aggressively on their own side.
 */

import type { BoardCell, Color, PackedMove, PieceType, SquareIndex, ZobristKey } from "./types.js";

/** The engine protocol. */
export interface EngineAdapter {
  /**
   * Play a legal move. Returns the packed move on success, `null` if the move
   * is illegal in the current position. Never throws on illegal input —
   * callers may pass arbitrary from/to pairs (e.g. drag-and-drop drops onto
   * any square).
   */
  makeMove(from: SquareIndex, to: SquareIndex, promotion?: PieceType): PackedMove | null;

  /**
   * Undo the most recent move. Returns the undone move, or `null` if none.
   *
   * A pass undoes to {@link NULL_MOVE_WORD}, mirroring what
   * {@link EngineAdapter.makeNullMove} produced.
   */
  undo(): PackedMove | null;

  /**
   * Play a pass (null move): the position's pieces are untouched, the
   * side to move flips, the en-passant square clears, and both clocks
   * advance — a pass completes a **full** move, whoever passed, so the
   * fullmove number always increments.
   *
   * Returns {@link NULL_MOVE_WORD} on success, or `null` when the pass is
   * refused. A pass is legal **iff** the side to move is not in check: a
   * pass answers no check, so a checked side cannot pass.
   *
   * @remarks
   * Optional: an adapter that cannot represent a pass simply omits it and
   * every pass attempt is refused. This is the tolerance path only —
   * gigaboard never originates a pass from a user gesture.
   */
  makeNullMove?(): PackedMove | null;

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

  /** Zobrist hash of the current position. */
  hash(): ZobristKey | bigint;

  /** `true` if the side to move is in check. */
  inCheck(): boolean;

  /**
   * Render a packed move as SAN (e.g. `"Nf3"`, `"O-O"`, `"exd5"`, `"e8=Q+"`).
   * Used by the React layer's screen-reader announcer.
   *
   * Must be called BEFORE the move is played — SAN depends on the
   * pre-move position for disambiguation and check markers.
   */
  san(move: PackedMove): string;

  /** `true` if the position ends the game (mate, stalemate, draw). */
  isGameOver(): boolean;

  /** Load a FEN into the engine, replacing the current position and history. */
  load(fen: string): void;

  /** Reset to the starting position. Clears history. */
  reset(): void;

  /** Release engine resources. */
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
