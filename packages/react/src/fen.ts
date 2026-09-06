/**
 * FEN placement parsing — the one slice of FEN that both the server
 * `<StaticChessboard/>` and the client fallback-render path need.
 *
 * The parser is intentionally narrow: it only consumes the first
 * whitespace-delimited field of a FEN (piece placement) and returns a
 * 64-byte `Uint8Array` using our {@link BoardCell} encoding. Side-to-move,
 * castling, en-passant and the move clocks are the engine's business and
 * don't affect how the board is drawn.
 *
 * Kept in its own module so that:
 *
 * 1. `server.tsx` can import it without pulling a `"use client"` module.
 * 2. The client `<Chessboard/>`'s fallback path (`fallbackFen`) can reuse
 *    the exact same parser — one source of truth for FEN shape.
 *
 * Throws on malformed input so misconfiguration fails at render time
 * rather than silently producing a blank board.
 */

import type { BoardCell } from "@gigaboard/core";

/** FEN piece letter → our 1..12 `BoardCell` code, or 0 for unknown. */
function pieceCellFromFenChar(ch: string): BoardCell {
  switch (ch) {
    case "P":
      return 1 as BoardCell;
    case "N":
      return 2 as BoardCell;
    case "B":
      return 3 as BoardCell;
    case "R":
      return 4 as BoardCell;
    case "Q":
      return 5 as BoardCell;
    case "K":
      return 6 as BoardCell;
    case "p":
      return 7 as BoardCell;
    case "n":
      return 8 as BoardCell;
    case "b":
      return 9 as BoardCell;
    case "r":
      return 10 as BoardCell;
    case "q":
      return 11 as BoardCell;
    case "k":
      return 12 as BoardCell;
    default:
      return 0 as BoardCell;
  }
}

/**
 * Parse the piece-placement field of a FEN into a 64-byte `Uint8Array`
 * in LERF order (index 0 = a1, index 63 = h8).
 *
 * Only the first whitespace-delimited token is read; anything after it
 * is ignored. That means both a full FEN (`"rnbq... w KQkq - 0 1"`) and
 * a bare placement (`"rnbq..."`) are accepted.
 */
export function parseFenPlacement(fen: string): Uint8Array {
  const placement = fen.trim().split(/\s+/)[0];
  if (placement === undefined) {
    throw new Error("FEN is empty");
  }
  const ranks = placement.split("/");
  if (ranks.length !== 8) {
    throw new Error(`FEN must have 8 ranks, got ${ranks.length}`);
  }
  const board = new Uint8Array(64);
  for (let r = 0; r < 8; r++) {
    // FEN lists ranks 8→1; our LERF layout has rank 7 at top, 0 at bottom.
    const rank = 7 - r;
    const row = ranks[r];
    if (row === undefined) throw new Error(`FEN rank ${rank + 1} missing`);
    let file = 0;
    for (const ch of row) {
      if (file > 7) throw new Error(`FEN rank ${rank + 1} has too many files`);
      const skip = Number.parseInt(ch, 10);
      if (!Number.isNaN(skip)) {
        file += skip;
        continue;
      }
      const cell = pieceCellFromFenChar(ch);
      if (cell === 0) throw new Error(`FEN contains unknown piece: ${ch}`);
      board[rank * 8 + file] = cell;
      file++;
    }
    if (file !== 8) {
      throw new Error(`FEN rank ${rank + 1} ended at file ${file}, expected 8`);
    }
  }
  return board;
}

/** Standard starting position FEN, re-exported for convenience. */
export const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
