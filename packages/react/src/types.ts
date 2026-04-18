/**
 * Public types for `@ultrachess/react`.
 *
 * These describe the prop surface a consumer sees when they import
 * `<Chessboard/>` or any of the exposed hooks. Runtime helpers live with
 * their respective modules; this file is types-only.
 */

import type {
  BoardCell,
  BoardModel,
  PackedMove,
  PieceType,
  SquareIndex,
} from "@ultrachess/core";
import type { CSSProperties, ReactNode } from "react";

/** Which way the board is facing. */
export type Orientation = "white" | "black";

/** CSS custom-property record (e.g. `{ "--ucr-sq-light": "#f0d9b5" }`). */
export type Theme = Readonly<Record<string, string>>;

/** How legal-target squares are visualised when a piece is selected. */
export type LegalTargetStyle = "rings" | "dots" | false;

/**
 * Renderer for a single piece. Given the packed board cell and its square,
 * return a React node positioned inside a 12.5% × 12.5% slot of the board.
 *
 * @remarks
 * Renderers must be pure and referentially stable — returning a new element
 * tree on every call forces per-commit re-rendering. Prefer memoised results
 * or stateless SVG/Unicode glyphs.
 */
export type PieceRenderer = (args: {
  readonly cell: BoardCell;
  readonly square: SquareIndex;
}) => ReactNode;

/** Context passed to a user-supplied `renderSquare` override. */
export interface SquareContext {
  readonly index: SquareIndex;
  readonly isLight: boolean;
  readonly label: string;
}

/** Context passed to a user-supplied `onPromote` callback. */
export interface PromotionContext {
  readonly from: SquareIndex;
  readonly to: SquareIndex;
  /** Colour of the promoting pawn (0 = white, 1 = black). */
  readonly color: 0 | 1;
}

/**
 * Configuration for the piece-glide animations played after every move.
 *
 * Animations run entirely on the compositor via the Web Animations API —
 * they never re-enter React. Honours `prefers-reduced-motion: reduce` by
 * collapsing the duration to zero regardless of the configured value.
 */
export interface AnimationOptions {
  /** Glide duration in ms. Default `180`. Set to `0` to disable. */
  readonly durationMs?: number;
  /** CSS easing curve. Default `cubic-bezier(0.22, 0.61, 0.36, 1)` (ease-out). */
  readonly easing?: string;
}

/** Props accepted by the top-level `<Chessboard/>` component. */
export interface ChessboardProps {
  /**
   * The board model produced by {@link useChessGame}. Pass `null` during
   * initial async engine load — the board renders a visually-identical but
   * pieceless placeholder.
   */
  readonly game: BoardModel | null;

  /** Board orientation (defaults to `"white"`). */
  readonly orientation?: Orientation;

  /**
   * Theme as a CSS custom-property record. Import from `@ultrachess/themes/*`.
   * When omitted the default built-in theme (brown) is applied.
   */
  readonly theme?: Theme;

  /**
   * Piece renderer. Defaults to the bundled Unicode glyph set; callers
   * typically swap in an SVG set from `@ultrachess/pieces`.
   */
  readonly pieces?: PieceRenderer;

  /** Show algebraic coordinate labels on the edges. Default `true`. */
  readonly showCoordinates?: boolean;

  /** Style for legal-target square highlights. Default `"rings"`. */
  readonly showLegalTargets?: LegalTargetStyle;

  /** Highlight the from / to squares of the most recent move. Default `true`. */
  readonly highlightLastMove?: boolean;

  /** Called after every successful move; receives the packed `Move`. */
  readonly onMove?: (move: PackedMove) => void;

  /**
   * Called when a pawn needs to promote. Return (or resolve) the chosen
   * {@link PieceType}. If omitted, the built-in promotion overlay is shown.
   *
   * The returned promise may be rejected (e.g. user clicks outside the
   * dialog) — in that case the move is abandoned and the board returns to
   * the pre-drag state.
   */
  readonly onPromote?: (ctx: PromotionContext) => PieceType | Promise<PieceType>;

  /** Animation configuration. Passes through to the WAAPI glide runner. */
  readonly animation?: AnimationOptions;

  /**
   * Whether drag-and-drop is enabled. When `false`, click-to-move still
   * works but the board ignores pointer-down initiated drags. Default `true`.
   */
  readonly allowDrag?: boolean;

  /**
   * Escape hatch for custom per-square overlays. The callback receives the
   * square's coordinate and colour and must return a React node that will
   * render inside the square (absolute-positioned, covering 100% × 100%).
   */
  readonly renderSquare?: (ctx: SquareContext) => ReactNode;

  /**
   * Optional container style overrides. Applied to the outermost board
   * element; CSS variables injected by the theme are written on the same
   * element so inline styles declared here can reference them.
   */
  readonly style?: CSSProperties;

  /** Optional class name on the outer container. */
  readonly className?: string;

  /** Accessible label for the board (`aria-label`). Default "Chess board". */
  readonly ariaLabel?: string;
}

/** Options forwarded to {@link useChessGame} on first mount. */
export interface UseChessGameOptions {
  /** Starting FEN. Defaults to `ultrachess`'s standard starting position. */
  readonly fen?: string;
}
