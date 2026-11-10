/**
 * Recover the semantic cue for a single confirmed controlled-FEN change when
 * the host did not supply positionTransition. The animation planner deliberately
 * describes load(fen) diffs as appear/disappear, which would otherwise turn
 * every capture into an ordinary move sound.
 *
 * This is a conservative structural inference, not a move generator. Return
 * null for ambiguous/multi-ply changes and let the existing fallback handle
 * them. Neither speculative model commits nor initial hydration reach here.
 */
import { colorOf, isEmptyCell, pieceTypeOf, type BoardCell } from "../core/index.js";

export interface ControlledFeedbackDescriptor {
  readonly kind: "move" | "capture" | "en-passant" | "castle" | "promotion";
}

export function inferControlledFeedbackDescriptors(
  previous: Readonly<Uint8Array>,
  next: Readonly<Uint8Array>,
): ControlledFeedbackDescriptor[] | null {
  if (previous.length !== 64 || next.length !== 64) return null;

  const cleared: number[] = [];
  const destinations: number[] = [];
  for (let square = 0; square < 64; square++) {
    const before = previous[square] as BoardCell;
    const after = next[square] as BoardCell;
    if (before === after) continue;
    if (!isEmptyCell(before) && isEmptyCell(after)) cleared.push(square);
    if (!isEmptyCell(after)) destinations.push(square);
  }

  // Single-piece move, including ordinary capture and capture-promotion.
  if (cleared.length === 1 && destinations.length === 1) {
    const from = cleared[0]!;
    const to = destinations[0]!;
    const moving = previous[from] as BoardCell;
    const landed = next[to] as BoardCell;
    const target = previous[to] as BoardCell;
    if (isEmptyCell(moving) || isEmptyCell(landed) ||
        colorOf(moving) !== colorOf(landed)) return null;

    const promotion =
      pieceTypeOf(moving) === 0 &&
      (to >> 3) === (colorOf(moving) === 0 ? 7 : 0) &&
      pieceTypeOf(landed) !== 0;
    if (!promotion && pieceTypeOf(moving) !== pieceTypeOf(landed)) return null;
    if (!isEmptyCell(target)) {
      return colorOf(target) !== colorOf(moving) ? [{ kind: "capture" }] : null;
    }
    return [{ kind: promotion ? "promotion" : "move" }];
  }

  // En passant: the moving pawn and captured pawn both disappear, while
  // the moving pawn reappears diagonally on a previously empty square.
  if (cleared.length === 2 && destinations.length === 1) {
    const to = destinations[0]!;
    const landed = next[to] as BoardCell;
    if (!isEmptyCell(landed) && pieceTypeOf(landed) === 0 &&
        isEmptyCell(previous[to] as BoardCell)) {
      for (const from of cleared) {
        const moving = previous[from] as BoardCell;
        if (isEmptyCell(moving) || pieceTypeOf(moving) !== 0 ||
            colorOf(moving) !== colorOf(landed)) continue;
        const capturedSquare = (from & ~7) | (to & 7);
        const captured = previous[capturedSquare] as BoardCell;
        const step = colorOf(moving) === 0 ? 1 : -1;
        if ((to >> 3) - (from >> 3) === step &&
            Math.abs((to & 7) - (from & 7)) === 1 &&
            cleared.includes(capturedSquare) &&
            !isEmptyCell(captured) &&
            pieceTypeOf(captured) === 0 &&
            colorOf(captured) !== colorOf(moving)) {
          return [{ kind: "en-passant" }];
        }
      }
    }
  }

  // Classical castling is a two-piece move; do not label its four square
  // changes as a multi-move sequence when the host omits the transition.
  if (cleared.length === 2 && destinations.length === 2) {
    const kingFrom = cleared.find(i => pieceTypeOf(previous[i] as BoardCell) === 5);
    const rookFrom = cleared.find(i => pieceTypeOf(previous[i] as BoardCell) === 3);
    const kingTo = destinations.find(i => pieceTypeOf(next[i] as BoardCell) === 5);
    const rookTo = destinations.find(i => pieceTypeOf(next[i] as BoardCell) === 3);
    if (kingFrom !== undefined && rookFrom !== undefined &&
        kingTo !== undefined && rookTo !== undefined) {
      const king = previous[kingFrom] as BoardCell;
      const rook = previous[rookFrom] as BoardCell;
      if (colorOf(king) === colorOf(rook) &&
          colorOf(king) === colorOf(next[kingTo] as BoardCell) &&
          colorOf(king) === colorOf(next[rookTo] as BoardCell) &&
          (kingFrom >> 3) === (kingTo >> 3) &&
          Math.abs((kingTo & 7) - (kingFrom & 7)) === 2 &&
          (rookFrom >> 3) === (rookTo >> 3)) {
        return [{ kind: "castle" }];
      }
    }
  }

  return null;
}
