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

import type { BoardModel, SquareIndex } from "@gigaboard/core";
import { type RefObject, useEffect } from "react";
import type { ArrowsLayerHandle } from "../components/arrows-layer.js";
import { getSquareAtPoint } from "../lib/geometry.js";
import type { Orientation, ResolvedArrowPalette } from "../types.js";

/** Resolve modifier keys to a colour channel. */
function colorForModifiers(e: PointerEvent, palette: ResolvedArrowPalette): string {
  if (e.shiftKey) return palette.shift;
  if (e.altKey) return palette.alt;
  if (e.ctrlKey || e.metaKey) return palette.ctrl;
  return palette.default;
}

export interface UseArrowGestureOptions {
  readonly game: BoardModel | null;
  readonly orientation: Orientation;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly arrowsLayerRef: RefObject<ArrowsLayerHandle | null>;
  readonly enabled: boolean;
  /** Fully-resolved colour palette (caller merges prop with defaults). */
  readonly palette: ResolvedArrowPalette;
  /**
   * When `true`, an arrow endpoint that lies on a legal move target
   * from the origin snaps to that target. Typical usage: analysis
   * boards where the user wants to draw future-move hints that align
   * with the rules. Default `false`.
   */
  readonly snapToValidMove?: boolean;
}

/**
 * Install right-click pointer listeners. Returns nothing — the side effect
 * is the listener registration. Gesture state lives entirely inside the
 * effect's closure and is torn down on unmount / dep change.
 */
export function useArrowGesture(options: UseArrowGestureOptions): void {
  const { game, orientation, containerRef, arrowsLayerRef, enabled, palette, snapToValidMove } =
    options;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (container === null || game === null) return;

    let origin: SquareIndex | null = null;
    let activePointerId: number | null = null;

    const clearPreview = (): void => {
      arrowsLayerRef.current?.setPreview(null);
    };

    /**
     * Constrain a candidate endpoint to a legal target from `origin`
     * when `snapToValidMove` is enabled. Same-square (circle / mark)
     * is always preserved. When the caller hovers a non-legal square,
     * the arrow snaps to the nearest legal target — euclidean on square
     * indices (cheap; no allocations in the hot path because
     * `legalFrom` is already cached by position hash in the model).
     */
    const snap = (candidate: SquareIndex): SquareIndex => {
      if (!snapToValidMove) return candidate;
      if (origin === null) return candidate;
      if (candidate === origin) return candidate;
      const legals = game.legalFrom(origin);
      if (legals.size === 0 || legals.has(candidate)) return candidate;
      // File/rank diff to the candidate; square-index euclidean is a
      // fine proxy since we're comparing targets on an 8×8 grid.
      const cf = candidate & 7;
      const cr = candidate >> 3;
      let best = candidate;
      let bestDist = Infinity;
      for (const t of legals) {
        const df = (t & 7) - cf;
        const dr = (t >> 3) - cr;
        const d = df * df + dr * dr;
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }
      return best;
    };

    const setPreview = (to: SquareIndex, color: string): void => {
      if (origin === null) return;
      arrowsLayerRef.current?.setPreview({ from: origin, to: snap(to), color });
    };

    const onContextMenu = (e: MouseEvent): void => {
      // Suppress the browser menu whenever arrow drawing is armed — otherwise
      // the OS context menu steals the pointerup and leaves the preview ghost
      // on the board.
      e.preventDefault();
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 2) return;
      const sq = getSquareAtPoint(container, e.clientX, e.clientY, orientation);
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
      const sq = getSquareAtPoint(container, e.clientX, e.clientY, orientation);
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
      const raw = getSquareAtPoint(container, e.clientX, e.clientY, orientation) ?? origin;
      const target = snap(raw);
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
  }, [game, orientation, containerRef, arrowsLayerRef, enabled, palette, snapToValidMove]);
}
