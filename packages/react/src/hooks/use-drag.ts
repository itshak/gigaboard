"use client";

/**
 * Pointer-driven drag orchestration.
 *
 * The hook attaches `pointerdown`/`pointermove`/`pointerup`/`pointercancel`
 * listeners to a container ref and threads them through the drag state
 * machine from `@ultrachess/core`.
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

import {
  type BoardCell,
  type BoardModel,
  createDragController,
  type SquareIndex,
} from "@ultrachess/core";
import { type RefObject, useEffect } from "react";
import type { DragLayerHandle } from "../components/drag-layer.js";
import type { Orientation } from "../types.js";

/** Convert viewport coords to a square index, or `null` if outside the board. */
function squareAtViewportPoint(
  container: HTMLElement,
  clientX: number,
  clientY: number,
  orientation: Orientation,
): SquareIndex | null {
  const rect = container.getBoundingClientRect();
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null;
  const col = Math.floor((relX / rect.width) * 8);
  const row = Math.floor((relY / rect.height) * 8);
  const file = orientation === "white" ? col : 7 - col;
  const rank = orientation === "white" ? 7 - row : row;
  return (rank * 8 + file) as SquareIndex;
}

/** Algebraic name `"e2"` from a square index — used to query the origin DOM. */
function algebraicOf(index: SquareIndex): string {
  const file = index & 7;
  const rank = index >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

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
  } = options;

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
      const sq = squareAtViewportPoint(container, e.clientX, e.clientY, orientation);
      if (sq === null) return;
      const cell = game.getSnapshot().board[sq] ?? 0;
      if (cell === 0) return;
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
        // Hide origin piece imperatively (no re-render).
        const originLabel = algebraicOf(evt.from);
        originEl = container.querySelector<HTMLElement>(`[data-piece-square="${originLabel}"]`);
        if (originEl !== null) originEl.style.opacity = "0";

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
        const target = squareAtViewportPoint(container, e.clientX, e.clientY, orientation);
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
