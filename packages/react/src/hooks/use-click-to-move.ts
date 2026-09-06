"use client";

/**
 * Click-to-move handler.
 *
 * Given a `BoardModel`, returns a stable `(index) => void` that implements
 * the standard chess-UI click semantics:
 *
 * | Prior state      | Clicked square    | Result                            |
 * |------------------|-------------------|-----------------------------------|
 * | nothing selected | own piece         | select it                         |
 * | nothing selected | empty / opponent  | no-op                             |
 * | piece selected   | same square       | deselect                          |
 * | piece selected   | legal target      | play (or defer to onPromotion)    |
 * | piece selected   | own piece         | switch selection                  |
 * | piece selected   | illegal square    | deselect                          |
 *
 * The handler reads `model.getSnapshot()` at click time and does not
 * subscribe — the component wrapping this hook never re-renders because of
 * it.
 *
 * When a promotion is required:
 *
 * - If `onPromotionNeeded` is supplied, it's invoked with `(from, to)` and
 *   `tryMove` is NOT called — the caller is responsible for resolving the
 *   promotion and invoking `model.tryMove(from, to, chosenPiece)`.
 * - Otherwise we auto-promote to queen. This keeps the zero-config default
 *   behaviour intact.
 */

import { useCallback } from "react";
import {
  type BoardModel,
  Color,
  type PackedMove,
  PieceType,
  type SquareIndex,
} from "../core/index.js";

/** Pawn = piece-type 0; rank 7 / rank 0 is the last rank for white / black. */
function wouldPromote(fromCell: number, toIndex: SquareIndex): boolean {
  if (fromCell === 0) return false;
  const pieceType = (fromCell - 1) % 6;
  if (pieceType !== PieceType.Pawn) return false;
  const toRank = toIndex >> 3;
  return toRank === 0 || toRank === 7;
}

/**
 * @param model The board model, or `null` while the engine is loading.
 * @param onMove Optional callback fired on every successful move.
 * @param onPromotionNeeded Optional deferred-promotion handler. When
 *   provided, `tryMove` is not called — the caller resolves the promotion
 *   piece and invokes `model.tryMove` itself.
 * @param enabled Gate click-to-move. When `false` the returned callback
 *   is a no-op — used by `viewOnly` boards and anywhere the caller needs
 *   a stable identity while suppressing input. Defaults to `true`.
 */
export function useClickToMove(
  model: BoardModel | null,
  onMove?: (m: PackedMove) => void,
  onPromotionNeeded?: (from: SquareIndex, to: SquareIndex) => void,
  enabled = true,
): (index: SquareIndex) => void {
  return useCallback(
    (index: SquareIndex) => {
      if (!enabled) return;
      if (model === null) return;
      const snap = model.getSnapshot();
      const cell = snap.board[index] ?? 0;
      const pieceColour = cell === 0 ? -1 : cell > 6 ? Color.Black : Color.White;

      if (snap.selected === null) {
        if (pieceColour === snap.turn) model.selectSquare(index);
        return;
      }

      if (snap.selected === index) {
        model.selectSquare(null);
        return;
      }

      if (snap.legalTargets.has(index)) {
        const fromCell = snap.board[snap.selected] ?? 0;
        if (wouldPromote(fromCell, index)) {
          if (onPromotionNeeded !== undefined) {
            onPromotionNeeded(snap.selected, index);
            return;
          }
          const played = model.tryMove(snap.selected, index, PieceType.Queen);
          if (played !== null && onMove !== undefined) onMove(played);
          return;
        }
        const played = model.tryMove(snap.selected, index);
        if (played !== null && onMove !== undefined) onMove(played);
        return;
      }

      if (pieceColour === snap.turn) {
        model.selectSquare(index);
        return;
      }

      model.selectSquare(null);
    },
    [model, onMove, onPromotionNeeded, enabled],
  );
}
