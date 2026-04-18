"use client";

/**
 * Piece overlay: 64 `PieceSlot` children, one per square. Each slot
 * subscribes to a single byte of the board snapshot — so a move that
 * touches 2–4 bytes wakes 2–4 slots, not all 64.
 *
 * The layer itself (`pointer-events: none`) never intercepts clicks; the
 * board grid beneath owns pointer events. Pieces are positioned as
 * percentages of the board dimensions, making the layout resolution-
 * independent.
 */

import type { BoardCell, BoardModel, SquareIndex } from "@ultrachess/core";
import { memo } from "react";
import { useSquareCell } from "../hooks/use-board-subscription.js";
import type { Orientation, PieceRenderer } from "../types.js";

/** Compute the `(left%, top%)` CSS offsets for a square. */
function positionOf(index: SquareIndex, orientation: Orientation): { x: number; y: number } {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { x: col * 12.5, y: row * 12.5 };
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

function PieceSlotImpl({ index, model, orientation, pieces }: PieceSlotProps) {
  const cell = useSquareCell(model, index);
  if (cell === 0) return null;
  const { x, y } = positionOf(index, orientation);
  return (
    <div
      data-piece-square={algebraicOf(index)}
      data-piece-cell={cell}
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: "12.5%",
        height: "12.5%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        containerType: "size",
      }}
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
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {slots}
    </div>
  );
}
