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
});
