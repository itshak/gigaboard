"use client";

/**
 * Single floating-piece element that follows the pointer during a drag.
 *
 * ### Pre-mount, imperative show/hide
 *
 * Previously the layer conditionally rendered on a `dragActive` React
 * state flag — dragging started with a `flushSync(setState)`, which
 * synchronously re-rendered `<Chessboard/>` (and the entire layer
 * stack under it) during the first `pointermove` handler. Under CPU
 * throttle this showed up as a 25 ms peak frame at drag-start vs
 * chessground's 9 ms.
 *
 * The new model mounts all 12 possible drag ghosts **once** (hidden)
 * and exposes an imperative `DragLayerHandle`. `useDrag` calls
 * `handle.show(cell)` + `handle.setTransform(x, y)` from its pointer
 * handlers — no React state change, no reconciliation, compositor does
 * the work. `handle.hide()` on drag-end.
 */

import type { BoardCell } from "@gigaboard/core";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { PieceRenderer } from "../types.js";

/**
 * Frozen style object for the wrapper. Always mounted, always visible
 * to the compositor — hidden via `opacity: 0` + `pointer-events: none`
 * rather than `display: none`. That keeps the GPU layer alive between
 * drags so the first pointer-move of a drag doesn't pay the cost of
 * allocating a fresh compositor layer (the previous design's 25 ms
 * peak frame in real Chromium was mostly that one-off).
 *
 * `transform: translate3d(0,0,0)` forces the browser to promote the
 * element to its own layer immediately at mount.
 */
const WRAPPER_STYLE = Object.freeze({
  position: "absolute" as const,
  top: 0,
  left: 0,
  width: "12.5%",
  height: "12.5%",
  pointerEvents: "none" as const,
  willChange: "transform",
  zIndex: 20,
  containerType: "size" as const,
  opacity: 0,
  transform: "translate3d(0, 0, 0)",
});

/**
 * Frozen style object shared across the 12 pre-materialised slot
 * wrappers. Kept always-laid-out (not `display: none`) so paint + layer
 * state is warm — opacity flips only on the selected one.
 */
const SLOT_STYLE = Object.freeze({
  position: "absolute" as const,
  inset: 0,
  opacity: 0,
  containerType: "size" as const,
});

/**
 * Imperative handle exposed by {@link DragLayer}. `useDrag` uses these
 * methods in its pointer handlers to show the ghost, move it, and hide
 * it — all without triggering a React render.
 */
export interface DragLayerHandle {
  /** Reveal the ghost for the given piece cell (1..12). */
  show(cell: BoardCell): void;
  /** Hide the ghost. Safe to call while already hidden. */
  hide(): void;
  /** Write the ghost's transform. Called every pointer-move during a drag. */
  setTransform(x: number, y: number): void;
  /** Raw wrapper element — kept for legacy callers that measure geometry. */
  element(): HTMLDivElement | null;
}

/** Props for {@link DragLayer}. */
export interface DragLayerProps {
  /**
   * The piece renderer to use — the same one `<PieceLayer/>` renders
   * with. The drag layer calls this once per piece code at mount and
   * stores the resulting elements in the DOM, so piece rendering never
   * happens on the hot path.
   */
  readonly pieces: PieceRenderer;
}

/**
 * Always-mounted, imperatively-controlled drag overlay. Always emits
 * the `data-layer="drag"` attribute so existing CSS hooks keep working;
 * `data-active` toggles true during a drag so styling or tests can
 * key on that.
 */
export const DragLayer = forwardRef<DragLayerHandle, DragLayerProps>(function DragLayer(
  { pieces },
  ref,
) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // Refs to the 12 pre-materialised piece slots, keyed by cell code (1..12).
  // Index 0 is unused (empty cell has no drag ghost).
  const slotRefs = useRef<Array<HTMLDivElement | null>>(new Array(13).fill(null));

  // Pre-materialise the 13 (well, 12 — cell 0 is null) piece elements
  // once at mount. Rebuild only when the renderer identity changes.
  const slots = useMemo(() => {
    const nodes: Array<React.ReactNode> = [];
    for (let cell = 1; cell <= 12; cell++) {
      const child = pieces({ cell: cell as BoardCell, square: 0 as never });
      nodes.push(
        <div
          key={cell}
          ref={(el) => {
            slotRefs.current[cell] = el;
          }}
          data-drag-cell={cell}
          style={SLOT_STYLE}
        >
          {child}
        </div>,
      );
    }
    return nodes;
  }, [pieces]);

  useImperativeHandle(
    ref,
    () => ({
      show(cell): void {
        const wrapper = wrapperRef.current;
        if (wrapper === null) return;
        wrapper.style.opacity = "1";
        wrapper.dataset["active"] = "true";
        // Show just the chosen piece slot; others stay at opacity 0.
        for (let c = 1; c <= 12; c++) {
          const el = slotRefs.current[c];
          if (el !== null && el !== undefined) {
            el.style.opacity = c === cell ? "1" : "0";
          }
        }
      },
      hide(): void {
        const wrapper = wrapperRef.current;
        if (wrapper === null) return;
        wrapper.style.opacity = "0";
        wrapper.dataset["active"] = "false";
      },
      setTransform(x, y): void {
        const wrapper = wrapperRef.current;
        if (wrapper === null) return;
        wrapper.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      },
      element(): HTMLDivElement | null {
        return wrapperRef.current;
      },
    }),
    [],
  );

  return (
    <div
      ref={wrapperRef}
      data-layer="drag"
      data-active="false"
      aria-hidden="true"
      style={WRAPPER_STYLE}
    >
      {slots}
    </div>
  );
});
