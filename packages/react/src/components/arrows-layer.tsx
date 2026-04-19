"use client";

/**
 * Canvas-2D arrow overlay with optional SVG decorations.
 *
 * Renders every committed arrow from `snapshot.arrows` (optionally
 * filtered by the `below` flag) plus an in-flight preview arrow the
 * user is currently dragging. The preview is owned by
 * `useArrowGesture` via a ref; this component only exposes redraw
 * hooks and lets the gesture hook invalidate the canvas imperatively.
 *
 * ### Two-layer instantiation
 *
 * The board mounts `<ArrowsLayer below/>` before the piece layer and
 * `<ArrowsLayer/>` (above, default) after. Each instance filters its
 * arrows by the `below` flag; the `above` instance also renders the
 * active preview. No z-index juggling: pieces paint between them by
 * DOM order.
 *
 * ### Why Canvas instead of SVG
 *
 * SVG forces a React reconcile per arrow-set change (one React element
 * per arrow). During a right-click drag the preview arrow moves with
 * the pointer — an SVG approach would re-render on every pointermove.
 * A single `<canvas>` with an imperative redraw costs one React commit
 * per arrow-set mutation and zero React renders per drag frame.
 *
 * ### SVG child overlay for labels and customSvg
 *
 * `label` and `customSvg` require DOM, not a 2D context. When the
 * current arrow set contains at least one of either, the component
 * renders a sibling `<svg>` on top of the canvas. When the set has
 * none, the `<svg>` is not rendered at all — zero cost for plain
 * arrow boards.
 *
 * ### HiDPI handling
 *
 * `canvas.width`/`height` are set to `CSS pixels * devicePixelRatio`
 * so strokes stay crisp on retina displays. A `ResizeObserver`
 * re-provisions the backing store whenever the board resizes.
 *
 * ### Arrow drawing
 *
 * A straight line from the source-square centre to just inside the
 * target square, followed by a filled triangular head. `from === to`
 * is a special case: rendered as a stroked circle at the centre of
 * the square — the convention the right-click gesture uses for
 * "mark this square".
 */

import type { Arrow, BoardModel } from "@ultrachess/core";
import {
  forwardRef,
  type ReactElement,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useBoardSlice } from "../hooks/use-board-subscription.js";
import type { Orientation, ResolvedArrowPalette } from "../types.js";

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
  /**
   * Optional palette resolving arrow `brush` keys to CSS colours. When
   * an arrow carries both `color` and `brush`, the brush wins if the
   * key is present in the palette; otherwise `color` is used as-is.
   */
  readonly palette?: ResolvedArrowPalette;
  /**
   * When `true`, only arrows with `below: true` are rendered and the
   * preview is suppressed — this is the "beneath pieces" layer.
   * Default `false` (the top layer).
   */
  readonly below?: boolean;
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

/** Resolve the final colour for an arrow given an optional palette. */
function resolveColor(arrow: Arrow, palette: ResolvedArrowPalette | undefined): string {
  if (arrow.brush !== undefined && palette !== undefined) {
    const brushed = palette[arrow.brush];
    if (brushed !== undefined) return brushed;
  }
  return arrow.color;
}

/** Draw a standard arrow (or same-square circle) onto the canvas. */
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
  const startOffset = sqSize * 0.28;
  const tipOffset = sqSize * 0.08;
  const xStart = x1 + ux * startOffset;
  const yStart = y1 + uy * startOffset;
  const xTip = x2 - ux * tipOffset;
  const yTip = y2 - uy * tipOffset;

  const headLength = sqSize * 0.36;
  const headHalfWidth = sqSize * 0.28;
  const shaftWidth = sqSize * 0.18;

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
  palette: ResolvedArrowPalette | undefined,
): void {
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const rect = canvas.getBoundingClientRect();
  const cssWidth = rect.width;
  const cssHeight = rect.height;
  if (cssWidth <= 0 || cssHeight <= 0) return;

  const backingWidth = Math.round(cssWidth * dpr);
  const backingHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== backingWidth) canvas.width = backingWidth;
  if (canvas.height !== backingHeight) canvas.height = backingHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const sqSize = cssWidth / 8;
  for (const arrow of arrows) {
    drawArrow(ctx, arrow.from, arrow.to, resolveColor(arrow, palette), sqSize, orientation, false);
  }
  if (preview !== null) {
    drawArrow(ctx, preview.from, preview.to, preview.color, sqSize, orientation, true);
  }
}

/* ====================================================== decorations */

/**
 * Anchor-point for label/customSvg rendering, returned in viewport
 * percent (0..100) so the SVG overlay can position nodes without a
 * second `getBoundingClientRect` call.
 */
function anchorPct(
  from: number,
  to: number,
  orientation: Orientation,
  center: "orig" | "dest" | "label",
): { cx: number; cy: number } {
  const a = squareCentrePct(from, orientation);
  const b = squareCentrePct(to, orientation);
  if (center === "orig") return a;
  if (center === "dest") return b;
  // "label" → arrow midpoint.
  return { cx: (a.cx + b.cx) / 2, cy: (a.cy + b.cy) / 2 };
}

/* ====================================================== component */

export const ArrowsLayer = forwardRef<ArrowsLayerHandle, ArrowsLayerProps>(function ArrowsLayer(
  { model, orientation, palette, below = false },
  handle,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<PreviewArrow | null>(null);
  const allArrows = useBoardSlice(model, (s) => s.arrows);

  // Filter by the `below` flag. A fresh reference is produced only
  // when the subset changes — preserves `useLayoutEffect` dep
  // stability across renders that don't affect this layer.
  const arrows = useMemo(
    () => allArrows.filter((a) => (a.below === true) === below),
    [allArrows, below],
  );

  // Does any arrow in this subset carry a label/customSvg? If not,
  // the SVG overlay isn't rendered at all — zero cost for the common
  // "plain arrows only" case.
  const hasDecorations = useMemo(
    () => arrows.some((a) => a.label !== undefined || a.customSvg !== undefined),
    [arrows],
  );

  // Preview is owned by the top layer only; the below layer ignores
  // gesture previews (drawings always land on top during creation).
  useImperativeHandle(
    handle,
    () => ({
      setPreview(preview: PreviewArrow | null): void {
        if (below) return;
        previewRef.current = preview;
        const canvas = canvasRef.current;
        if (canvas !== null) redraw(canvas, arrows, preview, orientation, palette);
      },
    }),
    [arrows, orientation, palette, below],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    redraw(canvas, arrows, previewRef.current, orientation, palette);
  }, [arrows, orientation, palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const parent = canvas.parentElement;
    if (parent === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      redraw(canvas, arrows, previewRef.current, orientation, palette);
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, [arrows, orientation, palette]);

  const layerZIndex = below ? undefined : 15;

  return (
    <>
      <canvas
        ref={canvasRef}
        data-layer={below ? "arrows-below" : "arrows"}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          ...(layerZIndex !== undefined ? { zIndex: layerZIndex } : {}),
        }}
      />
      {hasDecorations ? (
        <svg
          data-layer={below ? "arrows-below-decor" : "arrows-decor"}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            // Decorations share the z-plane of the canvas they annotate.
            ...(layerZIndex !== undefined ? { zIndex: layerZIndex } : {}),
          }}
        >
          {arrows.map((arrow) => {
            const key = `${arrow.from}-${arrow.to}-${arrow.color}-${arrow.brush ?? ""}`;
            const color = resolveColor(arrow, palette);
            const nodes: ReactElement[] = [];
            if (arrow.label !== undefined) {
              const { cx, cy } = anchorPct(arrow.from, arrow.to, orientation, "label");
              nodes.push(
                <text
                  key={`${key}-label`}
                  x={cx}
                  y={cy}
                  fill={arrow.label.fill ?? color}
                  fontSize="4"
                  fontWeight="700"
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ userSelect: "none" }}
                >
                  {arrow.label.text}
                </text>,
              );
            }
            if (arrow.customSvg !== undefined) {
              const { cx, cy } = anchorPct(
                arrow.from,
                arrow.to,
                orientation,
                arrow.customSvg.center ?? "dest",
              );
              nodes.push(
                <g
                  key={`${key}-svg`}
                  transform={`translate(${cx}, ${cy})`}
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted consumer-supplied SVG
                  dangerouslySetInnerHTML={{ __html: arrow.customSvg.html }}
                />,
              );
            }
            return nodes.length === 0 ? null : <g key={key}>{nodes}</g>;
          })}
        </svg>
      ) : null}
    </>
  );
});

/** Utility for external hooks: the singleton reference shape. */
export type ArrowsLayerRef = RefObject<ArrowsLayerHandle | null>;
