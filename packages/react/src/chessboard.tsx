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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowsLayer, type ArrowsLayerHandle } from "./components/arrows-layer.js";
import { BoardGrid } from "./components/board-grid.js";
import { CheckLayer } from "./components/check-layer.js";
import { Coordinates } from "./components/coordinates.js";
import { DragLayer, type DragLayerHandle } from "./components/drag-layer.js";
import { IllegalFlashLayer } from "./components/illegal-flash-layer.js";
import { LiveRegion } from "./components/live-region.js";
import { PieceLayer } from "./components/piece-layer.js";
import { PremoveLayer } from "./components/premove-layer.js";
import { PromotionOverlay } from "./components/promotion-overlay.js";
import { StaticPieceLayer } from "./components/static-piece-layer.js";
import { defaultArrowColors, defaultTheme } from "./default-theme.js";
import { parseFenPlacement } from "./fen.js";
import { AnimationRunner } from "./hooks/use-animation.js";
import { useArrowGesture } from "./hooks/use-arrow-gesture.js";
import { useClickToMove } from "./hooks/use-click-to-move.js";
import { useCursorController } from "./hooks/use-cursor-controller.js";
import { useDrag } from "./hooks/use-drag.js";
import { useHoverSquare } from "./hooks/use-hover-square.js";
import { useKeyboardNav } from "./hooks/use-keyboard-nav.js";
import { useLastMoveController } from "./hooks/use-last-move-controller.js";
import { type MoveHapticOptions, useMoveHaptics } from "./hooks/use-move-haptics.js";
import { type MoveSoundOptions, useMoveSound } from "./hooks/use-move-sound.js";
import { useSelectionController } from "./hooks/use-selection-controller.js";
import { getSquareAtPoint } from "./lib/geometry.js";
import { classifyMoveFeedback } from "./lib/move-feedback.js";
import { defaultPieces } from "./pieces/default-pieces.js";
import type {
  AnimationOptions,
  ArrowColors,
  ChessboardProps,
  Orientation,
  PositionTransition,
  ResolvedArrowPalette,
} from "./types.js";

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

const DEFAULT_POSITION_SYNC_DURATION_MS = 60;
const DEFAULT_POSITION_SYNC_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";
const UCI_TRANSITION_RE = /^([a-h][1-8])([a-h][1-8])([nbrq])?$/i;

interface SquareTransition {
  readonly from: string;
  readonly to: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function cancelElementAnimations(element: HTMLElement): void {
  if (typeof element.getAnimations !== "function") return;
  for (const anim of element.getAnimations()) anim.cancel();
}

function queryPieceAt(container: HTMLElement, square: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-piece-square="${square}"]`);
}

function squareIndexOfName(square: string): SquareIndex {
  const file = square.charCodeAt(0) - 0x61;
  const rank = Number(square[1]) - 1;
  return ((rank << 3) | file) as SquareIndex;
}

function deltaFromSquareNames(
  from: string,
  to: string,
  squareSize: number,
  orientation: Orientation,
): { dx: number; dy: number } {
  const fromIndex = squareIndexOfName(from);
  const toIndex = squareIndexOfName(to);
  const fromFile = fromIndex & 7;
  const fromRank = fromIndex >> 3;
  const toFile = toIndex & 7;
  const toRank = toIndex >> 3;
  const fromCol = orientation === "white" ? fromFile : 7 - fromFile;
  const fromRow = orientation === "white" ? 7 - fromRank : fromRank;
  const toCol = orientation === "white" ? toFile : 7 - toFile;
  const toRow = orientation === "white" ? 7 - toRank : toRank;
  return {
    dx: (fromCol - toCol) * squareSize,
    dy: (fromRow - toRow) * squareSize,
  };
}

function castleRookTransition(from: string, to: string): SquareTransition | null {
  const fromFile = from.charCodeAt(0);
  const toFile = to.charCodeAt(0);
  if (fromFile !== 0x65 /* e */ || Math.abs(toFile - fromFile) !== 2) return null;
  const rank = from[1];
  if (rank !== "1" && rank !== "8") return null;
  const kingSide = toFile > fromFile;
  return {
    from: `${kingSide ? "h" : "a"}${rank}`,
    to: `${kingSide ? "f" : "d"}${rank}`,
  };
}

function transitionSquares(transition: PositionTransition): SquareTransition[] {
  const parsed = UCI_TRANSITION_RE.exec(transition.uci.trim().toLowerCase());
  if (parsed === null) return [];

  const moveFrom = parsed[1] ?? "";
  const moveTo = parsed[2] ?? "";
  const forward: SquareTransition[] = [{ from: moveFrom, to: moveTo }];
  const rook = castleRookTransition(moveFrom, moveTo);
  if (rook !== null) forward.push(rook);

  return transition.direction === "forward"
    ? forward
    : forward.map((item) => ({ from: item.to, to: item.from }));
}

function schedulePositionAnimation(
  container: HTMLElement,
  transitions: readonly SquareTransition[],
  options: Required<AnimationOptions>,
  orientation: Orientation,
): void {
  const animate = (): void => {
    const rect = container.getBoundingClientRect();
    const squareSize = rect.width / 8;
    if (squareSize <= 0) return;

    for (const item of transitions) {
      const piece = queryPieceAt(container, item.to);
      if (piece === null || typeof piece.animate !== "function") continue;
      const { dx, dy } = deltaFromSquareNames(item.from, item.to, squareSize, orientation);
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

      cancelElementAnimations(piece);
      piece.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: options.durationMs, easing: options.easing, fill: "none" },
      );
    }
  };

  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(animate);
  } else {
    window.setTimeout(animate, 0);
  }
}

function syncPositionFen(
  game: NonNullable<ChessboardProps["game"]>,
  targetFen: string,
  transition: PositionTransition | null | undefined,
  managedArrows: ChessboardProps["managedArrows"],
  preserveUserArrows: boolean | undefined,
  container: HTMLElement | null,
  animation: AnimationOptions | undefined,
  orientation: Orientation,
): boolean {
  const positionChanged = game.engine.fen() !== targetFen;
  const durationMs = animation?.durationMs ?? DEFAULT_POSITION_SYNC_DURATION_MS;
  const easing = animation?.easing ?? DEFAULT_POSITION_SYNC_EASING;
  const shouldAnimate =
    positionChanged &&
    transition !== null &&
    transition !== undefined &&
    container !== null &&
    durationMs > 0 &&
    !prefersReducedMotion();

  const transitions: SquareTransition[] = [];
  if (shouldAnimate) {
    for (const item of transitionSquares(transition)) {
      if (queryPieceAt(container, item.from) !== null) transitions.push(item);
    }
  }

  try {
    if (managedArrows === undefined) {
      if (!positionChanged) return false;
      game.load(targetFen);
    } else {
      game.syncPosition({
        fen: targetFen,
        managedArrows,
        preserveUserArrows: preserveUserArrows === true,
      });
    }
  } catch {
    return false;
  }

  if (transitions.length > 0 && container !== null) {
    schedulePositionAnimation(container, transitions, { durationMs, easing }, orientation);
  }
  return positionChanged;
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
    fallbackFen,
    positionFen,
    positionTransition = null,
    managedArrows,
    preserveUserArrowsOnPositionSync,
    orientation = "white",
    theme = defaultTheme,
    pieces = defaultPieces,
    showCoordinates = true,
    ranksPosition = "left",
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
    snapArrowsToValidMove = false,
    allowPremove = false,
    showCheckHighlight = true,
    showIllegalFlash = true,
    sound = true,
    haptics = false,
    viewOnly = false,
    canDragPiece,
    onSquareMouseEnter,
    onSquareMouseLeave,
    disableContextMenu = true,
  } = props;

  // Every interactive subsystem consults these resolved flags. Keeping
  // the resolution here — rather than inlining `!viewOnly && …` at each
  // call site — makes the blast radius of `viewOnly` explicit, keeps
  // dependency arrays stable, and means the branch is evaluated once
  // per render instead of once per consumer.
  const dragEnabled = allowDrag && !viewOnly;
  const arrowGestureEnabled = allowDrawingArrows && !viewOnly;
  const clickToMoveEnabled = !viewOnly;
  const keyboardNavEnabled = !viewOnly;

  // Parse the fallback FEN at most once per distinct string. The 64-byte
  // output is passed into `<StaticPieceLayer/>` only while `game` is null;
  // once a real model arrives the interactive `<PieceLayer/>` takes over.
  // Parsing costs a few µs so the memoisation is about render-identity,
  // not speed — `StaticPieceLayer` memos on the array reference.
  const fallbackBoard = useMemo<Uint8Array | null>(() => {
    if (fallbackFen === undefined || fallbackFen === "") return null;
    try {
      return parseFenPlacement(fallbackFen);
    } catch {
      // Malformed FEN → fall back to a pieceless board rather than
      // throwing out of a render. The console warning would be noisy
      // in tests; silent no-op is the least-surprising behaviour.
      return null;
    }
  }, [fallbackFen]);

  // Normalise `sound` (boolean | options) into a concrete options object.
  // Memoised so `useMoveSound` doesn't rebuild its audio pool on every
  // render when the caller passes a raw object literal.
  const soundOptions = useMemo<MoveSoundOptions>(() => {
    if (sound === true) return { enabled: true };
    if (sound === false || sound === undefined) return { enabled: false };
    return sound;
  }, [sound]);

  const hapticOptions = useMemo<MoveHapticOptions>(() => {
    if (haptics === true) return { enabled: true };
    if (haptics === false || haptics === undefined) return { enabled: false };
    return haptics;
  }, [haptics]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragLayerRef = useRef<DragLayerHandle | null>(null);
  const arrowsLayerRef = useRef<ArrowsLayerHandle | null>(null);
  const lastControlledFeedbackFenRef = useRef<string | null>(null);

  // 64-slot refs array populated by each `<Square/>` on mount. The
  // selection controller reads this to paint highlights imperatively.
  const squareRefs = useRef<Array<HTMLElement | null>>(new Array(64).fill(null));
  const setSquareRef = useCallback((index: SquareIndex, el: HTMLElement | null) => {
    squareRefs.current[index] = el;
  }, []);

  // Set to `true` whenever the next model commit is the result of a drag
  // (or a promotion dialog opened by a drag). `<AnimationRunner/>` reads
  // this flag on each commit and skips the FLIP animation, because the
  // piece has already been positioned by the user's pointer. Reset to
  // `false` anywhere the move is abandoned (illegal drop, dialog cancel)
  // so the flag never leaks into a subsequent non-drag move.
  const skipNextAnimationRef = useRef(false);

  // Latest-ref pattern for user callbacks — keeps `useCallback`/`useEffect`
  // deps stable while still reading the newest prop values at call time.
  const onMoveRef = useRef(onMove);
  const onPromoteRef = useRef(onPromote);
  useEffect(() => {
    onMoveRef.current = onMove;
    onPromoteRef.current = onPromote;
  });

  // Move feedback effects. The hooks subscribe to normal model moves and
  // also expose direct triggers for controlled `positionFen` syncs below.
  const triggerMoveSound = useMoveSound(game, soundOptions);
  const triggerMoveHaptic = useMoveHaptics(game, hapticOptions);

  useLayoutEffect(() => {
    if (game === null || positionFen === undefined || positionFen === "") return;
    const previousFeedbackFen = lastControlledFeedbackFenRef.current;
    if (game.engine.fen() === positionFen && managedArrows === undefined) {
      lastControlledFeedbackFenRef.current = positionFen;
      return;
    }
    const positionChanged = syncPositionFen(
      game,
      positionFen,
      positionTransition,
      managedArrows,
      preserveUserArrowsOnPositionSync,
      containerRef.current,
      animation,
      orientation,
    );
    lastControlledFeedbackFenRef.current = positionFen;

    if (!positionChanged || previousFeedbackFen === null || previousFeedbackFen === positionFen) {
      return;
    }

    const snapshot = game.getSnapshot();
    triggerMoveSound(classifyMoveFeedback(game.lastAnimations, snapshot, soundOptions.perspective));
    triggerMoveHaptic(
      classifyMoveFeedback(game.lastAnimations, snapshot, hapticOptions.perspective),
    );
  }, [
    animation,
    game,
    hapticOptions.perspective,
    positionFen,
    positionTransition,
    managedArrows,
    preserveUserArrowsOnPositionSync,
    orientation,
    soundOptions.perspective,
    triggerMoveHaptic,
    triggerMoveSound,
  ]);

  // Merge user-provided arrow colours with defaults. Memoised against
  // the whole `arrowColors` reference so consumers who pass a stable
  // object literal don't thrash the gesture hook's deps; callers who
  // recreate it each render pay one shallow-copy per commit — cheap.
  // Extra user-defined brush keys flow through alongside the four
  // modifier channels that always get defaults applied.
  const palette = useMemo<ResolvedArrowPalette>(() => {
    const merged: { [k: string]: string } = {
      default: defaultArrowColors.default,
      shift: defaultArrowColors.shift,
      alt: defaultArrowColors.alt,
      ctrl: defaultArrowColors.ctrl,
    };
    if (arrowColors !== undefined) {
      for (const k in arrowColors) {
        const v = (arrowColors as ArrowColors)[k];
        if (v !== undefined) merged[k] = v;
      }
    }
    return merged as ResolvedArrowPalette;
  }, [arrowColors]);

  // Drag state used to live here as `useState` + `flushSync` on
  // drag-start. It's gone now: the `<DragLayer/>` below is always
  // mounted (hidden) and exposes an imperative handle that `useDrag`
  // drives from its pointer handlers. This keeps the drag-start
  // pointer-move handler off React's critical path entirely, closing
  // the drag-peak-frame gap with chessground.

  // Promotion dialog state — null when no promotion is pending.
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  // Keyboard-focus state for the roving tabindex. `null` means the board
  // hasn't been focused yet — Tabbing into it takes the user to the
  // square picked by `initialKeyboardFocusSquare` (below), or e2 for
  // a white-oriented board.
  const [focusedSquare, setFocusedSquare] = useState<SquareIndex | null>(null);
  // Visual bottom-left square given the current orientation: e2-ish for
  // white (a good default landing spot near the kingside piece the user
  // most often moves first), a7-ish for black.
  const defaultKeyboardFocus = useCallback(
    (): SquareIndex => (orientation === "white" ? 12 : 52) as SquareIndex,
    [orientation],
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
   * and wipes the *user-drawn* arrows on every increment. Arrows marked
   * `managed: true` (engine hints, programmatic annotations) survive so
   * an analysis board can keep its best-move arrow current across the
   * move that replaces it. Toggled off by `clearArrowsOnMove={false}`.
   */
  useEffect(() => {
    if (game === null || !clearArrowsOnMove) return;
    let prevPly = game.getSnapshot().historyPly;
    return game.subscribe(() => {
      const snap = game.getSnapshot();
      if (snap.historyPly > prevPly && snap.arrows.length > 0) {
        game.clearUserArrows();
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

  const clickToMove = useClickToMove(game, onMove, requestPromotion, clickToMoveEnabled);

  /**
   * Clear any drawn arrows if `clearArrowsOnClick` is enabled. Called at
   * the start of every left-button interaction — click or drag-start —
   * and on Escape.
   */
  const maybeClearArrows = useCallback((): void => {
    if (!clearArrowsOnClick || game === null) return;
    // Managed arrows (engine hints) are deliberately preserved — the
    // user's left-click should dismiss their own annotations only, not
    // the app's.
    if (game.getSnapshot().arrows.length > 0) game.clearUserArrows();
  }, [clearArrowsOnClick, game]);

  /** Click-to-move with the arrow-clearing side effect woven in. */
  const handleSquareClick = useCallback(
    (index: SquareIndex): void => {
      // `viewOnly` keeps clicks from perturbing any board state — including
      // user-drawn or programmatic arrows. `clickToMove` is already a no-op
      // when disabled; guarding the arrow-clear here keeps the click path
      // purely declarative.
      if (viewOnly) return;
      maybeClearArrows();
      clickToMove(index);
    },
    [viewOnly, maybeClearArrows, clickToMove],
  );

  /** Escape clears arrows (and is a natural analogue for "cancel"). */
  useEffect(() => {
    if (!clearArrowsOnClick || game === null || viewOnly) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") maybeClearArrows();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearArrowsOnClick, game, maybeClearArrows, viewOnly]);

  // Piece slots carry `pointer-events: auto` (see `useCursorController`)
  // so the `grab` cursor renders correctly on pickable pieces. A native
  // click landing on a piece slot does NOT fire the underlying
  // `<Square/>`'s React `onClick`: the square is not an ancestor of the
  // slot in the React tree. Forward those clicks to click-to-move via
  // coordinate resolution — same geometry path `useDrag` / `useHoverSquare`
  // already use.
  useEffect(() => {
    if (viewOnly || clickToMoveEnabled === false || game === null) return;
    const container = containerRef.current;
    if (container === null) return;
    const onContainerClick = (e: MouseEvent): void => {
      if (e.button !== 0) return;
      const target = e.target as Element | null;
      if (target === null) return;
      // Only handle clicks that landed on the piece overlay — clicks
      // on squares already route through `Square.onClick`, and double
      // dispatch would fire click-to-move twice.
      if (target.closest("[data-piece-square]") === null) return;
      const sq = getSquareAtPoint(container, e.clientX, e.clientY, orientation);
      if (sq === null) return;
      handleSquareClick(sq);
    };
    container.addEventListener("click", onContainerClick);
    return () => container.removeEventListener("click", onContainerClick);
  }, [viewOnly, clickToMoveEnabled, game, orientation, handleSquareClick]);

  /**
   * Suppress the browser context menu on the board container. Works
   * independently of `allowDrawingArrows` so consumers can have the OS
   * menu blocked even in view-only / no-arrow configurations. When
   * arrows are enabled, `useArrowGesture` installs its own identical
   * listener too — both call `preventDefault` on the same event, which
   * is idempotent.
   */
  useEffect(() => {
    if (!disableContextMenu) return;
    const container = containerRef.current;
    if (container === null) return;
    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
    };
    container.addEventListener("contextmenu", onContextMenu);
    return () => container.removeEventListener("contextmenu", onContextMenu);
  }, [disableContextMenu]);

  // Drag callbacks — each is stable across renders so `useDrag` doesn't
  // re-install its pointer listeners on every commit. The drag-layer
  // visibility is managed imperatively by `useDrag` itself via the
  // `DragLayerHandle`; these callbacks only carry out the React-state
  // side effects (arrow clear, selection update) that a drag implies.
  const onDragStart = useCallback(
    (from: SquareIndex, _cell: BoardCell): void => {
      maybeClearArrows();
      // Flip the container into "grabbing" cursor mode. See
      // `useCursorController` for the CSS rule that consumes this.
      const container = containerRef.current;
      if (container !== null) container.dataset["ucrDragging"] = "true";
      // Calling `game.selectSquare(from)` propagates the drag-source
      // into the model so the selection controller shows legal targets
      // while the piece is in flight — the same visual affordance
      // click-to-move gets.
      game?.selectSquare(from);
    },
    [game, maybeClearArrows],
  );
  const onDragEnd = useCallback((): void => {
    // Reset the cursor. We clear unconditionally because React may have
    // skipped a render cycle between drop and the next pointer event.
    const container = containerRef.current;
    if (container !== null) delete container.dataset["ucrDragging"];
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
        const promotion = movePromotesPawn(fromCell, to) ? (4 as PieceType) /* Queen */ : undefined;
        game.queuePremove(promotion === undefined ? { from, to } : { from, to, promotion });
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
    enabled: dragEnabled && game !== null,
    onDragStart,
    onDragEnd,
    onDrop,
    ...(canDragPiece !== undefined ? { canDragPiece } : {}),
  });

  // Initialise keyboard focus once per orientation so Tab lands on a
  // sensible square. We deliberately do NOT auto-focus on mount — the
  // board stays dormant until the user Tabs into it. Suppressed in
  // `viewOnly` mode so the grid stays out of the tab order entirely.
  useEffect(() => {
    if (!keyboardNavEnabled) {
      setFocusedSquare(null);
      return;
    }
    setFocusedSquare((current) => current ?? defaultKeyboardFocus());
  }, [defaultKeyboardFocus, keyboardNavEnabled]);

  const onKeyboardActivate = useCallback(
    (index: SquareIndex): void => {
      maybeClearArrows();
      clickToMove(index);
    },
    [maybeClearArrows, clickToMove],
  );
  const onKeyboardEscape = useCallback((): void => {
    maybeClearArrows();
    game?.selectSquare(null);
  }, [maybeClearArrows, game]);

  useKeyboardNav({
    containerRef,
    orientation,
    focusedSquare,
    setFocusedSquare,
    onActivate: onKeyboardActivate,
    onEscape: onKeyboardEscape,
    enabled: game !== null && keyboardNavEnabled,
  });

  // Per-square hover notification — only armed when the caller supplies
  // at least one of the two callbacks, so no container listener is
  // installed on the default play path. Pointer events not mouse events,
  // so touch drags through a square pair the same as pointer drags.
  useHoverSquare({
    game,
    orientation,
    containerRef,
    enabled: onSquareMouseEnter !== undefined || onSquareMouseLeave !== undefined,
    ...(onSquareMouseEnter !== undefined ? { onEnter: onSquareMouseEnter } : {}),
    ...(onSquareMouseLeave !== undefined ? { onLeave: onSquareMouseLeave } : {}),
  });

  useArrowGesture({
    game,
    orientation,
    containerRef,
    arrowsLayerRef,
    enabled: arrowGestureEnabled && game !== null,
    palette,
    snapToValidMove: snapArrowsToValidMove,
  });

  // Imperative selection + legal-target highlighter. Writes
  // `data-ucr-selection` on the 64 square refs above; no React state,
  // no per-commit reconciliation. This is what closes the drag-start
  // peak-frame gap with chessground — a selectSquare call no longer
  // triggers a React render at all.
  useSelectionController(game, squareRefs, showLegalTargets);

  // Imperative last-move tint. Same pattern as the selection
  // controller — paints `data-ucr-last-move` on the two endpoint
  // squares via a CSS `::after` pseudo-element. Removes the
  // `<LastMoveLayer/>` React component from the drop-frame commit,
  // eliminating two DOM creates + layout + paint per move.
  useLastMoveController(game, squareRefs, highlightLastMove);

  // Container-level cursor paint. Writes `data-ucr-turn` (and
  // optionally `data-ucr-premove`) on the board container — a CSS rule
  // chain keyed to `[data-piece-cell]` values picks out grabbable
  // pieces without touching any square. That takes per-move cursor
  // DOM churn from 32 attribute writes down to 0-1; the grabbing
  // cursor (`grabbing`) is applied by the sibling `data-ucr-dragging`
  // attribute toggled from `onDragStart` / `onDragEnd`.
  useCursorController(game, containerRef, dragEnabled, allowPremove);

  // Memoised runtime so `<AnimationRunner/>`'s effect-deps stay stable
  // across `<Chessboard/>` prop changes unrelated to animation.
  const animationRuntime = useMemo(() => ({ skipNextRef: skipNextAnimationRef }), []);

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
      data-ucr-target-style={showLegalTargets === false ? "off" : showLegalTargets}
      {...(viewOnly ? { "data-ucr-view-only": "true" } : {})}
    >
      <BoardGrid
        orientation={orientation}
        onSquareClick={handleSquareClick}
        focusedSquare={focusedSquare}
        setSquareRef={setSquareRef}
        readOnly={viewOnly}
        {...(renderSquare !== undefined ? { renderSquare } : {})}
        {...(ariaLabel !== undefined ? { ariaLabel } : {})}
      />
      {game !== null && showCheckHighlight ? (
        <CheckLayer model={game} orientation={orientation} />
      ) : null}
      {game !== null ? (
        <PremoveLayer model={game} orientation={orientation} pieces={pieces} />
      ) : null}
      {/*
       * "Below" arrows — arrows marked `below: true` render beneath the
       * piece layer by DOM order (positioned elements without z-index
       * paint in tree order). Fresh subset per commit filters server
       * annotations / heatmap tints away from the top overlay.
       */}
      {game !== null ? (
        <ArrowsLayer model={game} orientation={orientation} palette={palette} below />
      ) : null}
      {game !== null ? (
        <PieceLayer model={game} orientation={orientation} pieces={pieces} />
      ) : fallbackBoard !== null ? (
        <StaticPieceLayer board={fallbackBoard} orientation={orientation} pieces={pieces} />
      ) : null}
      {game !== null ? (
        <AnimationRunner
          model={game}
          containerRef={containerRef}
          orientation={orientation}
          {...(animation !== undefined ? { options: animation } : {})}
          runtime={animationRuntime}
        />
      ) : null}
      <DragLayer ref={dragLayerRef} pieces={pieces} />
      {game !== null ? (
        <ArrowsLayer
          ref={arrowsLayerRef}
          model={game}
          orientation={orientation}
          palette={palette}
        />
      ) : null}
      {showCoordinates ? (
        <Coordinates orientation={orientation} ranksPosition={ranksPosition} />
      ) : null}
      <IllegalFlashLayer at={flashSquare} orientation={orientation} />
      {game !== null ? <LiveRegion model={game} /> : null}
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
