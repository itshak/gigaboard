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
import type { Arrow, ArrowHeadStyle, BoardModel } from "../core/index.js";
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
    if (arrow.label?.background !== undefined) continue;
    drawArrow(ctx, arrow.from, arrow.to, resolveColor(arrow, palette), sqSize, orientation, false);
  }
  if (preview !== null) {
    drawArrow(ctx, preview.from, preview.to, preview.color, sqSize, orientation, true);
  }
}

/* ====================================================== decorations */

/** ViewBox span (0..100) for the SVG decoration overlay. */
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
  return { cx: (a.cx + b.cx) / 2, cy: (a.cy + b.cy) / 2 };
}

/** Geometry needed to paint an aerodynamic pointing head with integrated text. */
export interface AeroHeadGeometry {
  readonly path: string;
  readonly tipLen: number;
  readonly dockLen: number;
  readonly frontLen: number;
  readonly cabinW: number;
}

/**
 * Compute aerodynamic arrowhead geometry with dynamic rectangular auto-centering:
 * - The evaluation text is mathematically 100% centered at (0, 0).
 * - The rectangular cabin extends dynamically from -cabinW to +cabinW based on text length.
 * - The forward nose taper begins strictly AFTER +cabinW, so outer digits like `+32.3` or `#18`
 *   never clip or cramp into the beveled nose cone!
 */
export function computeDynamicAeroGeometry(
  text: string | undefined,
  style: ArrowHeadStyle | undefined,
  fontSize: number,
  isTerminal = true,
): AeroHeadGeometry {
  const resolvedStyle = style ?? "aero_chisel";
  const hasText = Boolean(text && text.trim().length > 0);

  if (!hasText) {
    // Sculpted Aero-Sharp pointer: compact, athletic chisel arrowhead
    // for non-evaluation moves, idle engine states, and user-drawn arrows.
    // Total length: 4.6u at 2.45u baseline, scaling with fontSize when provided.
    const scale = Math.max(1, fontSize / 2.45);
    const tipX = 2.8 * scale;
    const shoulderX = 0.2 * scale;
    const rearX = -1.2 * scale;
    const dockX = -1.8 * scale;
    const halfH = 2.2 * scale;
    const path = `M ${rearX},${-halfH} L ${shoulderX},${-halfH} L ${tipX},0 L ${shoulderX},${halfH} L ${rearX},${halfH} C ${dockX},${halfH} ${dockX},${-halfH} ${rearX},${-halfH} Z`;
    return {
      path,
      tipLen: tipX,
      dockLen: -dockX,
      frontLen: tipX,
      cabinW: 0,
    };
  }

  const charWidth = fontSize * 0.6;
  const textWidth = text!.length * charWidth;
  const halfTextW = textWidth / 2;

  const scale = Math.max(1, fontSize / 2.45);
  // Equal padding around the text (0.75 at baseline, scaling with fontSize)
  const padX = 0.75 * scale;
  const cabinW = Math.max(3.2 * scale, halfTextW + padX);
  const halfH = Math.max(2.3, fontSize * 0.9);

  // Scaled rear dock socket
  const rearInset = 0.65 * scale;
  const dockX = -cabinW - rearInset;

  let frontLen = 0;
  let path = "";

  if (resolvedStyle === "aero_chisel") {
    if (isTerminal) {
      // Modern 60° beveled chisel nose closing forward (1.25 at baseline, scaling with fontSize)
      const noseLead = 1.25 * scale;
      const tipX = cabinW + noseLead;
      frontLen = tipX;
      path = `M ${-cabinW},${-halfH} L ${cabinW},${-halfH} L ${tipX},0 L ${cabinW},${halfH} L ${-cabinW},${halfH} C ${dockX},${halfH} ${dockX},${-halfH} ${-cabinW},${-halfH} Z`;
    } else {
      frontLen = cabinW + rearInset;
      path = `M ${-cabinW},${-halfH} L ${cabinW},${-halfH} C ${frontLen},${-halfH} ${frontLen},${halfH} ${cabinW},${halfH} L ${-cabinW},${halfH} C ${dockX},${halfH} ${dockX},${-halfH} ${-cabinW},${-halfH} Z`;
    }
  } else if (resolvedStyle === "chamfer_arrow") {
    if (isTerminal) {
      const tipX = cabinW + 1.4;
      frontLen = tipX;
      path = `M ${-cabinW},-1.2 L ${-cabinW + 1.2},${-halfH} L ${cabinW},${-halfH} L ${tipX},0 L ${cabinW},${halfH} L ${-cabinW + 1.2},${halfH} L ${-cabinW},1.2 Z`;
    } else {
      frontLen = cabinW + 0.8;
      path = `M ${-cabinW},-1.2 L ${-cabinW + 1.2},${-halfH} L ${cabinW - 1.2},${-halfH} L ${cabinW},-1.2 L ${cabinW},1.2 L ${cabinW - 1.2},${halfH} L ${-cabinW + 1.2},${halfH} L ${-cabinW},1.2 Z`;
    }
  } else if (resolvedStyle === "blunt_wedge") {
    if (isTerminal) {
      const tipX = cabinW + 1.1;
      frontLen = tipX;
      path = `M ${-cabinW},${-halfH} L ${cabinW},${-halfH} L ${tipX},${-halfH * 0.35} L ${tipX},${halfH * 0.35} L ${cabinW},${halfH} L ${-cabinW},${halfH} C ${dockX},${halfH} ${dockX},${-halfH} ${-cabinW},${-halfH} Z`;
    } else {
      frontLen = cabinW + rearInset;
      path = `M ${-cabinW},${-halfH} L ${cabinW},${-halfH} C ${frontLen},${-halfH} ${frontLen},${halfH} ${cabinW},${halfH} L ${-cabinW},${halfH} C ${dockX},${halfH} ${dockX},${-halfH} ${-cabinW},${-halfH} Z`;
    }
  } else if (resolvedStyle === "stealth") {
    const wingBack = cabinW + 2.3;
    const wingY = halfH + 0.35;
    const shoulderX = cabinW * 0.35;
    const tipX = cabinW + 3.6;
    frontLen = tipX;
    path = `M ${dockX.toFixed(2)},0 L ${(-wingBack).toFixed(2)},${(-wingY).toFixed(2)} L ${(-cabinW).toFixed(2)},${(-halfH).toFixed(2)} L ${shoulderX.toFixed(2)},${(-halfH).toFixed(2)} L ${tipX.toFixed(2)},0 L ${shoulderX.toFixed(2)},${halfH.toFixed(2)} L ${(-cabinW).toFixed(2)},${halfH.toFixed(2)} L ${(-wingBack).toFixed(2)},${wingY.toFixed(2)} Z`;
  } else {
    const noseLead = 1.25;
    const tipX = cabinW + noseLead;
    frontLen = tipX;
    path = `M ${-cabinW},${-halfH} L ${cabinW},${-halfH} L ${tipX},0 L ${cabinW},${halfH} L ${-cabinW},${halfH} C ${dockX},${halfH} ${dockX},${-halfH} ${-cabinW},${-halfH} Z`;
  }

  return {
    path,
    tipLen: frontLen,
    dockLen: -dockX,
    frontLen,
    cabinW,
  };
}

/**
 * Select the optimal Russian Г-shape corner for knight moves to avoid collisions
 * with friendly pawns and co-linear arrows along the file/rank.
 */
function chooseKnightCorner(
  fromIndex: number,
  toIndex: number,
  allArrows: readonly Arrow[],
  orientation: Orientation,
): Point {
  const a = squareCentrePct(fromIndex, orientation);
  const b = squareCentrePct(toIndex, orientation);

  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;

  // Candidate 1: step along rank to toIndex's file, then along file to toIndex (b.cx, a.cy)
  const corner1 = { x: b.cx, y: a.cy };

  // Candidate 2: step along file to toIndex's rank, then along rank to toIndex (a.cx, b.cy)
  const corner2 = { x: a.cx, y: b.cy };

  // If another arrow shares the origin file (e.g. pawn on g7 moving while knight on g8 moves),
  // step off the file immediately (corner1) so the knight path does not collide with the pawn ray!
  const fromFile = fromIndex & 7;
  const hasColinearArrowOnFile = allArrows.some(
    (other) => other.from !== fromIndex && (other.from & 7) === fromFile,
  );

  if (hasColinearArrowOnFile) {
    return corner1;
  }

  return Math.abs(dx) > Math.abs(dy) ? corner1 : corner2;
}

/** Compute flight vectors, pointing clearance, and cabin geometry for integrated eval arrows. */
function computeIntegratedArrowVectors(
  arrow: Arrow,
  orientation: Orientation,
  allArrows: readonly Arrow[],
) {
  const label = arrow.label;
  if (!label || label.background === undefined) return null;

  const a = squareCentrePct(arrow.from, orientation);
  const b = squareCentrePct(arrow.to, orientation);
  if (arrow.from === arrow.to) return null;

  const isKnight = isKnightMove(arrow.from, arrow.to);
  const fontSize = label.fontSize ?? 2.45;
  const geom = computeDynamicAeroGeometry(label.text, label.headStyle, fontSize, true);

  let startUnit: Point | null;
  let finalUnit: Point | null;
  let corner: Point | null = null;

  if (!isKnight) {
    const u = unitVector({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy });
    if (u === null) return null;
    startUnit = u;
    finalUnit = u;
  } else {
    corner = chooseKnightCorner(arrow.from, arrow.to, allArrows, orientation);
    startUnit = unitVector({ x: a.cx, y: a.cy }, corner);
    finalUnit = unitVector(corner, { x: b.cx, y: b.cy });
    if (startUnit === null || finalUnit === null) return null;
  }

  // Pointing clearance: leaves >= 1/3 of destination square (4.17%) open after the arrow tip
  // In 100x100 coordinates with 12.5% squares, center + 2.08% stops 4.17% before far edge
  const tip = {
    x: b.cx + finalUnit.x * 2.08,
    y: b.cy + finalUnit.y * 2.08,
  };

  const headCenter = {
    x: tip.x - finalUnit.x * geom.frontLen,
    y: tip.y - finalUnit.y * geom.frontLen,
  };

  const shaftEnd = {
    x: headCenter.x - finalUnit.x * geom.dockLen,
    y: headCenter.y - finalUnit.y * geom.dockLen,
  };

  const dist = Math.hypot(b.cx - a.cx, b.cy - a.cy);
  const startOffset = dist < 18 ? 0.5 : 2.4;
  const shaftStart = {
    x: a.cx + startUnit.x * startOffset,
    y: a.cy + startUnit.y * startOffset,
  };

  const angleRad = Math.atan2(finalUnit.y, finalUnit.x);
  const angleDeg = (angleRad * 180) / Math.PI;

  let textRot = 0;
  const rotMode = label.textRotation ?? "auto";
  if (rotMode === "flat") {
    textRot = -angleDeg;
  } else if (rotMode === "auto") {
    const norm = ((angleDeg % 360) + 360) % 360;
    if (norm > 90 && norm < 270) {
      textRot = 180;
    }
  }

  const shaftD =
    corner !== null
      ? `M ${shaftStart.x} ${shaftStart.y} L ${corner.x} ${corner.y} L ${shaftEnd.x} ${shaftEnd.y}`
      : `M ${shaftStart.x} ${shaftStart.y} L ${shaftEnd.x} ${shaftEnd.y}`;

  const shaftLen =
    (shaftEnd.x - shaftStart.x) * startUnit.x + (shaftEnd.y - shaftStart.y) * startUnit.y;
  const showShaft = isKnight || shaftLen > 0.2;

  return {
    label,
    fontSize,
    geom,
    headCenter,
    shaftD,
    showShaft,
    angleDeg,
    textRot,
  };
}

/** Render the shaft of an integrated arrow (with trench casing and contact shadow). */
function renderIntegratedShaft(
  arrow: Arrow,
  color: string,
  orientation: Orientation,
  key: string,
  allArrows: readonly Arrow[],
): ReactElement | null {
  const v = computeIntegratedArrowVectors(arrow, orientation, allArrows);
  if (v === null || !v.showShaft) return null;

  const is3d = v.label.style3d !== false;
  const filterId = is3d ? "url(#gb-apple-elevation)" : "url(#gb-arrow-shadow)";

  return (
    <g key={`${key}-shaft`} filter={filterId}>
      {/* Trench casing under-stroke */}
      <path
        d={v.shaftD}
        fill="none"
        stroke={is3d ? "rgba(44, 27, 20, 0.75)" : color}
        strokeWidth={is3d ? "3.2" : "2.2"}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Core stroke */}
      <path
        d={v.shaftD}
        fill="none"
        stroke={color}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 3D highlight micro-spine */}
      {is3d && (
        <path
          d={v.shaftD}
          fill="none"
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth="0.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}

/** Render the Aero-Chisel arrowhead pod with dynamic centered numerical evaluation. */
function renderIntegratedHead(
  arrow: Arrow,
  _color: string,
  orientation: Orientation,
  key: string,
  allArrows: readonly Arrow[],
): ReactElement | null {
  const v = computeIntegratedArrowVectors(arrow, orientation, allArrows);
  if (v === null) return null;

  const is3d = v.label.style3d !== false;
  const filterId = is3d ? "url(#gb-apple-elevation)" : "url(#gb-arrow-shadow)";
  const headFill =
    v.label.background === "#F59E0B" && is3d ? "url(#gb-apple-amber-grad)" : v.label.background;
  const headStroke = v.label.borderColor ?? "#78350F";

  return (
    <g key={`${key}-head`} filter={filterId}>
      <g transform={`translate(${v.headCenter.x}, ${v.headCenter.y}) rotate(${v.angleDeg})`}>
        <path
          d={v.geom.path}
          fill={headFill}
          stroke={headStroke}
          strokeWidth="0.7"
          strokeLinejoin="round"
        />
        {Boolean(v.label.text && v.label.text.trim().length > 0) && (
          <text
            x={0}
            y={0}
            transform={v.textRot !== 0 ? `rotate(${v.textRot})` : undefined}
            fill={v.label.fill ?? "#000000"}
            fontSize={v.fontSize}
            fontWeight="800"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
            textAnchor="middle"
            dominantBaseline="central"
            style={{ userSelect: "none" }}
          >
            {v.label.text}
          </text>
        )}
      </g>
    </g>
  );
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
            <defs>
              <filter
                id="gb-arrow-shadow"
                filterUnits="userSpaceOnUse"
                x="-20"
                y="-20"
                width="140"
                height="140"
              >
                <feDropShadow
                  dx="0"
                  dy="1.2"
                  stdDeviation="1.2"
                  floodColor="#000000"
                  floodOpacity="0.55"
                />
              </filter>
              <filter
                id="gb-apple-elevation"
                filterUnits="userSpaceOnUse"
                x="-20"
                y="-20"
                width="140"
                height="140"
              >
                <feDropShadow
                  dx="0"
                  dy="2.8"
                  stdDeviation="2.2"
                  floodColor="#000000"
                  floodOpacity="0.4"
                />
                <feDropShadow
                  dx="0"
                  dy="1.0"
                  stdDeviation="0.7"
                  floodColor="#000000"
                  floodOpacity="0.6"
                />
              </filter>
              <linearGradient id="gb-apple-amber-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity="1" />
                <stop offset="60%" stopColor="#F59E0B" stopOpacity="1" />
                <stop offset="100%" stopColor="#D97706" stopOpacity="1" />
              </linearGradient>
            </defs>
            {/* Pass 1: Integrated arrow shafts (rendered before heads for Dual Aero overlap) */}
            {arrows.map((arrow) => {
              if (arrow.label?.background === undefined) return null;
              const key = `${arrow.from}-${arrow.to}-${arrow.color}-${arrow.brush ?? ""}`;
              const color = resolveColor(arrow, palette);
              return renderIntegratedShaft(arrow, color, orientation, key, arrows);
            })}
            {/* Pass 2: Integrated arrow pointing heads */}
            {arrows.map((arrow) => {
              if (arrow.label?.background === undefined) return null;
              const key = `${arrow.from}-${arrow.to}-${arrow.color}-${arrow.brush ?? ""}`;
              const color = resolveColor(arrow, palette);
              return renderIntegratedHead(arrow, color, orientation, key, arrows);
            })}
            {/* Pass 3: Non-integrated labels and customSvg */}
            {arrows.map((arrow) => {
              if (arrow.label?.background !== undefined) return null;
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
