"use client";

/**
 * Ghost-piece overlay for pending premoves.
 *
 * Subscribes to `snapshot.premoves`. If a premove is queued we render a
 * blue tint on its target square plus a translucent ghost of the moving
 * piece at that target. The ghost uses the caller's `pieces` renderer so
 * theme consistency is automatic.
 *
 * For M4 we only render the **first** queued premove. Chained premoves
 * would need to project the board state forward through every pending
 * move — tractable, but out of scope here. The engine still processes
 * every queued premove in order once the opponent plays; this is strictly
 * a visual simplification.
 */

import type { BoardCell, BoardModel, SquareIndex } from "@ultrachess/core";
import { DEFAULT_PREMOVE_TINT } from "../default-theme.js";
import { useBoardSlice, useSquareCell } from "../hooks/use-board-subscription.js";
import type { Orientation, PieceRenderer } from "../types.js";

/** CSS-percentage position of the square inside the board. */
function positionOf(
  index: SquareIndex,
  orientation: Orientation,
): {
  x: number;
  y: number;
} {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { x: col * 12.5, y: row * 12.5 };
}

/** Props for {@link PremoveLayer}. */
export interface PremoveLayerProps {
  readonly model: BoardModel;
  readonly orientation: Orientation;
  readonly pieces: PieceRenderer;
}

/**
 * Renders `null` when the premove queue is empty.
 *
 * Two-tier structure: the outer shell only subscribes to the `premoves`
 * slice (changes rarely). The inner component, which subscribes to the
 * specific from-square byte, is mounted only while a premove is queued —
 * so no `board` subscription is paid for during the bulk of the game.
 */
export function PremoveLayer({ model, orientation, pieces }: PremoveLayerProps) {
  const premoves = useBoardSlice(model, (s) => s.premoves);
  if (premoves.length === 0) return null;
  const head = premoves[0];
  if (head === undefined) return null;
  return (
    <PremoveLayerInner
      model={model}
      orientation={orientation}
      pieces={pieces}
      from={head.from}
      to={head.to}
    />
  );
}

interface PremoveLayerInnerProps {
  readonly model: BoardModel;
  readonly orientation: Orientation;
  readonly pieces: PieceRenderer;
  readonly from: SquareIndex;
  readonly to: SquareIndex;
}

function PremoveLayerInner({ model, orientation, pieces, from, to }: PremoveLayerInnerProps) {
  const cell = useSquareCell(model, from) as BoardCell;
  if (cell === 0) return null;
  const origin = positionOf(from, orientation);
  const target = positionOf(to, orientation);

  return (
    <div
      data-layer="premove"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4,
      }}
    >
      {/* Origin tint (faint, so the piece still reads through). */}
      <div
        style={{
          position: "absolute",
          left: `${origin.x}%`,
          top: `${origin.y}%`,
          width: "12.5%",
          height: "12.5%",
          background: DEFAULT_PREMOVE_TINT,
          opacity: 0.5,
        }}
      />
      {/* Target tint + ghost piece. */}
      <div
        style={{
          position: "absolute",
          left: `${target.x}%`,
          top: `${target.y}%`,
          width: "12.5%",
          height: "12.5%",
          background: DEFAULT_PREMOVE_TINT,
        }}
      />
      <div
        data-premove-ghost="true"
        style={{
          position: "absolute",
          left: `${target.x}%`,
          top: `${target.y}%`,
          width: "12.5%",
          height: "12.5%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.55,
          containerType: "size",
        }}
      >
        {pieces({ cell, square: to })}
      </div>
    </div>
  );
}
