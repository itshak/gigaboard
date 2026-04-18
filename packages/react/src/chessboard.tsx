"use client";

/**
 * The top-level interactive board.
 *
 * Composes the static grid, piece layer, highlight layers, coordinate
 * overlay, drag layer, arrow overlay, and promotion overlay into a single
 * `position: relative; aspect-ratio: 1/1` container. Theme variables are
 * written inline on the container so they land at first paint without
 * needing an effect — SSR-safe and hydration-clean.
 *
 * The board is a client component. For a server-rendered static board
 * (zero client JS), import from `@ultrachess/react/server` (M5).
 */

import type { BoardCell, PieceType, SquareIndex } from "@ultrachess/core";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { ArrowsLayer, type ArrowsLayerHandle } from "./components/arrows-layer.js";
import { BoardGrid } from "./components/board-grid.js";
import { CheckLayer } from "./components/check-layer.js";
import { Coordinates } from "./components/coordinates.js";
import { DragLayer } from "./components/drag-layer.js";
import { LastMoveLayer, SelectionLayer } from "./components/highlight-layer.js";
import { IllegalFlashLayer } from "./components/illegal-flash-layer.js";
import { PieceLayer } from "./components/piece-layer.js";
import { PremoveLayer } from "./components/premove-layer.js";
import { PromotionOverlay } from "./components/promotion-overlay.js";
import { defaultArrowColors, defaultTheme } from "./default-theme.js";
import { useAnimation } from "./hooks/use-animation.js";
import { useArrowGesture } from "./hooks/use-arrow-gesture.js";
import { useClickToMove } from "./hooks/use-click-to-move.js";
import { useDrag } from "./hooks/use-drag.js";
import { defaultPieces } from "./pieces/default-pieces.js";
import type { ArrowColors, ChessboardProps } from "./types.js";

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

/** Flash duration — must outlive the WAAPI animation in IllegalFlashLayer. */
const ILLEGAL_FLASH_HOLD_MS = 320;

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
    allowDrawingArrows = true,
    clearArrowsOnMove = true,
    clearArrowsOnClick = true,
    arrowColors,
    allowPremove = false,
    showCheckHighlight = true,
    showIllegalFlash = true,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragLayerRef = useRef<HTMLDivElement | null>(null);
  const arrowsLayerRef = useRef<ArrowsLayerHandle | null>(null);

  // Set to `true` whenever the next model commit is the result of a drag
  // (or a promotion dialog opened by a drag). `useAnimation` reads this
  // flag on each commit and skips the FLIP animation, because the piece
  // has already been positioned by the user's pointer. Reset to `false`
  // anywhere the move is abandoned (illegal drop, dialog cancel) so the
  // flag never leaks into a subsequent non-drag move.
  const skipNextAnimationRef = useRef(false);

  // Latest-ref pattern for user callbacks — keeps `useCallback`/`useEffect`
  // deps stable while still reading the newest prop values at call time.
  const onMoveRef = useRef(onMove);
  const onPromoteRef = useRef(onPromote);
  useEffect(() => {
    onMoveRef.current = onMove;
    onPromoteRef.current = onPromote;
  });

  // Merge user-provided arrow colours with defaults. Memoised to keep the
  // gesture hook's deps stable.
  const palette = useMemo<Required<ArrowColors>>(
    () => ({
      default: arrowColors?.default ?? defaultArrowColors.default,
      shift: arrowColors?.shift ?? defaultArrowColors.shift,
      alt: arrowColors?.alt ?? defaultArrowColors.alt,
      ctrl: arrowColors?.ctrl ?? defaultArrowColors.ctrl,
    }),
    [arrowColors?.default, arrowColors?.shift, arrowColors?.alt, arrowColors?.ctrl],
  );

  // Drag-layer active piece — null when idle, cell info during a drag.
  const [dragActive, setDragActive] = useState<{
    readonly from: SquareIndex;
    readonly cell: BoardCell;
  } | null>(null);

  // Promotion dialog state — null when no promotion is pending.
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(
    null,
  );

  // Illegal-flash state: the square to pulse red, cleared after a short hold.
  const [flashSquare, setFlashSquare] = useState<SquareIndex | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerIllegalFlash = useCallback(
    (square: SquareIndex): void => {
      if (!showIllegalFlash) return;
      setFlashSquare(square);
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => {
        setFlashSquare(null);
        flashTimerRef.current = null;
      }, ILLEGAL_FLASH_HOLD_MS);
    },
    [showIllegalFlash],
  );
  // Cancel any pending flash when the component unmounts.
  useEffect(
    () => () => {
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  /**
   * Auto-clear arrows when the game advances. Subscribes to `historyPly`
   * and wipes the arrow model on every increment. Toggled off by
   * `clearArrowsOnMove={false}`.
   */
  useEffect(() => {
    if (game === null || !clearArrowsOnMove) return;
    let prevPly = game.getSnapshot().historyPly;
    return game.subscribe(() => {
      const snap = game.getSnapshot();
      if (snap.historyPly > prevPly && snap.arrows.length > 0) {
        game.clearArrows();
      }
      prevPly = snap.historyPly;
    });
  }, [game, clearArrowsOnMove]);

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
          // A drag-initiated promotion that rejects must clear the skip
          // flag so the next non-drag move animates normally.
          skipNextAnimationRef.current = false;
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
        cancel: () => {
          // A drag-initiated promotion that's cancelled must reset the
          // skip flag — otherwise the *next* legitimate move would be
          // silently de-animated.
          skipNextAnimationRef.current = false;
          setPendingPromotion(null);
        },
      });
    },
    [game],
  );

  const clickToMove = useClickToMove(game, onMove, requestPromotion);

  /**
   * Clear any drawn arrows if `clearArrowsOnClick` is enabled. Called at
   * the start of every left-button interaction — click or drag-start —
   * and on Escape.
   */
  const maybeClearArrows = useCallback((): void => {
    if (!clearArrowsOnClick || game === null) return;
    if (game.getSnapshot().arrows.length > 0) game.clearArrows();
  }, [clearArrowsOnClick, game]);

  /** Click-to-move with the arrow-clearing side effect woven in. */
  const handleSquareClick = useCallback(
    (index: SquareIndex): void => {
      maybeClearArrows();
      clickToMove(index);
    },
    [maybeClearArrows, clickToMove],
  );

  /** Escape clears arrows (and is a natural analogue for "cancel"). */
  useEffect(() => {
    if (!clearArrowsOnClick || game === null) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") maybeClearArrows();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearArrowsOnClick, game, maybeClearArrows]);

  // Drag callbacks — each is stable across renders so `useDrag` doesn't
  // re-install its pointer listeners on every commit.
  //
  // - `flushSync` forces React to commit the drag-layer render before the
  //   pointer-move handler continues, so `dragLayerRef.current` is populated
  //   in time for the first transform write.
  // - Calling `game.selectSquare(from)` propagates the drag-source into the
  //   model so `SelectionLayer` shows legal targets while the piece is in
  //   flight — the same visual affordance click-to-move gets.
  // - `maybeClearArrows` runs at the same boundary so a drag is treated the
  //   same way as a click for arrow-clearing semantics.
  const onDragStart = useCallback(
    (from: SquareIndex, cell: BoardCell): void => {
      maybeClearArrows();
      flushSync(() => {
        setDragActive({ from, cell });
      });
      game?.selectSquare(from);
    },
    [game, maybeClearArrows],
  );
  const onDragEnd = useCallback((): void => {
    setDragActive(null);
    // Clear the selection regardless of whether the drop landed — on a
    // successful move `tryMove` has already nulled it; on cancel / illegal
    // drop the selection would otherwise linger with stale legal targets.
    //
    // Guarded because `useDrag`'s effect cleanup fires `onDragEnd` during
    // unmount, and the engine may already have been disposed by then.
    try {
      game?.selectSquare(null);
    } catch {
      // Engine disposed mid-teardown; nothing to do.
    }
  }, [game]);

  const onDrop = useCallback(
    (from: SquareIndex, to: SquareIndex): void => {
      if (game === null) return;
      const snap = game.getSnapshot();
      const fromCell = snap.board[from] ?? 0;
      const pieceColour = colorOfCell(fromCell);

      // Not our turn? Queue as a premove if allowed; otherwise reject with
      // the same red flash any other illegal move gets. Silently dropping
      // the attempt was the default-true M4 behaviour but left users
      // confused ("a blue ghost appeared from nowhere").
      if (fromCell !== 0 && pieceColour !== snap.turn) {
        if (!allowPremove) {
          triggerIllegalFlash(from);
          return;
        }
        // Premove promotion auto-queens (lichess convention) — the user
        // isn't given a dialog here because it's not their turn yet.
        const promotion = movePromotesPawn(fromCell, to)
          ? (4 as PieceType) /* Queen */
          : undefined;
        game.queuePremove(
          promotion === undefined
            ? { from, to }
            : { from, to, promotion },
        );
        return;
      }

      // Drag-initiated → skip the next FLIP animation. The promotion and
      // happy paths both consume this flag; on failure we reset it so it
      // doesn't leak into a later, unrelated move.
      skipNextAnimationRef.current = true;

      if (movePromotesPawn(fromCell, to) && game.isLegal(from, to, 4 /* Queen */)) {
        requestPromotion(from, to);
        return;
      }

      const played = game.tryMove(from, to);
      const cb = onMoveRef.current;
      if (played !== null) {
        if (cb !== undefined) cb(played);
      } else {
        skipNextAnimationRef.current = false;
        triggerIllegalFlash(from);
      }
    },
    [game, requestPromotion, allowPremove, triggerIllegalFlash],
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

  useArrowGesture({
    game,
    orientation,
    containerRef,
    arrowsLayerRef,
    enabled: allowDrawingArrows && game !== null,
    palette,
  });

  useAnimation(game, containerRef, orientation, animation ?? {}, {
    skipNextRef: skipNextAnimationRef,
  });

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
        onSquareClick={handleSquareClick}
        {...(renderSquare !== undefined ? { renderSquare } : {})}
        {...(ariaLabel !== undefined ? { ariaLabel } : {})}
      />
      {game !== null && highlightLastMove ? (
        <LastMoveLayer model={game} orientation={orientation} />
      ) : null}
      {game !== null && showCheckHighlight ? (
        <CheckLayer model={game} orientation={orientation} />
      ) : null}
      {game !== null ? (
        <SelectionLayer model={game} orientation={orientation} style={showLegalTargets} />
      ) : null}
      {game !== null ? (
        <PremoveLayer model={game} orientation={orientation} pieces={pieces} />
      ) : null}
      {game !== null ? (
        <PieceLayer model={game} orientation={orientation} pieces={pieces} />
      ) : null}
      <DragLayer ref={dragLayerRef} active={dragActive} pieces={pieces} />
      {game !== null ? (
        <ArrowsLayer ref={arrowsLayerRef} model={game} orientation={orientation} />
      ) : null}
      {showCoordinates ? <Coordinates orientation={orientation} /> : null}
      <IllegalFlashLayer at={flashSquare} orientation={orientation} />
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
