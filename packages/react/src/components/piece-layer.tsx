"use client";

/**
 * Piece overlay: 64 `PieceSlot` children, one per square. Each slot
 * subscribes to a single byte of the board snapshot — so a move that
 * touches 2–4 bytes wakes 2–4 slots, not all 64.
 *
 * Layout is an 8×8 CSS grid. A slot's position is expressed with
 * `gridColumnStart` / `gridRowStart` — two integer CSS properties —
 * instead of the `left: "${x}%"; top: "${y}%"` percentage math we used
 * to do. That removes per-render string interpolation and lets the
 * browser's grid layout path short-circuit: only slots whose integer
 * coordinates changed get a layout update. Paint cost drops too —
 * composited grid cells are cheaper than absolute-positioned ones
 * because the layout root stays the grid container, not each sibling.
 *
 * The layer itself (`pointer-events: none`) never intercepts clicks; the
 * board grid beneath owns pointer events.
 */

import type { BoardCell, BoardModel, SquareIndex } from "@ultrachess/core";
import { memo } from "react";
import { useSquareCell } from "../hooks/use-board-subscription.js";
import type { Orientation, PieceRenderer } from "../types.js";

/**
 * Compute the 1-based CSS grid column + row for a square. The grid has
 * 8 columns and 8 rows; white orientation puts rank 1 at row 8 (the
 * bottom) and rank 8 at row 1 (the top).
 */
function gridCoord(
  index: SquareIndex,
  orientation: Orientation,
): { col: number; row: number } {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file + 1 : 8 - file;
  const row = orientation === "white" ? 8 - rank : rank + 1;
  return { col, row };
}

/** Props for each individual piece slot. */
interface PieceSlotProps {
  readonly index: SquareIndex;
  readonly model: BoardModel;
  readonly orientation: Orientation;
  readonly pieces: PieceRenderer;
}

/** Algebraic name for a square index — used as a debug/test attribute. */
function algebraicOf(index: SquareIndex): string {
  const file = index & 7;
  const rank = index >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

/**
 * Shared base style object for every slot. Pre-frozen so React's
 * shallow prop-diff short-circuits; the per-square placement is added
 * on top of this as an `inline-style` spread.
 */
const SLOT_BASE_STYLE = Object.freeze({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "none",
  containerType: "size" as const,
});

function PieceSlotImpl({ index, model, orientation, pieces }: PieceSlotProps) {
  const cell = useSquareCell(model, index);
  if (cell === 0) return null;
  const { col, row } = gridCoord(index, orientation);
  return (
    <div
      data-piece-square={algebraicOf(index)}
      data-piece-cell={cell}
      style={{ ...SLOT_BASE_STYLE, gridColumnStart: col, gridRowStart: row }}
    >
      {pieces({ cell: cell as BoardCell, square: index })}
    </div>
  );
}
const PieceSlot = memo(PieceSlotImpl);
PieceSlot.displayName = "PieceSlot";

/** Props for {@link PieceLayer}. */
export interface PieceLayerProps {
  readonly model: BoardModel;
  readonly orientation: Orientation;
  readonly pieces: PieceRenderer;
}

/**
 * CSS-grid container style. 8×8, stretches to fill the board; each
 * occupied slot drops in at its `gridColumnStart` / `gridRowStart`.
 * Frozen so the outer `<div>`'s prop identity is stable across renders.
 */
const CONTAINER_STYLE = Object.freeze({
  position: "absolute" as const,
  inset: 0,
  display: "grid" as const,
  gridTemplateColumns: "repeat(8, 1fr)",
  gridTemplateRows: "repeat(8, 1fr)",
  pointerEvents: "none" as const,
});

/**
 * Render 64 `PieceSlot` children. React keys by square index so each slot
 * has a stable identity across rerenders — necessary for M3's WAAPI
 * animation to find and animate the right DOM node.
 */
export function PieceLayer({ model, orientation, pieces }: PieceLayerProps) {
  const slots: React.ReactNode[] = [];
  for (let i = 0; i < 64; i++) {
    slots.push(
      <PieceSlot
        key={i}
        index={i as SquareIndex}
        model={model}
        orientation={orientation}
        pieces={pieces}
      />,
    );
  }
  return (
    <div aria-hidden="true" style={CONTAINER_STYLE}>
      {slots}
    </div>
  );
}
