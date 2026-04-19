/**
 * Fallback built-in theme applied when no `theme` prop is provided.
 *
 * Values match `@ultrachess/themes/brown` so consumers get a sensible default
 * without pulling the themes package. If `@ultrachess/themes/brown` is
 * imported, its values will override these (they write to the same CSS
 * custom properties).
 */

import type { Theme } from "./types.js";

/** Keys every Ultra Chess React board understands. */
export const CSS_VARS = {
  SQ_LIGHT: "--ucr-sq-light",
  SQ_DARK: "--ucr-sq-dark",
  LAST_MOVE: "--ucr-last-move",
  SELECTED: "--ucr-selected",
  LEGAL_TARGET: "--ucr-legal-target",
  LEGAL_TARGET_CAPTURE: "--ucr-legal-target-capture",
  CHECK: "--ucr-check",
  COORDINATE_LIGHT: "--ucr-coord-light",
  COORDINATE_DARK: "--ucr-coord-dark",
  /**
   * Opacity of the piece left behind at the drag origin while the ghost
   * is in flight. Default `0.35` (lichess parity). Themes may override
   * to `0` for a chess.com-style "piece vanishes" effect.
   */
  DRAG_GHOST_OPACITY: "--ucr-drag-ghost-opacity",
} as const;

/** The default built-in theme (brown, matches `@ultrachess/themes/brown`). */
export const defaultTheme: Theme = Object.freeze({
  [CSS_VARS.SQ_LIGHT]: "#f0d9b5",
  [CSS_VARS.SQ_DARK]: "#b58863",
  [CSS_VARS.LAST_MOVE]: "rgba(155, 199, 0, 0.41)",
  [CSS_VARS.SELECTED]: "rgba(20, 85, 30, 0.5)",
  [CSS_VARS.LEGAL_TARGET]: "rgba(0, 0, 0, 0.14)",
  [CSS_VARS.LEGAL_TARGET_CAPTURE]: "rgba(0, 0, 0, 0.3)",
  [CSS_VARS.CHECK]: "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  [CSS_VARS.COORDINATE_LIGHT]: "#b58863",
  [CSS_VARS.COORDINATE_DARK]: "#f0d9b5",
  [CSS_VARS.DRAG_GHOST_OPACITY]: "0.35",
});

/**
 * Default arrow-channel colours. Close to lichess's palette so arrows feel
 * familiar to players migrating over.
 */
export const defaultArrowColors = Object.freeze({
  default: "rgba(21, 120, 27, 0.8)",
  shift: "rgba(153, 40, 40, 0.8)",
  alt: "rgba(230, 160, 0, 0.8)",
  ctrl: "rgba(0, 60, 130, 0.8)",
});

/** Distinct blue tint used to preview pending premoves. */
export const DEFAULT_PREMOVE_TINT = "rgba(30, 98, 255, 0.4)";

/** Red tint used to announce rejected moves. */
export const DEFAULT_ILLEGAL_FLASH_TINT = "rgba(220, 40, 40, 0.55)";
