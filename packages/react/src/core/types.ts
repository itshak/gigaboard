/**
 * Public types and branded primitives for `gigaboard/core`.
 *
 * Design goals:
 * - Primitives carry their meaning in the type (`SquareIndex` never silently
 *   mixes with a piece code or a file number).
 * - Encoding of a board cell is a single byte suitable for `Uint8Array(64)`.
 * - Every symbol exported here is a type or a zero-cost helper — no classes,
 *   no allocations per call, nothing that would eat into the budget.
 */

/**
 * A square on the board, in LERF indexing: `0 = a1`, `7 = h1`, `56 = a8`,
 * `63 = h8`. Aligned with standard 0..63 square indexing.
 */
export type SquareIndex = number & { readonly __brand: "SquareIndex" };

/**
 * A packed u16 move conforming to the 16-bit Move2 wire format:
 * bits 0–5: from square index (0..63)
 * bits 6–11: to square index (0..63)
 * bits 12–15: promotion code (0 = none, 1 = Knight, 2 = Bishop, 3 = Rook, 4 = Queen).
 */
export type PackedMove = number & { readonly __brand: "PackedMove" };

/** Move2 promotion codes */
export const MOVE2_PROMO_NONE = 0;
export const MOVE2_PROMO_KNIGHT = 1;
export const MOVE2_PROMO_BISHOP = 2;
export const MOVE2_PROMO_ROOK = 3;
export const MOVE2_PROMO_QUEEN = 4;

/**
 * Packs from/to/promo into one 16-bit Move2 word.
 */
export function packMove(from: number, to: number, promo = MOVE2_PROMO_NONE): PackedMove {
  return (((from & 0x3f) | ((to & 0x3f) << 6) | ((promo & 0x0f) << 12)) & 0xffff) as PackedMove;
}

/**
 * Unpacks a 16-bit Move2 word into its from/to/promo fields.
 */
export function unpackMove(move: PackedMove | number): {
  from: SquareIndex;
  to: SquareIndex;
  promo: number;
} {
  const w = (move as number) & 0xffff;
  return {
    from: (w & 0x3f) as SquareIndex,
    to: ((w >>> 6) & 0x3f) as SquareIndex,
    promo: (w >>> 12) & 0x0f,
  };
}

/**
 * 64-bit Zobrist key represented as two 32-bit unsigned integers (zero-BigInt).
 */
export type ZobristKey = {
  readonly lo: number;
  readonly hi: number;
};


/**
 * A single byte representing one square of the board. `0` is empty; values
 * `1..12` encode a piece. The encoding is a stable contract: consumers may
 * rely on `BOARD_CELL_*` constants (below) instead of remembering numbers.
 */
export type BoardCell = number & { readonly __brand: "BoardCell" };

/** Piece color (White = 0, Black = 1). */
export const Color = {
  White: 0,
  Black: 1,
} as const;
/** Colour value. */
export type Color = (typeof Color)[keyof typeof Color];

/** Piece type (0 = Pawn .. 5 = King). */
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


/**
 * Optional text label rendered alongside an arrow. Positioned at the
 * endpoint by default; use `ArrowShape["labelCenter"]` to anchor it on
 * `"orig"` (source square) or at the arrow's midpoint instead.
 */
export interface ArrowLabel {
  readonly text: string;
  /** CSS color for the label glyph. Defaults to the arrow's `color`. */
  readonly fill?: string;
}

/**
 * Arbitrary inline SVG payload rendered on top of the canvas overlay.
 * `html` is injected into an `<svg>` group as a `foreignObject`-free
 * child so downstream CSS animations and `stroke-dasharray` tricks
 * work as-is. The renderer never parses or sanitises the string —
 * consumers are responsible for trusting the source. Typical uses:
 *   - Stockfish best-move numerals ("+1.2", "♔")
 *   - Coach annotations (stars, exclamations, `!!`/`??`)
 *   - Custom variation markers
 */
export interface ArrowCustomSvg {
  /** SVG fragment injected as-is. Must be safe markup — no sanitisation. */
  readonly html: string;
  /**
   * Anchor point for the fragment. Default `"dest"`. `"orig"` is useful
   * for same-square marks (circles); `"label"` centres on the midpoint.
   */
  readonly center?: "orig" | "dest" | "label";
}

/**
 * An on-board arrow annotation. Identity is the tuple
 * `(from, to, color, brush, label.text, customSvg.html, below)` — two
 * arrows that agree on every field are considered equal.
 *
 * @remarks
 * The original `(from, to, color)` identity is preserved: any arrow
 * that doesn't carry the optional decorations behaves exactly as in
 * M1. Additive-only extension.
 */
export interface Arrow {
  readonly from: SquareIndex;
  readonly to: SquareIndex;
  /** Any CSS-legal color string. Common values: `"green"`, `"red"`, `"blue"`. */
  readonly color: string;
  /**
   * Optional palette key that lets the renderer resolve the arrow's
   * visual style (colour, stroke width, opacity) from a user-supplied
   * `ArrowColors` map at draw time. When absent, `color` is used as-is
   * and the modifier-key channels (`default`/`shift`/`alt`/`ctrl`)
   * continue to work.
   */
  readonly brush?: string;
  /** Optional text label. See {@link ArrowLabel}. */
  readonly label?: ArrowLabel;
  /** Optional custom SVG payload. See {@link ArrowCustomSvg}. */
  readonly customSvg?: ArrowCustomSvg;
  /**
   * When `true`, the arrow renders **beneath** the piece layer instead
   * of on top. Useful for "heatmap" tints that shouldn't occlude pieces
   * (analysis boards, pawn-structure overlays).
   */
  readonly below?: boolean;
  /**
   * Marks an arrow as owned by the application rather than the user.
   * "Managed" arrows survive the two reflex-clearing hooks
   * (`clearArrowsOnClick`, `clearArrowsOnMove`) — the idiomatic use-case
   * is an engine best-move hint on an analysis board, where the hint
   * should update when the position changes but ignore the user's
   * click-to-dismiss gesture on the board.
   *
   * User-drawn arrows (right-click gesture) always land with
   * `managed: false`; programmatic callers opt in explicitly.
   *
   * A nuclear `model.clearArrows()` still wipes managed arrows —
   * consumers who want a stricter partition call `clearUserArrows()`
   * instead. Default `false` (unset).
   */
  readonly managed?: boolean;
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
  readonly hash: ZobristKey | bigint;
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
