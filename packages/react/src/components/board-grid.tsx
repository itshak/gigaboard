"use client";

/**
 * The 8×8 grid of {@link Square} cells. Laid out with CSS Grid so browser
 * layout does all the work; we just emit the squares in the right order
 * based on orientation.
 *
 * The grid is static and never re-renders after mount. Dynamic content
 * (highlights, pieces, coordinates) lives on absolutely-positioned sibling
 * layers inside the board container.
 */

import type { SquareIndex } from "@ultrachess/core";
import { type ReactNode, useMemo } from "react";
import type { Orientation, SquareContext } from "../types.js";
import { Square } from "./square.js";

/** Build the order squares should appear in for a given orientation. */
function buildSquareOrder(orientation: Orientation): SquareIndex[] {
  const squares: SquareIndex[] = [];
  if (orientation === "white") {
    // White at bottom: rank 7 (top) first, rank 0 (bottom) last.
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        squares.push((rank * 8 + file) as SquareIndex);
      }
    }
  } else {
    // Black at bottom: rank 0 (top) first, rank 7 (bottom) last, files flipped.
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 7; file >= 0; file--) {
        squares.push((rank * 8 + file) as SquareIndex);
      }
    }
  }
  return squares;
}

/** Props for {@link BoardGrid}. */
export interface BoardGridProps {
  readonly orientation: Orientation;
  readonly onSquareClick: (index: SquareIndex) => void;
  readonly renderSquare?: (ctx: SquareContext) => ReactNode;
  readonly ariaLabel?: string;
  /**
   * Index of the square that currently owns the roving `tabindex=0`.
   * `null` means no cell in the grid is focused — the user hasn't Tabbed
   * into the board yet.
   */
  readonly focusedSquare: SquareIndex | null;
  /**
   * Stable setter that receives each square's DOM node on mount /
   * unmount. The selection controller uses the resulting refs array to
   * paint highlights imperatively — no React state, no reconciliation.
   */
  readonly setSquareRef?: (index: SquareIndex, el: HTMLElement | null) => void;
}

/**
 * The static 8×8 grid. Re-renders only on orientation / focus changes.
 * When `focusedSquare` flips, only the two affected `Square` children
 * re-render (old + new) thanks to `React.memo` on `Square`.
 */
export function BoardGrid({
  orientation,
  onSquareClick,
  renderSquare,
  ariaLabel,
  focusedSquare,
  setSquareRef,
}: BoardGridProps) {
  const squares = useMemo(() => buildSquareOrder(orientation), [orientation]);

  return (
    <div
      role="grid"
      aria-label={ariaLabel ?? "Chess board"}
      aria-rowcount={8}
      aria-colcount={8}
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
      }}
    >
      {squares.map((index) => (
        <Square
          key={index}
          index={index}
          onClick={onSquareClick}
          isFocused={focusedSquare === index}
          {...(renderSquare !== undefined ? { renderSquare } : {})}
          {...(setSquareRef !== undefined ? { setSquareRef } : {})}
        />
      ))}
    </div>
  );
}
