"use client";

/**
 * Right-click drawing gesture.
 *
 * Mirrors the left-click drag hook but listens only for the secondary
 * button. On `pointerdown` we record the origin square. Each `pointermove`
 * updates an in-flight preview arrow via `arrowsLayerRef.setPreview` —
 * **zero React re-renders** per frame, the canvas repaints imperatively.
 * On `pointerup` we commit the arrow through the board model's
 * `toggleArrow` (identical start/end toggles the same-square mark).
 *
 * Also intercepts the browser context menu so right-click doesn't pop the
 * OS menu.
 */

import type { BoardModel, SquareIndex } from "@ultrachess/core";
import { type RefObject, useEffect } from "react";
import type { ArrowsLayerHandle } from "../components/arrows-layer.js";
import type { ArrowColors, Orientation } from "../types.js";

/** Resolve modifier keys to a colour channel. */
function colorForModifiers(e: PointerEvent, palette: Required<ArrowColors>): string {
  if (e.shiftKey) return palette.shift;
  if (e.altKey) return palette.alt;
  if (e.ctrlKey || e.metaKey) return palette.ctrl;
  return palette.default;
}

/** Square at viewport (x, y), or `null` outside the board. */
function squareAt(
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

export interface UseArrowGestureOptions {
  readonly game: BoardModel | null;
  readonly orientation: Orientation;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly arrowsLayerRef: RefObject<ArrowsLayerHandle | null>;
  readonly enabled: boolean;
  /** Fully-resolved colour palette (caller merges prop with defaults). */
  readonly palette: Required<ArrowColors>;
}

/**
 * Install right-click pointer listeners. Returns nothing — the side effect
 * is the listener registration. Gesture state lives entirely inside the
 * effect's closure and is torn down on unmount / dep change.
 */
export function useArrowGesture(options: UseArrowGestureOptions): void {
  const { game, orientation, containerRef, arrowsLayerRef, enabled, palette } = options;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (container === null || game === null) return;

    let origin: SquareIndex | null = null;
    let activePointerId: number | null = null;

    const clearPreview = (): void => {
      arrowsLayerRef.current?.setPreview(null);
    };

    const setPreview = (to: SquareIndex, color: string): void => {
      if (origin === null) return;
      arrowsLayerRef.current?.setPreview({ from: origin, to, color });
    };

    const onContextMenu = (e: MouseEvent): void => {
      // Suppress the browser menu whenever arrow drawing is armed — otherwise
      // the OS context menu steals the pointerup and leaves the preview ghost
      // on the board.
      e.preventDefault();
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 2) return;
      const sq = squareAt(container, e.clientX, e.clientY, orientation);
      if (sq === null) return;
      origin = sq;
      activePointerId = e.pointerId;
      // Initial preview: a same-square "mark" at the origin.
      setPreview(sq, colorForModifiers(e, palette));
      try {
        container.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture not supported in this environment */
      }
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (origin === null) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      const sq = squareAt(container, e.clientX, e.clientY, orientation);
      if (sq === null) {
        // Pointer left the board — show the preview as a mark at origin.
        setPreview(origin, colorForModifiers(e, palette));
        return;
      }
      setPreview(sq, colorForModifiers(e, palette));
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (origin === null) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      const target = squareAt(container, e.clientX, e.clientY, orientation) ?? origin;
      const color = colorForModifiers(e, palette);
      game.toggleArrow({ from: origin, to: target, color });
      origin = null;
      activePointerId = null;
      clearPreview();
    };

    const onPointerCancel = (e: PointerEvent): void => {
      if (origin === null) return;
      if (activePointerId !== null && e.pointerId !== activePointerId) return;
      origin = null;
      activePointerId = null;
      clearPreview();
    };

    container.addEventListener("contextmenu", onContextMenu);
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerCancel);

    return (): void => {
      container.removeEventListener("contextmenu", onContextMenu);
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerCancel);
      clearPreview();
    };
  }, [game, orientation, containerRef, arrowsLayerRef, enabled, palette]);
}
