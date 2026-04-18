/**
 * Public types for `@ultrachess/react`.
 *
 * These describe the prop surface a consumer sees when they import
 * `<Chessboard/>` or any of the exposed hooks. Runtime helpers live with
 * their respective modules; this file is types-only.
 */

import type { BoardCell, BoardModel, PackedMove, SquareIndex } from "@ultrachess/core";
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
