"use client";

/**
 * FEN-only piece overlay — a pure, subscription-free twin of
 * `<PieceLayer/>` used before the engine has loaded.
 *
 * `<Chessboard/>` renders this layer when its `game` prop is `null`
 * **and** a `fallbackFen` has been supplied. The DOM it produces is
 * intentionally identical to `<PieceLayer/>`'s — same container tree,
 * same CSS-grid placement, same `data-piece-*` attributes — so when
 * the engine resolves and the interactive layer takes over, the
 * browser doesn't reflow or shift the pieces visibly.
 *
 * Because this component has no state and no effects it runs on the
 * very first commit, with no wait for `useEffect` to fire. Pieces are
 * painted inside the first frame the board DOM lays out — typically
 * under ~60 ms from navigation start on a cold mount, which is the
 * whole point of `fallbackFen`.
 *
 * Geometry helpers, slot style, and container style are imported
 * from `piece-layer.tsx` so the two layers really do produce the
 * same DOM and the shared constants dedupe in the minified bundle.
 */

import type { BoardCell, SquareIndex } from "../core/index.js";
import { CSS_VARS } from "../default-theme.js";
import type { Orientation, PieceRenderer } from "../types.js";
import { algebraicOf, CONTAINER_STYLE, gridCoord, SLOT_BASE_STYLE } from "./piece-layer.js";

/** Props for {@link StaticPieceLayer}. */
export interface StaticPieceLayerProps {
  /** Parsed FEN placement, 64 bytes, LERF indexed. */
  readonly board: Uint8Array;
  readonly orientation: Orientation;
  readonly pieces: PieceRenderer;
}

/**
 * Render one slot per occupied square — empty squares are elided so
 * the commit doesn't allocate nodes it would just have to drop. Keys
 * match the square index (matching the interactive layer) so React's
 * diff is minimal if either side of the transition re-enters.
 */
export function StaticPieceLayer({ board, orientation, pieces }: StaticPieceLayerProps) {
  const slots: React.ReactNode[] = [];
  for (let i = 0; i < 64; i++) {
    const cell = board[i] ?? 0;
    if (cell === 0) continue;
    const index = i as SquareIndex;
    const { col, row } = gridCoord(index, orientation);
    slots.push(
      <div
        key={i}
        data-piece-square={algebraicOf(index)}
        data-piece-cell={cell}
        style={{
          ...SLOT_BASE_STYLE,
          gridColumnStart: col,
          gridRowStart: row,
          filter: `var(${cell <= 6 ? CSS_VARS.PIECE_FILTER_WHITE : CSS_VARS.PIECE_FILTER_BLACK}, none)`,
        }}
      >
        {pieces({ cell: cell as BoardCell, square: index })}
      </div>,
    );
  }
  return (
    <div aria-hidden="true" style={CONTAINER_STYLE}>
      {slots}
    </div>
  );
}
