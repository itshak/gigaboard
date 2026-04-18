/**
 * Default piece renderer — Unicode glyphs.
 *
 * Chosen for M2 because it ships at zero asset cost, looks good at any size,
 * and exercises the same renderer contract SVG sets will use in M6. Swap in
 * a set from `@ultrachess/pieces` when you want higher-fidelity art.
 *
 * The glyphs are part of the CJK Miscellaneous Symbols block (U+2654–U+265F),
 * available in every modern system font.
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

/**
 * Unicode piece renderer. Rendering is pure and allocation-free: a memoised
 * glyph lookup + one `<span>`. Works under SSR, respects system fonts, and
 * scales with container font-size.
 */
export const defaultPieces: PieceRenderer = ({ cell }) => {
  const glyph = GLYPH[cell as BoardCell];
  if (glyph === undefined) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        fontSize: "85cqh",
        lineHeight: "1",
        textAlign: "center",
        userSelect: "none",
        // Monochromatic fallback: the outlined black glyphs render as
        // outlined white pieces when their color is changed via text-shadow.
        // For M2 we rely on the native solid/outline distinction of the
        // Unicode glyphs themselves.
      }}
    >
      {glyph}
    </span>
  );
};
