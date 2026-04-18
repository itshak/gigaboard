/**
 * Default piece renderer — Unicode glyphs.
 *
 * Chosen for M2 because it ships at zero asset cost, looks good at any size,
 * and exercises the same renderer contract SVG sets will use in M6. Swap in
 * a set from `@ultrachess/pieces` when you want higher-fidelity art.
 *
 * The glyphs are part of the CJK Miscellaneous Symbols block (U+2654–U+265F),
 * available in every modern system font.
 *
 * ### Element pool (perf)
 *
 * This renderer is called inside `<PieceSlot/>` on every committed move
 * that touches its square. To keep the hot path allocation-free, we
 * pre-materialise one React element per piece code (1..12) at module
 * load and hand out the same identity-stable element for every call
 * with the same cell. React's shallow-equality then short-circuits
 * reconciliation of the slot's subtree.
 */

import {
  BOARD_CELL_BB,
  BOARD_CELL_BK,
  BOARD_CELL_BN,
  BOARD_CELL_BP,
  BOARD_CELL_BQ,
  BOARD_CELL_BR,
  BOARD_CELL_WB,
  BOARD_CELL_WK,
  BOARD_CELL_WN,
  BOARD_CELL_WP,
  BOARD_CELL_WQ,
  BOARD_CELL_WR,
  type BoardCell,
} from "@ultrachess/core";
import type { ReactNode } from "react";
import type { PieceRenderer } from "../types.js";

/** Mapping from encoded board cell to the Unicode glyph. */
const GLYPH: Readonly<Record<number, string>> = Object.freeze({
  [BOARD_CELL_WK]: "\u2654", // ♔
  [BOARD_CELL_WQ]: "\u2655", // ♕
  [BOARD_CELL_WR]: "\u2656", // ♖
  [BOARD_CELL_WB]: "\u2657", // ♗
  [BOARD_CELL_WN]: "\u2658", // ♘
  [BOARD_CELL_WP]: "\u2659", // ♙
  [BOARD_CELL_BK]: "\u265A", // ♚
  [BOARD_CELL_BQ]: "\u265B", // ♛
  [BOARD_CELL_BR]: "\u265C", // ♜
  [BOARD_CELL_BB]: "\u265D", // ♝
  [BOARD_CELL_BN]: "\u265E", // ♞
  [BOARD_CELL_BP]: "\u265F", // ♟
});

/** Frozen style object — shared across the 12 pool entries. */
const GLYPH_SPAN_STYLE = Object.freeze({
  display: "block",
  width: "100%",
  height: "100%",
  fontSize: "85cqh",
  lineHeight: "1",
  textAlign: "center" as const,
  userSelect: "none" as const,
});

/** Pre-materialised element pool, keyed by cell code (0 = empty → null). */
const GLYPH_POOL: Array<ReactNode | null> = (() => {
  const pool: Array<ReactNode | null> = new Array(13).fill(null);
  for (const [cellStr, glyph] of Object.entries(GLYPH)) {
    const cell = Number(cellStr);
    pool[cell] = (
      <span aria-hidden="true" style={GLYPH_SPAN_STYLE}>
        {glyph}
      </span>
    );
  }
  return pool;
})();

/**
 * Unicode piece renderer. Returns one of twelve identity-stable React
 * elements (pre-materialised in {@link GLYPH_POOL}) so the hot path is
 * a single array read. Works under SSR, respects system fonts, and
 * scales with container font-size.
 */
export const defaultPieces: PieceRenderer = ({ cell }) => GLYPH_POOL[cell as BoardCell] ?? null;
