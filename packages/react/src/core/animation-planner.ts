/**
 * Animation planner: diff two board snapshots and classify the change.
 *
 * The planner is called on every commit. Given `(prevBoard, nextBoard)` and
 * optionally the packed `Move` that was played, it produces an
 * `AnimDescriptor[]` describing what the UI should animate. The React layer
 * feeds the descriptors into WAAPI (`element.animate(...)`) — the planner
 * itself knows nothing about DOM, time, or easing.
 *
 * When the caller supplies the packed move we take the fast path: the kind,
 * source, target, capture, promotion are all encoded in 16 bits. When no
 * move is available (e.g. `load(fen)`, `reset()`, `redo()` of an arbitrary
 * history entry), we fall back to a byte-level diff and classify
 * conservatively as `appear` / `disappear`.
 */

import type { AnimDescriptor, BoardCell, PackedMove, SquareIndex } from "./types.js";
import { Color, colorOf, isEmptyCell, PieceType, pieceTypeOf } from "./types.js";

/** Bit layout of a packed `Move` in 16-bit Move2 wire format. */
const MOVE_FROM_MASK = 0x3f;
const MOVE_TO_SHIFT = 6;
const MOVE_TO_MASK = 0x3f;
const MOVE_PROMO_SHIFT = 12;
const MOVE_PROMO_MASK = 0x0f;

/** Promotion piece encoding within Move2 (0 = none, 1 = N, 2 = B, 3 = R, 4 = Q). */
const PROMO_PIECE: readonly (PieceType | null)[] = [
  null,
  PieceType.Knight,
  PieceType.Bishop,
  PieceType.Rook,
  PieceType.Queen,
];

/**
 * Plan animations for the transition `prev → next`.
 *
 * @param prev Previous board bytes (length 64).
 * @param next New board bytes (length 64).
 * @param move Optional packed move that caused the transition. Enables the
 *   fast path; without it the planner falls back to a byte-level diff.
 */
export function planAnimations(
  prev: Readonly<Uint8Array>,
  next: Readonly<Uint8Array>,
  move: PackedMove | null,
): AnimDescriptor[] {
  if (process.env["NODE_ENV"] !== "production") {
    if (prev.length !== 64 || next.length !== 64) {
      throw new RangeError("planAnimations: board buffers must be length 64");
    }
  }

  if (move !== null) {
    return planFromMove(prev, next, move);
  }
  return planFromDiff(prev, next);
}

/** Fast path: we know the exact move the engine just played. */
function planFromMove(
  prev: Readonly<Uint8Array>,
  next: Readonly<Uint8Array>,
  move: PackedMove,
): AnimDescriptor[] {
  const from = (move & MOVE_FROM_MASK) as SquareIndex;
  const to = ((move >> MOVE_TO_SHIFT) & MOVE_TO_MASK) as SquareIndex;
  const promoCode = (move >> MOVE_PROMO_SHIFT) & MOVE_PROMO_MASK;

  const pieceBefore = prev[from] as BoardCell;
  const pieceAfter = next[to] as BoardCell;
  const targetBefore = prev[to] as BoardCell;

  // 1. Castling detection:
  // Identified from King-captures-Rook canonical moves or 2-square jumps.
  if (!isEmptyCell(pieceBefore) && pieceTypeOf(pieceBefore) === PieceType.King) {
    const isFriendlyRookTarget =
      !isEmptyCell(targetBefore) &&
      colorOf(targetBefore) === colorOf(pieceBefore) &&
      pieceTypeOf(targetBefore) === PieceType.Rook;

    const isKingCapturesRookCanonical =
      (from === 4 && (to === 7 || to === 0)) || (from === 60 && (to === 63 || to === 56));

    const isKingTwoSquares =
      (from === 4 && (to === 6 || to === 2)) || (from === 60 && (to === 62 || to === 58));

    if (isFriendlyRookTarget || isKingCapturesRookCanonical || isKingTwoSquares) {
      const isKingside = (to & 7) > (from & 7);
      const kingRank = from >> 3;
      const base = kingRank << 3;
      const kingFrom = from;
      const kingTo = (base + (isKingside ? 6 : 2)) as SquareIndex;
      const rookFrom = (base + (isKingside ? 7 : 0)) as SquareIndex;
      const rookTo = (base + (isKingside ? 5 : 3)) as SquareIndex;
      return [
        {
          kind: "castle",
          kingFrom,
          kingTo,
          rookFrom,
          rookTo,
        },
      ];
    }
  }

  // 2. En-passant detection:
  // Pawn moves diagonally onto an empty target square.
  if (
    !isEmptyCell(pieceBefore) &&
    pieceTypeOf(pieceBefore) === PieceType.Pawn &&
    (from & 7) !== (to & 7) &&
    isEmptyCell(targetBefore)
  ) {
    const capturedSquare = ((from & ~7) | (to & 7)) as SquareIndex;
    const captured = prev[capturedSquare] as BoardCell;
    return [
      {
        kind: "en-passant",
        from,
        to,
        capturedSquare,
        piece: pieceBefore,
        captured,
      },
    ];
  }

  // 3. Promotion:
  if (promoCode > 0) {
    const captured = isEmptyCell(targetBefore) ? null : targetBefore;
    return [
      {
        kind: "promotion",
        from,
        to,
        pieceBefore,
        pieceAfter,
        captured,
      },
    ];
  }

  // 4. Capture or Normal move:
  if (!isEmptyCell(targetBefore)) {
    return [
      {
        kind: "capture",
        from,
        to,
        piece: pieceBefore,
        captured: targetBefore,
      },
    ];
  }

  return [{ kind: "move", from, to, piece: pieceBefore }];
}

/**
 * Fallback path: compare two arbitrary boards and describe every changed
 * square as `appear` / `disappear`. The UI renders these as fades rather
 * than glides — we can't recover the original trajectory.
 */
function planFromDiff(prev: Readonly<Uint8Array>, next: Readonly<Uint8Array>): AnimDescriptor[] {
  const descriptors: AnimDescriptor[] = [];
  for (let i = 0; i < 64; i++) {
    const a = prev[i] as BoardCell;
    const b = next[i] as BoardCell;
    if (a === b) continue;
    const at = i as SquareIndex;
    if (!isEmptyCell(a) && isEmptyCell(b)) {
      descriptors.push({ kind: "disappear", at, piece: a });
    } else if (isEmptyCell(a) && !isEmptyCell(b)) {
      descriptors.push({ kind: "appear", at, piece: b });
    } else {
      // Piece replaced by a different piece — typically a sequence of two
      // moves collapsed by `goto(ply)`. Emit a disappear + appear pair so
      // the UI can fade one out and the other in.
      descriptors.push({ kind: "disappear", at, piece: a });
      descriptors.push({ kind: "appear", at, piece: b });
    }
  }
  return descriptors;
}

/**
 * Lightweight, side-effect-free inspector. Used by tests to decompose a
 * packed move without pulling an engine as a runtime dep.
 */
export function decodePackedMove(m: PackedMove): {
  from: SquareIndex;
  to: SquareIndex;
  kind: "normal" | "promotion" | "en-passant" | "castle";
  promotion: PieceType | null;
} {
  const from = (m & MOVE_FROM_MASK) as SquareIndex;
  const to = ((m >> MOVE_TO_SHIFT) & MOVE_TO_MASK) as SquareIndex;
  const promoCode = (m >> MOVE_PROMO_SHIFT) & MOVE_PROMO_MASK;
  const promotion = PROMO_PIECE[promoCode] ?? null;

  const isCastle =
    (from === 4 && (to === 7 || to === 0 || to === 6 || to === 2)) ||
    (from === 60 && (to === 63 || to === 56 || to === 62 || to === 58));

  const kind: "normal" | "promotion" | "en-passant" | "castle" =
    promotion !== null ? "promotion" : isCastle ? "castle" : "normal";

  return { from, to, kind, promotion };
}

/**
 * Expose colour / piece-type extraction from a `BoardCell` without re-importing
 * `types.ts`. Used by the React layer when it needs to know "is this white's
 * pawn?" cheaply.
 */
export const animationInspect = {
  colorOf,
  pieceTypeOf,
  // Re-export the Color / PieceType enums so consumers can compare without
  // extra imports.
  Color,
  PieceType,
};
