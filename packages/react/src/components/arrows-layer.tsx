"use client";

/**
 * Canvas-2D arrow overlay.
 *
 * Renders every committed arrow from `snapshot.arrows` plus an optional
 * preview arrow the user is currently dragging. The preview is owned by
 * `useArrowGesture` via a ref; this component only exposes redraw hooks
 * and lets the gesture hook invalidate the canvas imperatively.
 *
 * ### Why Canvas instead of SVG
 *
 * SVG forces a React reconcile per arrow-set change (one React element per
 * arrow). During a right-click drag the preview arrow moves with the
 * pointer — an SVG approach would re-render on every pointermove. A single
 * `<canvas>` with an imperative redraw costs one React commit per
 * arrow-set mutation and zero React renders per drag frame.
 *
 * ### HiDPI handling
 *
 * `canvas.width`/`height` are set to `CSS pixels * devicePixelRatio` so
 * strokes stay crisp on retina displays. A `ResizeObserver` re-provisions
 * the backing store whenever the board resizes.
 *
 * ### Arrow drawing
 *
 * A straight line from the source-square centre to just inside the target
 * square, followed by a filled triangular head. `from === to` is a special
 * case: rendered as a stroked circle at the centre of the square — the
 * convention the right-click gesture uses for "mark this square".
 */

import type { Arrow, BoardModel } from "@ultrachess/core";
import {
  forwardRef,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { useBoardSlice } from "../hooks/use-board-subscription.js";
import type { Orientation } from "../types.js";

/** Shape rendered mid-gesture, before the user releases the button. */
export interface PreviewArrow {
  readonly from: number;
  readonly to: number;
  readonly color: string;
}

/** Imperative API exposed by `<ArrowsLayer/>` to `useArrowGesture`. */
export interface ArrowsLayerHandle {
  /** Update the preview arrow (null to clear) and redraw. */
  setPreview(preview: PreviewArrow | null): void;
}

/** Props for {@link ArrowsLayer}. */
export interface ArrowsLayerProps {
  readonly model: BoardModel;
  readonly orientation: Orientation;
}

/* ============================================================ geometry */

/** Square-index → (centreX%, centreY%) in board-local coordinates. */
function squareCentrePct(index: number, orientation: Orientation): { cx: number; cy: number } {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { cx: col * 12.5 + 6.25, cy: row * 12.5 + 6.25 };
}

/* ======================================================= draw primitives */

/** Draw a standard arrow with a triangular head. */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromIndex: number,
  toIndex: number,
  color: string,
  sqSize: number,
  orientation: Orientation,
  preview: boolean,
): void {
  const a = squareCentrePct(fromIndex, orientation);
  const b = squareCentrePct(toIndex, orientation);
  const boardSize = sqSize * 8;
  const x1 = (a.cx / 100) * boardSize;
  const y1 = (a.cy / 100) * boardSize;
  const x2 = (b.cx / 100) * boardSize;
  const y2 = (b.cy / 100) * boardSize;

  if (fromIndex === toIndex) {
    // Same-square "mark": stroked ring filling most of the cell.
    ctx.strokeStyle = color;
    ctx.lineWidth = sqSize * 0.08;
    ctx.globalAlpha = preview ? 0.65 : 1;
    ctx.beginPath();
    ctx.arc(x1, y1, sqSize * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const ux = dx / len;
  const uy = dy / len;
  // Start a short distance off the source square so the tail isn't buried
  // in the piece, and end just inside the target square so the head sits
  // cleanly on top of it.
  const startOffset = sqSize * 0.28;
  const tipOffset = sqSize * 0.08;
  const xStart = x1 + ux * startOffset;
  const yStart = y1 + uy * startOffset;
  const xTip = x2 - ux * tipOffset;
  const yTip = y2 - uy * tipOffset;

  const headLength = sqSize * 0.36;
  const headHalfWidth = sqSize * 0.28;
  const shaftWidth = sqSize * 0.18;

  // Shaft — a line from source to just before the head.
  const xe = xTip - ux * headLength * 0.85;
  const ye = yTip - uy * headLength * 0.85;

  ctx.globalAlpha = preview ? 0.65 : 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = shaftWidth;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(xStart, yStart);
  ctx.lineTo(xe, ye);
  ctx.stroke();

  // Arrowhead — filled triangle.
  const perpX = -uy;
  const perpY = ux;
  const baseX = xTip - ux * headLength;
  const baseY = yTip - uy * headLength;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(xTip, yTip);
  ctx.lineTo(baseX + perpX * headHalfWidth, baseY + perpY * headHalfWidth);
  ctx.lineTo(baseX - perpX * headHalfWidth, baseY - perpY * headHalfWidth);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Redraw the full arrow set + preview onto the canvas. */
function redraw(
  canvas: HTMLCanvasElement,
  arrows: readonly Arrow[],
  preview: PreviewArrow | null,
  orientation: Orientation,
): void {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width;
  const cssHeight = rect.height;
  if (cssWidth <= 0 || cssHeight <= 0) return;

  // Provision the backing store for crisp HiDPI strokes.
  const backingWidth = Math.round(cssWidth * dpr);
  const backingHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;
  // `setTransform` resets any residual state from previous frames.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const sqSize = cssWidth / 8;
  for (const arrow of arrows) {
    drawArrow(ctx, arrow.from, arrow.to, arrow.color, sqSize, orientation, false);
  }
  if (preview !== null) {
    drawArrow(ctx, preview.from, preview.to, preview.color, sqSize, orientation, true);
  }
}

/* ====================================================== component */

/**
 * The arrow overlay. Expose an imperative `setPreview` handle via the
 * forwarded ref so the gesture hook can update the preview arrow without
 * forcing a React re-render.
 */
export const ArrowsLayer = forwardRef<ArrowsLayerHandle, ArrowsLayerProps>(function ArrowsLayer(
  { model, orientation },
  handle,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<PreviewArrow | null>(null);
  const arrows = useBoardSlice(model, (s) => s.arrows);

  // Expose imperative preview-set to the gesture hook.
  useImperativeHandle(
    handle,
    () => ({
      setPreview(preview: PreviewArrow | null): void {
        previewRef.current = preview;
        const canvas = canvasRef.current;
        if (canvas !== null) {
          redraw(canvas, arrows, preview, orientation);
        }
      },
    }),
    [arrows, orientation],
  );

  // Redraw whenever committed arrows or orientation change.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    redraw(canvas, arrows, previewRef.current, orientation);
  }, [arrows, orientation]);

  // Re-size the canvas with the board.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const parent = canvas.parentElement;
    if (parent === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      redraw(canvas, arrows, previewRef.current, orientation);
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [arrows, orientation]);

  return (
    <canvas
      ref={canvasRef}
      data-layer="arrows"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 15,
      }}
    />
  );
});

/** Utility for external hooks: the singleton reference shape. */
export type ArrowsLayerRef = RefObject<ArrowsLayerHandle | null>;
