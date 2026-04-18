"use client";

/**
 * The top-level interactive board.
 *
 * Composes the static grid, piece layer, highlight layers, and coordinate
 * overlay into a single `position: relative; aspect-ratio: 1/1` container.
 * Theme variables are injected on this container via `useInsertionEffect`
 * so they beat first paint.
 *
 * The board is a client component. For a server-rendered static board
 * (zero client JS), import from `@ultrachess/react/server` (M5).
 */

import type { CSSProperties } from "react";
import { BoardGrid } from "./components/board-grid.js";
import { Coordinates } from "./components/coordinates.js";
import { LastMoveLayer, SelectionLayer } from "./components/highlight-layer.js";
import { PieceLayer } from "./components/piece-layer.js";
import { defaultTheme } from "./default-theme.js";
import { useClickToMove } from "./hooks/use-click-to-move.js";
import { defaultPieces } from "./pieces/default-pieces.js";
import type { ChessboardProps } from "./types.js";

/**
 * Interactive chess board.
 *
 * @example
 * ```tsx
 * "use client";
 * import { Chessboard, useChessGame } from "@ultrachess/react";
 *
 * export default function Board() {
 *   const game = useChessGame();
 *   return <Chessboard game={game} />;
 * }
 * ```
 */
export function Chessboard(props: ChessboardProps) {
  const {
    game,
    orientation = "white",
    theme = defaultTheme,
    pieces = defaultPieces,
    showCoordinates = true,
    showLegalTargets = "rings",
    highlightLastMove = true,
    onMove,
    renderSquare,
    style,
    className,
    ariaLabel,
  } = props;

  const handleSquareClick = useClickToMove(game, onMove);

  // Spread theme custom properties directly into the inline style so they are
  // available at first paint without needing an effect — SSR-safe, hydration-
  // clean, no CSSOM round-trip hazards across DOM environments.
  const containerStyle: CSSProperties = {
    position: "relative",
    aspectRatio: "1 / 1",
    width: "100%",
    ...(theme as CSSProperties),
    ...style,
  };

  return (
    <div className={className} style={containerStyle} data-ucr-orientation={orientation}>
      <BoardGrid
        orientation={orientation}
        onSquareClick={handleSquareClick}
        {...(renderSquare !== undefined ? { renderSquare } : {})}
        {...(ariaLabel !== undefined ? { ariaLabel } : {})}
      />
      {game !== null && highlightLastMove ? (
        <LastMoveLayer model={game} orientation={orientation} />
      ) : null}
      {game !== null ? (
        <SelectionLayer model={game} orientation={orientation} style={showLegalTargets} />
      ) : null}
      {game !== null ? (
        <PieceLayer model={game} orientation={orientation} pieces={pieces} />
      ) : null}
      {showCoordinates ? <Coordinates orientation={orientation} /> : null}
    </div>
  );
}
