"use client";

/**
 * Red-glow highlight under the king when the side-to-move is in check.
 *
 * Subscribes to `inCheck`, `turn`, and `board` — when any of those change
 * (which is rare: only on moves that give or resolve check) we scan the
 * board for the side-to-move's king and position a radial-gradient tint
 * under its square. Pointer-events are `none` so the highlight never
 * intercepts clicks; the piece on top remains fully interactive.
 */

import type { BoardCell, BoardModel, SquareIndex } from "@ultrachess/core";
import { CSS_VARS } from "../default-theme.js";
import { useBoardSlice } from "../hooks/use-board-subscription.js";
import type { Orientation } from "../types.js";

/** King cell value depending on colour. */
const WHITE_KING = 6 as BoardCell; // BOARD_CELL_WK
const BLACK_KING = 12 as BoardCell; // BOARD_CELL_BK

/** Find the side-to-move's king index on the board, or `null` if missing. */
function findKing(board: Readonly<Uint8Array>, turn: 0 | 1): SquareIndex | null {
  const code = turn === 0 ? WHITE_KING : BLACK_KING;
  for (let i = 0; i < 64; i++) {
    if (board[i] === code) return i as SquareIndex;
  }
  return null;
}

/** Pixel position of a square within the board, as `{ x%, y% }`. */
function positionOf(index: SquareIndex, orientation: Orientation): {
  x: number;
  y: number;
} {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { x: col * 12.5, y: row * 12.5 };
}

/** Props for {@link CheckLayer}. */
export interface CheckLayerProps {
  readonly model: BoardModel;
  readonly orientation: Orientation;
}

/**
 * Renders nothing when the side-to-move is not in check. When it is, draws
 * a single absolute-positioned div with a radial-gradient background over
 * the king's square.
 *
 * Split into an outer shell that only subscribes to the cheap `inCheck`
 * primitive and an inner component that subscribes to `turn`/`board`. The
 * inner component only exists while the king IS in check, so the 64-byte
 * `board` slice is only observed during those commits — untouched during
 * the overwhelming majority of moves.
 */
export function CheckLayer({ model, orientation }: CheckLayerProps) {
  const inCheck = useBoardSlice(model, (s) => s.inCheck);
  if (!inCheck) return null;
  return <CheckLayerInner model={model} orientation={orientation} />;
}

function CheckLayerInner({ model, orientation }: CheckLayerProps) {
  const turn = useBoardSlice(model, (s) => s.turn) as 0 | 1;
  const board = useBoardSlice(model, (s) => s.board);
  const kingSquare = findKing(board, turn);
  if (kingSquare === null) return null;
  const { x, y } = positionOf(kingSquare, orientation);

  return (
    <div
      data-layer="check"
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: "12.5%",
        height: "12.5%",
        background: `var(${CSS_VARS.CHECK})`,
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}
