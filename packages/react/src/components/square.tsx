"use client";

/**
 * A single static board square.
 *
 * Static in content — dynamic highlights and pieces live on sibling
 * overlays, so a square renders exactly once per mount except when its
 * `isFocused` prop flips (for roving tabindex). This preserves the
 * "0 re-renders per hover" budget in PERFORMANCE.md.
 *
 * ### ARIA grid pattern
 *
 * - `role="gridcell"` with algebraic `aria-label` so screen readers
 *   announce "square e4".
 * - `aria-rowindex` / `aria-colindex` let assistive tech describe the
 *   cell's grid position without relying on row groups in the DOM.
 * - Roving tabindex: the one focused cell has `tabindex=0`, every other
 *   cell has `tabindex=-1`. Tab steps into the board once, then out.
 * - When the `isFocused` prop flips to `true`, the cell programmatically
 *   focuses itself via a `useEffect` — this keeps the DOM focus in sync
 *   with the React-driven focus state.
 */

import type { SquareIndex } from "@ultrachess/core";
import { memo, type ReactNode, useEffect, useRef } from "react";
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
  /**
   * `true` for the single square that currently owns the roving tabindex.
   * When this flips to `true`, the cell focuses itself programmatically.
   */
  readonly isFocused: boolean;
}

function SquareImpl({ index, onClick, renderSquare, isFocused }: SquareProps) {
  const file = index & 7;
  const rank = index >> 3;
  const isLight = (file + rank) % 2 === 1;
  const label = algebraicOf(index);

  const ref = useRef<HTMLDivElement | null>(null);

  // When focus state flips to `true`, move DOM focus to this cell — the
  // React state is the source of truth for which cell has the roving
  // tabindex.
  useEffect(() => {
    if (!isFocused) return;
    const el = ref.current;
    if (el === null) return;
    // Only focus if we aren't already, to avoid thrashing.
    if (document.activeElement !== el) el.focus();
  }, [isFocused]);

  const handleClick = (): void => onClick(index);

  return (
    <div
      ref={ref}
      role="gridcell"
      aria-label={label}
      aria-rowindex={rank + 1}
      aria-colindex={file + 1}
      tabIndex={isFocused ? 0 : -1}
      data-square={label}
      data-light={isLight ? "true" : "false"}
      onClick={handleClick}
      style={{
        position: "relative",
        background: `var(${isLight ? CSS_VARS.SQ_LIGHT : CSS_VARS.SQ_DARK})`,
        cursor: "pointer",
        userSelect: "none",
        outline: "none",
        boxShadow: isFocused ? "inset 0 0 0 3px rgba(255, 206, 76, 0.95)" : "none",
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
 * Memoised square. All props are primitives or stable callbacks — memo
 * skips re-render for every square whose `isFocused` flag didn't flip,
 * so arrow-key navigation re-renders exactly 2 squares (old + new).
 */
export const Square = memo(SquareImpl);
Square.displayName = "Square";
