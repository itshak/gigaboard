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
 * A normal move uses a straight shaft from the source-square centre to
 * the target square. A knight move uses a bent, Russian Г-shaped shaft:
 * first along the two-square axis, then along the one-square axis. In
 * both cases the shaft stops at the arrowhead base so translucent
 * arrows do not darken where the shaft and head meet. `from === to` is
 * a special case: rendered as a stroked circle at the centre of the
 * square — the convention the right-click gesture uses for "mark this
 * square".
 */

import {
  forwardRef,
  memo,
  type ReactElement,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { Arrow, BoardModel } from "../core/index.js";
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

/** A point in board-local CSS-pixel coordinates. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Geometry needed to paint a shaft and head without translucent self-overlap. */
interface ArrowPath {
  readonly start: Point;
  readonly corner: Point | null;
  readonly shaftEnd: Point;
  readonly tip: Point;
  readonly finalUnit: Point;
}

/** Does the square pair describe a knight's L-shaped move? */
function isKnightMove(fromIndex: number, toIndex: number): boolean {
  const fileDelta = Math.abs((toIndex & 7) - (fromIndex & 7));
  const rankDelta = Math.abs((toIndex >> 3) - (fromIndex >> 3));
  return (fileDelta === 1 && rankDelta === 2) || (fileDelta === 2 && rankDelta === 1);
}

function unitVector(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return { x: dx / len, y: dy / len };
}

function arrowPath(
  fromIndex: number,
  toIndex: number,
  start: Point,
  end: Point,
  startOffset: number,
  tipOffset: number,
  headLength: number,
): ArrowPath | null {
  if (!isKnightMove(fromIndex, toIndex)) {
    const unit = unitVector(start, end);
    if (unit === null) return null;
    const tip = { x: end.x - unit.x * tipOffset, y: end.y - unit.y * tipOffset };
    return {
      start: { x: start.x + unit.x * startOffset, y: start.y + unit.y * startOffset },
      corner: null,
      shaftEnd: { x: tip.x - unit.x * headLength, y: tip.y - unit.y * headLength },
      tip,
      finalUnit: unit,
    };
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const corner = Math.abs(dx) > Math.abs(dy) ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
  const firstUnit = unitVector(start, corner);
  const finalUnit = unitVector(corner, end);
  if (firstUnit === null || finalUnit === null) return null;

  const tip = { x: end.x - finalUnit.x * tipOffset, y: end.y - finalUnit.y * tipOffset };
  return {
    start: { x: start.x + firstUnit.x * startOffset, y: start.y + firstUnit.y * startOffset },
    corner,
    shaftEnd: { x: tip.x - finalUnit.x * headLength, y: tip.y - finalUnit.y * headLength },
    tip,
    finalUnit,
  };
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
  const start = { x: (a.cx / 100) * boardSize, y: (a.cy / 100) * boardSize };
  const end = { x: (b.cx / 100) * boardSize, y: (b.cy / 100) * boardSize };

  if (fromIndex === toIndex) {
    ctx.strokeStyle = color;
    ctx.lineWidth = sqSize * 0.08;
    ctx.globalAlpha = preview ? 0.65 : 1;
    ctx.beginPath();
    ctx.arc(start.x, start.y, sqSize * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }

  const startOffset = sqSize * 0.28;
  const tipOffset = sqSize * 0.08;
  const headLength = sqSize * 0.36;
  const headHalfWidth = sqSize * 0.28;
  const shaftWidth = sqSize * 0.18;
  const path = arrowPath(fromIndex, toIndex, start, end, startOffset, tipOffset, headLength);
  if (path === null) return;

  ctx.globalAlpha = preview ? 0.65 : 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = shaftWidth;
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(path.start.x, path.start.y);
  if (path.corner !== null) ctx.lineTo(path.corner.x, path.corner.y);
  ctx.lineTo(path.shaftEnd.x, path.shaftEnd.y);
  ctx.stroke();

  const perpX = -path.finalUnit.y;
  const perpY = path.finalUnit.x;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(path.tip.x, path.tip.y);
  ctx.lineTo(path.shaftEnd.x + perpX * headHalfWidth, path.shaftEnd.y + perpY * headHalfWidth);
  ctx.lineTo(path.shaftEnd.x - perpX * headHalfWidth, path.shaftEnd.y - perpY * headHalfWidth);
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

export const ArrowsLayer = memo(
  forwardRef<ArrowsLayerHandle, ArrowsLayerProps>(function ArrowsLayer(
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
  }),
);

/** Utility for external hooks: the singleton reference shape. */
export type ArrowsLayerRef = RefObject<ArrowsLayerHandle | null>;
