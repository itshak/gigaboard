"use client";

/**
 * Pointer-driven drag orchestration.
 *
 * The hook attaches `pointerdown`/`pointermove`/`pointerup`/`pointercancel`
 * listeners to a container ref and threads them through the drag state
 * machine from `gigaboard/core`.
 *
 * ### Why event listeners on the container (not per square)
 *
 * We need a single source of truth for every pointer sample during a drag:
 * the pointer naturally crosses square boundaries many times in a single
 * drag. Attaching per-square `onPointerMove` handlers would register 64
 * React listeners and re-subscribe every render. A single container
 * listener is one registration that never re-subscribes.
 *
 * ### Zero React renders per frame during drag
 *
 * During the `dragging` state we never call `setState`. Instead the hook
 * writes to `dragLayerRef.current.style.transform` in the pointer-move
 * handler. React sees nothing change until drag-end, at which point one
 * commit finishes the interaction (and the model's own commit renders the
 * new position).
 *
 * ### Contract with the caller
 *
 * - Provide a `containerRef` to the outermost board container (has 1:1
 *   geometry with the 8×8 grid).
 * - Provide a `dragLayerRef` to the single absolutely-positioned element
 *   that represents the floating piece; the hook writes its `transform`.
 * - `onDragStart(from, cell)` is called once when the drag crosses the
 *   activation threshold. The caller should render the piece into the
 *   drag layer (via React state) and imperatively hide the origin.
 * - `onDrop(from, to)` is called when a drop lands on a different square.
 *   Illegal moves are the caller's problem — the hook merely reports the
 *   user's intent.
 * - `onDragEnd()` is called on every terminal transition (drop, cancel,
 *   same-square drop). The caller restores DOM opacity and clears the
 *   drag-layer render state.
 */

import { type RefObject, useEffect, useRef } from "react";
import type { DragLayerHandle } from "../components/drag-layer.js";
import {
  type BoardCell,
  type BoardModel,
  createDragController,
  type SquareIndex,
} from "../core/index.js";
import { CSS_VARS } from "../default-theme.js";
import { algebraicOf, getSquareAtPoint } from "../lib/geometry.js";
import type { Orientation } from "../types.js";

/** CSS variable the theme uses to control drag-origin opacity. */
const GHOST_OPACITY_VAR = CSS_VARS.DRAG_GHOST_OPACITY;

/** Options passed to {@link useDrag}. */
export interface UseDragOptions {
  readonly game: BoardModel | null;
  readonly orientation: Orientation;
  readonly containerRef: RefObject<HTMLElement | null>;
  /**
   * Imperative handle to the always-mounted drag overlay. `useDrag`
   * calls `show`, `setTransform`, and `hide` here from its pointer
   * handlers — zero React state changes during the drag loop (and
   * crucially, none at drag-start either).
   */
  readonly dragLayerRef: RefObject<DragLayerHandle | null>;
  readonly enabled: boolean;
  /** The activation distance (pixels) for `pending → dragging`. */
  readonly activationDistance?: number;
  /** Callbacks — see hook docs above. */
  readonly onDragStart: (from: SquareIndex, cell: BoardCell) => void;
  readonly onDragEnd: () => void;
  readonly onDrop: (from: SquareIndex, to: SquareIndex) => void;
  /**
   * Optional per-piece gate. If provided and it returns `false` for the
   * would-be drag source, pointer-down is silently ignored and no drag
   * initiates. Called once per attempt, never during a drag.
   */
  readonly canDragPiece?: (ctx: {
    readonly square: SquareIndex;
    readonly cell: BoardCell;
  }) => boolean;
}

/**
 * Install pointer listeners for drag-and-drop. Listeners stay registered for
 * the lifetime of the containing component.
 */
export function useDrag(options: UseDragOptions): void {
  const {
    game,
    orientation,
    containerRef,
    dragLayerRef,
    enabled,
    activationDistance,
    onDragStart,
    onDragEnd,
    onDrop,
    canDragPiece,
  } = options;

  // Latest-ref so the caller can pass a fresh predicate every render
  // without tearing down the pointer listeners. Absorbed here — not at
  // the call site — so consumers don't have to wrap every time.
  const canDragPieceRef = useRef(canDragPiece);
  useEffect(() => {
    canDragPieceRef.current = canDragPiece;
  });

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (container === null || game === null) return;

    const controller = createDragController(
      activationDistance === undefined ? {} : { activationDistance },
    );

    // Imperative drag internals. Mutating these does NOT re-render.
    let originEl: HTMLElement | null = null;
    let active = false;
    let activePointerId: number | null = null;

    const writeTransform = (clientX: number, clientY: number): void => {
      const layer = dragLayerRef.current;
      if (layer === null) return;
      const rect = container.getBoundingClientRect();
      const sqSize = rect.width / 8;
      // Centre the piece on the pointer.
      const x = clientX - rect.left - sqSize / 2;
      const y = clientY - rect.top - sqSize / 2;
      layer.setTransform(x, y);
    };

    const restoreOrigin = (): void => {
      if (originEl !== null) {
        originEl.style.opacity = "";
        originEl = null;
      }
    };

    const cleanup = (): void => {
      restoreOrigin();
      // Hide the ghost imperatively; no React state change.
      dragLayerRef.current?.hide();
      active = false;
      activePointerId = null;
      onDragEnd();
    };

    const onPointerDown = (e: PointerEvent): void => {
      // Primary button only. Right-clicks are reserved for arrows (M4).
      // Multi-touch is defended by drag-controller's pointerId tracking.
      if (e.button !== 0) return;
      const sq = getSquareAtPoint(container, e.clientX, e.clientY, orientation);
      if (sq === null) return;
      const cell = game.getSnapshot().board[sq] ?? 0;
      if (cell === 0) return;
      // Caller-supplied gate. Fires on the cold activation path — never
      // during a drag — so the ref deref is free on the hot loop.
      const canDrag = canDragPieceRef.current;
      if (canDrag !== undefined && !canDrag({ square: sq, cell: cell as BoardCell })) {
        return;
      }
      const consumed = controller.pointerDown(sq, e.pointerId, e.clientX, e.clientY);
      if (consumed) activePointerId = e.pointerId;
    };

    const onPointerMove = (e: PointerEvent): void => {
      const evt = controller.pointerMove(e.pointerId, e.clientX, e.clientY);
      if (evt === null) return;

      if (evt.kind === "drag-start") {
        const cell = (game.getSnapshot().board[evt.from] ?? 0) as BoardCell;
        if (cell === 0) {
          // Piece disappeared between down and move — treat as cancel.
          controller.cancel();
          return;
        }
        // Fade the origin piece imperatively (no re-render). The target
        // opacity is sourced from `--gb-drag-ghost-opacity` on the board
        // container so themes control the look — `0` for chess.com's
        // vanish-on-drag, `0.35` for lichess-style translucent ghost.
        // Reading via `var(...)` inside the inline style keeps the value
        // live: users can toggle the CSS var and the next drag reflects
        // it without a remount.
        const originLabel = algebraicOf(evt.from);
        originEl = container.querySelector<HTMLElement>(`[data-piece-square="${originLabel}"]`);
        if (originEl !== null) {
          // Fallback `0.35` matches the lichess convention and keeps the
          // behaviour correct when the caller swaps in a theme that
          // doesn't define the variable (theme records replace — not
          // merge with — the default theme).
          originEl.style.opacity = `var(${GHOST_OPACITY_VAR}, 0.35)`;
        }

        active = true;
        try {
          container.setPointerCapture(e.pointerId);
        } catch {
          // Some test environments don't support pointer capture; ignore.
        }

        // Show the ghost imperatively — no React state change, no
        // `flushSync`, no synchronous re-render of `<Chessboard/>`.
        // This is the fix that closes the 25 ms drag-peak gap with
        // chessground in real Chromium.
        dragLayerRef.current?.show(cell);
        writeTransform(e.clientX, e.clientY);

        // `onDragStart` still fires for callers that need to react
        // (clear arrows, set `selectSquare` to show legal targets,
        // analytics, haptic feedback, etc.) — but it no longer drives
        // the drag-layer visibility.
        onDragStart(evt.from, cell);
        return;
      }

      // drag-move: imperative only, no React involvement.
      writeTransform(e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent): void => {
      const evt = controller.pointerUp(e.pointerId, e.clientX, e.clientY);
      if (evt === null) return;

      if (evt.kind === "drop") {
        const target = getSquareAtPoint(container, e.clientX, e.clientY, orientation);
        if (target !== null && target !== evt.from) {
          onDrop(evt.from, target);
        }
      }
      // "click" kind is ignored — Square.onClick handles simple clicks; the
      // browser only fires click if the pointer didn't move past threshold.

      if (active) cleanup();
      activePointerId = null;
    };

    const onPointerCancel = (e: PointerEvent): void => {
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      controller.cancel();
      if (active) cleanup();
      activePointerId = null;
    };

    // Passive listeners where possible; pointer-move gets `passive: true`
    // since we never call preventDefault inside.
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerCancel);

    return (): void => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerCancel);
      if (active) cleanup();
    };
  }, [
    game,
    orientation,
    containerRef,
    dragLayerRef,
    enabled,
    activationDistance,
    onDragStart,
    onDragEnd,
    onDrop,
  ]);
}
