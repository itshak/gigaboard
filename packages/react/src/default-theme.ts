import { green } from "@ultrachess/themes/green";
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

export const defaultTheme: Theme = Object.freeze({
  ...green,
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
