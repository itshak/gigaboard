"use client";

/**
 * Single floating-piece element that follows the pointer during a drag.
 *
 * Rendering model:
 *
 * - Idle: renders nothing (null). No DOM, no transform.
 * - Dragging: renders one absolutely-positioned wrapper containing the
 *   piece renderer's output. The wrapper's `transform` is written
 *   imperatively from the pointer-move handler in `useDrag` — React never
 *   re-renders during the drag loop.
 *
 * The component itself is thin: it just declares the JSX and exposes a
 * ref. All pointer wiring lives in `useDrag` for separability.
 */

import type { BoardCell, SquareIndex } from "@ultrachess/core";
import { forwardRef } from "react";
import type { PieceRenderer } from "../types.js";

/** Props for {@link DragLayer}. */
export interface DragLayerProps {
  /** The piece currently being dragged, or `null` when idle. */
  readonly active: { readonly from: SquareIndex; readonly cell: BoardCell } | null;
  /** The piece renderer to use (same one the `PieceLayer` renders with). */
  readonly pieces: PieceRenderer;
}

/**
 * The drag layer forwards a ref to its outer wrapper so `useDrag` can write
 * `transform` directly. When `active` is null we render nothing at all — no
 * hidden placeholder that would anchor dead pointer targets.
 */
export const DragLayer = forwardRef<HTMLDivElement, DragLayerProps>(function DragLayer(
  { active, pieces },
  ref,
) {
  if (active === null) return null;
  return (
    <div
      ref={ref}
      data-layer="drag"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "12.5%",
        height: "12.5%",
        pointerEvents: "none",
        willChange: "transform",
        zIndex: 20,
        containerType: "size",
      }}
    >
      {pieces({ cell: active.cell, square: active.from })}
    </div>
  );
});
