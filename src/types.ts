/**
 * Public types and branded primitives for `@ultrachess/core`.
 *
 * Design goals:
 * - Primitives carry their meaning in the type (`SquareIndex` never silently
 *   mixes with a piece code or a file number).
 * - Encoding of a board cell is a single byte suitable for `Uint8Array(64)`.
 * - Every symbol exported here is a type or a zero-cost helper — no classes,
 *   no allocations per call, nothing that would eat into the 6 KB budget.
 */

/**
 * A square on the board, in LERF indexing: `0 = a1`, `7 = h1`, `56 = a8`,
 * `63 = h8`. Aligned with `ultrachess`'s square indexing.
 */
export type SquareIndex = number & { readonly __brand: "SquareIndex" };

/**
 * A packed u16 move, identical in layout to `ultrachess`'s `Move`:
 * bits 0–5 = from, 6–11 = to, 12–13 = promotion piece, 14–15 = move kind.
 */
export type PackedMove = number & { readonly __brand: "PackedMove" };

/**
 * A single byte representing one square of the board. `0` is empty; values
 * `1..12` encode a piece. The encoding is a stable contract: consumers may
 * rely on `BOARD_CELL_*` constants (below) instead of remembering numbers.
 */
export type BoardCell = number & { readonly __brand: "BoardCell" };

/** Piece color. Matches `ultrachess`'s `Color` (White = 0, Black = 1). */
export const Color = {
  White: 0,
  Black: 1,
} as const;
/** Colour value. */
export type Color = (typeof Color)[keyof typeof Color];

/** Piece type. Matches `ultrachess`'s `PieceType`. */
export const PieceType = {
  Pawn: 0,
  Knight: 1,
  Bishop: 2,
  Rook: 3,
  Queen: 4,
  King: 5,
} as const;
/** Piece-type value (0 = Pawn .. 5 = King). */
export type PieceType = (typeof PieceType)[keyof typeof PieceType];

/** Board-cell constants for readability at call sites. */
export const BOARD_CELL_EMPTY = 0 as BoardCell;
export const BOARD_CELL_WP = 1 as BoardCell;
export const BOARD_CELL_WN = 2 as BoardCell;
export const BOARD_CELL_WB = 3 as BoardCell;
export const BOARD_CELL_WR = 4 as BoardCell;
export const BOARD_CELL_WQ = 5 as BoardCell;
export const BOARD_CELL_WK = 6 as BoardCell;
export const BOARD_CELL_BP = 7 as BoardCell;
export const BOARD_CELL_BN = 8 as BoardCell;
export const BOARD_CELL_BB = 9 as BoardCell;
export const BOARD_CELL_BR = 10 as BoardCell;
export const BOARD_CELL_BQ = 11 as BoardCell;
export const BOARD_CELL_BK = 12 as BoardCell;

/** Narrow a number into a `SquareIndex`. Validates in dev, no-op at runtime. */
export function toSquareIndex(n: number): SquareIndex {
  if (process.env["NODE_ENV"] !== "production") {
    if (!Number.isInteger(n) || n < 0 || n > 63) {
      throw new RangeError(`SquareIndex out of range: ${n}`);
    }
  }
  return n as SquareIndex;
}

/** Type-guard: is `n` a valid square index? */
export function isSquareIndex(n: number): n is SquareIndex {
  return Number.isInteger(n) && n >= 0 && n <= 63;
}

/**
 * Pack a `(color, type)` pair into a `BoardCell`.
 *
 * @remarks Inlined constant arithmetic — stays zero-allocation.
 */
export function encodeBoardCell(color: Color, type: PieceType): BoardCell {
  return (1 + type + color * 6) as BoardCell;
}

/** `true` if the cell is empty. */
export function isEmptyCell(cell: BoardCell): boolean {
  return cell === 0;
}

/** Extract the color from a non-empty `BoardCell`. Undefined for empty cells. */
export function colorOf(cell: BoardCell): Color {
  return (cell > 6 ? 1 : 0) as Color;
}

/** Extract the piece type from a non-empty `BoardCell`. Undefined for empty. */
export function pieceTypeOf(cell: BoardCell): PieceType {
  return ((cell - 1) % 6) as PieceType;
}

/** Convert `ultrachess`'s 255-empty `(color << 3) | type` encoding to ours. */
export function fromUltrachessPiece(code: number): BoardCell {
  if (code === 255) return BOARD_CELL_EMPTY;
  const color = (code >> 3) & 1;
  const type = code & 0b111;
  return (1 + type + color * 6) as BoardCell;
}

/**
 * An on-board arrow annotation. Identity is `(from, to, color)` — two arrows
 * with the same triple are considered equal.
 */
export interface Arrow {
  readonly from: SquareIndex;
  readonly to: SquareIndex;
  /** Any CSS-legal color string. Common values: `"green"`, `"red"`, `"blue"`. */
  readonly color: string;
}

/** A queued premove awaiting the opponent's reply. */
export interface Premove {
  readonly from: SquareIndex;
  readonly to: SquareIndex;
  readonly promotion?: PieceType;
}

/**
 * Immutable snapshot of the board at a single instant. Produced by the store
 * on every commit; never mutated. React's `useSyncExternalStore` relies on
 * referential equality here — a new snapshot object is emitted per commit,
 * but bytes of `board` that didn't change share values with the previous one
 * (read as primitives), so per-square subscribers skip untouched squares.
 */
export interface BoardSnapshot {
  /** 64-byte board, LERF-indexed. See {@link BoardCell}. */
  readonly board: Readonly<Uint8Array>;
  /** Side to move. */
  readonly turn: Color;
  /** Zobrist hash of the position (from the engine). */
  readonly hash: bigint;
  /** The packed move that produced this position, or `null` for the initial. */
  readonly lastMove: PackedMove | null;
  /** Currently-selected square (UI state), or `null`. */
  readonly selected: SquareIndex | null;
  /** Legal target squares from `selected`. Empty set if nothing is selected. */
  readonly legalTargets: ReadonlySet<SquareIndex>;
  /** `true` if the side to move is in check. */
  readonly inCheck: boolean;
  /** `true` if the position ends the game (mate, stalemate, draw). */
  readonly isGameOver: boolean;
  /** How many plies from the initial position we are (includes undos). */
  readonly historyPly: number;
  /** Total history length, including any plies we've undone. */
  readonly historyLength: number;
  /** Active arrows drawn on the board. */
  readonly arrows: readonly Arrow[];
  /** Queued premoves, in FIFO order. */
  readonly premoves: readonly Premove[];
}

/** Descriptor classifying one animated change between two snapshots. */
export type AnimDescriptor =
  | {
      readonly kind: "move";
      readonly from: SquareIndex;
      readonly to: SquareIndex;
      readonly piece: BoardCell;
    }
  | {
      readonly kind: "capture";
      readonly from: SquareIndex;
      readonly to: SquareIndex;
      readonly piece: BoardCell;
      readonly captured: BoardCell;
    }
  | {
      readonly kind: "en-passant";
      readonly from: SquareIndex;
      readonly to: SquareIndex;
      readonly capturedSquare: SquareIndex;
      readonly piece: BoardCell;
      readonly captured: BoardCell;
    }
  | {
      readonly kind: "castle";
      readonly kingFrom: SquareIndex;
      readonly kingTo: SquareIndex;
      readonly rookFrom: SquareIndex;
      readonly rookTo: SquareIndex;
    }
  | {
      readonly kind: "promotion";
      readonly from: SquareIndex;
      readonly to: SquareIndex;
      readonly pieceBefore: BoardCell;
      readonly pieceAfter: BoardCell;
      readonly captured: BoardCell | null;
    }
  | {
      readonly kind: "appear";
      readonly at: SquareIndex;
      readonly piece: BoardCell;
    }
  | {
      readonly kind: "disappear";
      readonly at: SquareIndex;
      readonly piece: BoardCell;
    };

/** Pointer-driven drag state. Used by `drag-controller`. */
export type DragState =
  | { readonly kind: "idle" }
  | {
      readonly kind: "pending";
      readonly from: SquareIndex;
      readonly pointerId: number;
      readonly originX: number;
      readonly originY: number;
    }
  | {
      readonly kind: "dragging";
      readonly from: SquareIndex;
      readonly pointerId: number;
      readonly x: number;
      readonly y: number;
    };
