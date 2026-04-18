"use client";

/**
 * A single static board square.
 *
 * Static because it doesn't subscribe to the store — the dynamic content
 * (piece, highlight, coordinates) lives on sibling layers. A square renders
 * exactly once per mount; subsequent updates never touch it. This is the
 * key to the "0 re-renders per hover" budget in PERFORMANCE.md.
 */

import { type SquareIndex } from "@ultrachess/core";
import { memo, type ReactNode } from "react";
import { CSS_VARS } from "../default-theme.js";
import type { SquareContext } from "../types.js";

/** Algebraic name (`"a1"`, `"h8"`, …) for a square index. */
function algebraicOf(index: SquareIndex): string {
  const file = index & 7;
  const rank = index >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

/** Props for {@link Square}. */
export interface SquareProps {
  readonly index: SquareIndex;
  readonly onClick: (index: SquareIndex) => void;
  readonly renderSquare?: (ctx: SquareContext) => ReactNode;
}

/**
 * The cell is `role="gridcell"` with an `aria-label` so screen readers
 * announce e.g. "square e4". Pointer-events are `auto` (the default) —
 * click handling happens here, not on the piece layer above (which is
 * `pointer-events: none`).
 */
function SquareImpl({ index, onClick, renderSquare }: SquareProps) {
  const file = index & 7;
  const rank = index >> 3;
  const isLight = (file + rank) % 2 === 1;
  const label = algebraicOf(index);

  const handleClick = (): void => onClick(index);

  return (
    <div
      role="gridcell"
      aria-label={label}
      data-square={label}
      data-light={isLight ? "true" : "false"}
      onClick={handleClick}
      style={{
        position: "relative",
        background: `var(${isLight ? CSS_VARS.SQ_LIGHT : CSS_VARS.SQ_DARK})`,
        cursor: "pointer",
        userSelect: "none",
        // Squares carry the container-query context so pieces inside can
        // size relative to this cell (85cqh glyph sizing).
        containerType: "size",
      }}
    >
      {renderSquare !== undefined ? renderSquare({ index, isLight, label }) : null}
    </div>
  );
}

/**
 * Memoised square. All props are primitives or a stable callback, so memo
 * succeeds on every subsequent render of the board.
 */
export const Square = memo(SquareImpl);
Square.displayName = "Square";
