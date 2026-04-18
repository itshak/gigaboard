"use client";

/**
 * Algebraic coordinate labels on the board edges.
 *
 * Static overlay — no subscriptions. Files (a–h) render along the bottom
 * edge; ranks (1–8) along the left edge. Orientation flips the order.
 * Label colours come from `--ucr-coord-light` / `--ucr-coord-dark` so the
 * label contrasts against whichever square it sits on.
 */

import { CSS_VARS } from "../default-theme.js";
import type { Orientation } from "../types.js";

const FILE_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Props for {@link Coordinates}. */
export interface CoordinatesProps {
  readonly orientation: Orientation;
}

/**
 * Overlay of file and rank labels. `pointer-events: none` so clicks fall
 * through to squares underneath.
 */
export function Coordinates({ orientation }: CoordinatesProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontSize: "min(1.6vmin, 11px)",
        fontWeight: 600,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {FILE_LETTERS.map((letter, idx) => {
        const col = orientation === "white" ? idx : 7 - idx;
        // Bottom rank label colour depends on the bottom-row square colour at `col`.
        // Bottom rank index is 0 (white-bottom) or 7 (black-bottom). File `col`
        // on rank 0: (col + 0) % 2 === 1 → light. We want label to contrast.
        const bottomRank = orientation === "white" ? 0 : 7;
        const isLightSquare = (col + bottomRank) % 2 === 1;
        return (
          <span
            key={`file-${letter}`}
            style={{
              position: "absolute",
              left: `${col * 12.5 + 10}%`,
              bottom: "1%",
              color: `var(${isLightSquare ? CSS_VARS.COORDINATE_LIGHT : CSS_VARS.COORDINATE_DARK})`,
            }}
          >
            {letter}
          </span>
        );
      })}
      {FILE_LETTERS.map((_, idx) => {
        // Re-use letter loop for ranks; the index maps directly to 1..8.
        const rank = idx; // 0..7 corresponds to ranks 1..8
        const row = orientation === "white" ? 7 - rank : rank;
        const leftFile = orientation === "white" ? 0 : 7;
        const isLightSquare = (leftFile + rank) % 2 === 1;
        return (
          <span
            key={`rank-${rank}`}
            style={{
              position: "absolute",
              top: `${row * 12.5 + 1}%`,
              left: "1%",
              color: `var(${isLightSquare ? CSS_VARS.COORDINATE_LIGHT : CSS_VARS.COORDINATE_DARK})`,
            }}
          >
            {rank + 1}
          </span>
        );
      })}
    </div>
  );
}
