"use client";

/**
 * The top-level interactive board.
 *
 * Composes the static grid, piece layer, highlight layers, coordinate
 * overlay, drag layer, and promotion overlay into a single
 * `position: relative; aspect-ratio: 1/1` container. Theme variables are
 * written inline on the container so they land at first paint without
 * needing an effect — SSR-safe and hydration-clean.
 *
 * The board is a client component. For a server-rendered static board
 * (zero client JS), import from `@ultrachess/react/server` (M5).
 */

import type { BoardCell, PieceType, SquareIndex } from "@ultrachess/core";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { BoardGrid } from "./components/board-grid.js";
import { Coordinates } from "./components/coordinates.js";
import { DragLayer } from "./components/drag-layer.js";
import { LastMoveLayer, SelectionLayer } from "./components/highlight-layer.js";
import { PieceLayer } from "./components/piece-layer.js";
import { PromotionOverlay } from "./components/promotion-overlay.js";
import { defaultTheme } from "./default-theme.js";
import { useAnimation } from "./hooks/use-animation.js";
import { useClickToMove } from "./hooks/use-click-to-move.js";
import { useDrag } from "./hooks/use-drag.js";
import { defaultPieces } from "./pieces/default-pieces.js";
import type { ChessboardProps } from "./types.js";

/** Internal record describing a pending promotion. */
interface PendingPromotion {
  readonly from: SquareIndex;
  readonly to: SquareIndex;
  readonly color: 0 | 1;
  readonly resolve: (piece: PieceType) => void;
  readonly cancel: () => void;
}

/** Interior colour-of from a cell code. Empty cell returns `0` defensively. */
function colorOfCell(cell: number): 0 | 1 {
  return (cell > 6 ? 1 : 0) as 0 | 1;
}

/** Is `(from → to)` a pawn promotion given the current position? */
function movePromotesPawn(fromCell: number, to: SquareIndex): boolean {
  if (fromCell === 0) return false;
  const pieceType = (fromCell - 1) % 6;
  if (pieceType !== 0 /* Pawn */) return false;
  const toRank = to >> 3;
  return toRank === 0 || toRank === 7;
}

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
    onPromote,
    renderSquare,
    style,
    className,
    ariaLabel,
    animation,
    allowDrag = true,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragLayerRef = useRef<HTMLDivElement | null>(null);

  // Latest-ref pattern for user callbacks. Keeps `useCallback`/`useEffect`
  // deps stable while still reading the newest prop values at call time —
  // prevents the listener-tear-down/re-install thrash that would otherwise
  // follow every unrelated re-render.
  const onMoveRef = useRef(onMove);
  const onPromoteRef = useRef(onPromote);
  useEffect(() => {
    onMoveRef.current = onMove;
    onPromoteRef.current = onPromote;
  });

  // Drag-layer active piece — null when idle, cell info during a drag.
  const [dragActive, setDragActive] = useState<{
    readonly from: SquareIndex;
    readonly cell: BoardCell;
  } | null>(null);

  // Promotion dialog state — null when no promotion is pending.
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(
    null,
  );

  /**
   * Kick off promotion resolution. Uses the caller-provided `onPromote`
   * prop when present, otherwise opens the built-in overlay.
   */
  const requestPromotion = useCallback(
    (from: SquareIndex, to: SquareIndex): void => {
      if (game === null) return;
      const fromCell = game.getSnapshot().board[from] ?? 0;
      const color = colorOfCell(fromCell);

      const completeMove = (piece: PieceType): void => {
        const played = game.tryMove(from, to, piece);
        const cb = onMoveRef.current;
        if (played !== null && cb !== undefined) cb(played);
      };

      const promoteHandler = onPromoteRef.current;
      if (promoteHandler !== undefined) {
        // Caller owns the UI. Resolve through their promise.
        Promise.resolve(promoteHandler({ from, to, color })).then(completeMove, () => {
          // Rejected → abandon the move. Board remains in its pre-move state.
        });
        return;
      }

      // Built-in overlay: rendered below via `pendingPromotion`.
      setPendingPromotion({
        from,
        to,
        color,
        resolve: (piece) => {
          setPendingPromotion(null);
          completeMove(piece);
        },
        cancel: () => setPendingPromotion(null),
      });
    },
    [game],
  );

  const handleClickToMove = useClickToMove(game, onMove, requestPromotion);

  // Drag callbacks — each is stable across renders so `useDrag` doesn't
  // re-install its pointer listeners on every commit. `flushSync` forces
  // React to commit the drag-layer render before the pointer-move handler
  // continues, so `dragLayerRef.current` is populated in time for the first
  // transform write.
  const onDragStart = useCallback(
    (from: SquareIndex, cell: BoardCell): void => {
      flushSync(() => {
        setDragActive({ from, cell });
      });
    },
    [],
  );
  const onDragEnd = useCallback((): void => {
    setDragActive(null);
  }, []);
  const onDrop = useCallback(
    (from: SquareIndex, to: SquareIndex): void => {
      if (game === null) return;
      const snap = game.getSnapshot();
      const fromCell = snap.board[from] ?? 0;
      if (movePromotesPawn(fromCell, to) && game.isLegal(from, to, 4 /* Queen */)) {
        requestPromotion(from, to);
        return;
      }
      const played = game.tryMove(from, to);
      const cb = onMoveRef.current;
      if (played !== null && cb !== undefined) cb(played);
    },
    [game, requestPromotion],
  );

  useDrag({
    game,
    orientation,
    containerRef,
    dragLayerRef,
    enabled: allowDrag && game !== null,
    onDragStart,
    onDragEnd,
    onDrop,
  });

  useAnimation(game, containerRef, orientation, animation ?? {});

  // Inline theme variables → available at first paint.
  const containerStyle: CSSProperties = {
    position: "relative",
    aspectRatio: "1 / 1",
    width: "100%",
    touchAction: "none", // let the drag layer own pan gestures
    ...(theme as CSSProperties),
    ...style,
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={containerStyle}
      data-ucr-orientation={orientation}
    >
      <BoardGrid
        orientation={orientation}
        onSquareClick={handleClickToMove}
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
      <DragLayer ref={dragLayerRef} active={dragActive} pieces={pieces} />
      {showCoordinates ? <Coordinates orientation={orientation} /> : null}
      {pendingPromotion !== null ? (
        <PromotionOverlay
          from={pendingPromotion.from}
          to={pendingPromotion.to}
          color={pendingPromotion.color}
          orientation={orientation}
          pieces={pieces}
          onSelect={pendingPromotion.resolve}
          onCancel={pendingPromotion.cancel}
        />
      ) : null}
    </div>
  );
}
