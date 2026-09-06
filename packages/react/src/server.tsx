/**
 * `gigaboard/server` — server-only static board.
 *
 * Ships **zero** client JavaScript. No hooks, no state, no event handlers,
 * no imports of any client module. Imports only:
 *
 * - `default-theme.ts`
 * - `default-pieces.tsx`
 * - `types.ts` (types only)
 *
 * Perfect for PGN viewers, position diagrams in blog posts, shareable
 * board URLs, and anywhere a board doesn't need interaction. Renders
 * produce identical markup between Node and the browser so they hydrate
 * cleanly under an interactive `<Chessboard/>` if you later attach one.
 *
 * @example
 * ```tsx
 * import { StaticChessboard } from "gigaboard/server";
 *
 * export default function Page() {
 *   return (
 *     <StaticChessboard fen="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1" />
 *   );
 * }
 * ```
 */

import type { BoardCell, SquareIndex } from "@gigaboard/core";
import type { CSSProperties, ReactNode } from "react";
import { CSS_VARS, defaultTheme } from "./default-theme.js";
import { parseFenPlacement } from "./fen.js";
import { defaultPieces } from "./pieces/default-pieces.js";
import type { Orientation, PieceRenderer, Theme } from "./types.js";

/* ============================================================ geometry */

function algebraicOf(index: SquareIndex): string {
  const file = index & 7;
  const rank = index >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

function positionOf(index: SquareIndex, orientation: Orientation): { x: number; y: number } {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { x: col * 12.5, y: row * 12.5 };
}

/* ============================================================ component */

/** Props for {@link StaticChessboard}. */
export interface StaticChessboardProps {
  /** Piece-placement FEN (first whitespace-delimited field is enough). */
  readonly fen: string;

  /** Board orientation. Defaults to `"white"`. */
  readonly orientation?: Orientation;

  /** Theme — defaults to the green palette from `@gigaboard/themes`. */
  readonly theme?: Theme;

  /** Piece renderer — defaults to the `neo` set from `@gigaboard/pieces`. */
  readonly pieces?: PieceRenderer;

  /** Show algebraic coordinate labels on the edges. Default `true`. */
  readonly showCoordinates?: boolean;

  /** Optional container style overrides. */
  readonly style?: CSSProperties;

  /** Optional class name on the outer container. */
  readonly className?: string;

  /** Accessible label. Default `"Chess position"`. */
  readonly ariaLabel?: string;
}

/**
 * Static board for server rendering. No interactivity; no client JS
 * shipped. Exactly the same visual layout as the interactive
 * `<Chessboard/>`, so a static SSR board can be swapped for an
 * interactive one on hydration without the markup shifting.
 */
export function StaticChessboard(props: StaticChessboardProps): ReactNode {
  const {
    fen,
    orientation = "white",
    theme = defaultTheme,
    pieces = defaultPieces,
    showCoordinates = true,
    style,
    className,
    ariaLabel = "Chess position",
  } = props;

  const board = parseFenPlacement(fen);
  const squares = buildSquareOrder(orientation);

  const containerStyle: CSSProperties = {
    position: "relative",
    aspectRatio: "1 / 1",
    width: "100%",
    ...(theme as CSSProperties),
    ...style,
  };

  return (
    <div
      className={className}
      style={containerStyle}
      data-gb-orientation={orientation}
      data-gb-static="true"
    >
      {/* 8×8 grid of static squares — no event handlers, no tabindex. */}
      <div
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={8}
        aria-colcount={8}
        aria-readonly="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
        }}
      >
        {squares.map((index) => {
          const file = index & 7;
          const rank = index >> 3;
          const isLight = (file + rank) % 2 === 1;
          return (
            <div
              key={index}
              role="gridcell"
              aria-label={algebraicOf(index)}
              aria-rowindex={rank + 1}
              aria-colindex={file + 1}
              data-square={algebraicOf(index)}
              data-light={isLight ? "true" : "false"}
              style={{
                background: `var(${isLight ? CSS_VARS.SQ_LIGHT : CSS_VARS.SQ_DARK})`,
                userSelect: "none",
                containerType: "size",
              }}
            />
          );
        })}
      </div>

      {/* Piece overlay — one div per occupied square. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: 64 }, (_, i) => {
          const cell = board[i] as BoardCell;
          if (cell === 0) return null;
          const idx = i as SquareIndex;
          const square = algebraicOf(idx);
          const { x, y } = positionOf(idx, orientation);
          return (
            <div
              key={square}
              data-piece-square={square}
              data-piece-cell={cell}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: "12.5%",
                height: "12.5%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                containerType: "size",
              }}
            >
              {pieces({ cell, square: idx })}
            </div>
          );
        })}
      </div>

      {showCoordinates ? <StaticCoordinates orientation={orientation} /> : null}
    </div>
  );
}

/* ======================================================== subsidiary helpers */

/** Same rank-first ordering used by the interactive BoardGrid. */
function buildSquareOrder(orientation: Orientation): SquareIndex[] {
  const squares: SquareIndex[] = [];
  if (orientation === "white") {
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        squares.push((rank * 8 + file) as SquareIndex);
      }
    }
  } else {
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 7; file >= 0; file--) {
        squares.push((rank * 8 + file) as SquareIndex);
      }
    }
  }
  return squares;
}

const FILE_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Pure coordinate overlay — identical output to the interactive version. */
function StaticCoordinates({ orientation }: { orientation: Orientation }): ReactNode {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontSize: "min(1.6vmin, 11px)",
        fontWeight: 600,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {FILE_LETTERS.map((letter, idx) => {
        const col = orientation === "white" ? idx : 7 - idx;
        const bottomRank = orientation === "white" ? 0 : 7;
        const isLightSquare = (col + bottomRank) % 2 === 1;
        return (
          <span
            key={`file-${letter}`}
            style={{
              position: "absolute",
              left: `${col * 12.5 + 10}%`,
              bottom: "1%",
              color: `var(${isLightSquare ? CSS_VARS.COORDINATE_LIGHT : CSS_VARS.COORDINATE_DARK})`,
            }}
          >
            {letter}
          </span>
        );
      })}
      {FILE_LETTERS.map((_, idx) => {
        const rank = idx;
        const row = orientation === "white" ? 7 - rank : rank;
        const leftFile = orientation === "white" ? 0 : 7;
        const isLightSquare = (leftFile + rank) % 2 === 1;
        return (
          <span
            key={`rank-${rank}`}
            style={{
              position: "absolute",
              top: `${row * 12.5 + 1}%`,
              left: "1%",
              color: `var(${isLightSquare ? CSS_VARS.COORDINATE_LIGHT : CSS_VARS.COORDINATE_DARK})`,
            }}
          >
            {rank + 1}
          </span>
        );
      })}
    </div>
  );
}
