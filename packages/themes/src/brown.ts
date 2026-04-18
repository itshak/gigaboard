/**
 * Brown theme — the classic lichess-inspired wood-tone board.
 *
 * CSS-variable-only. Import this theme and pass it as the `theme` prop on
 * `<Chessboard/>`:
 *
 * ```tsx
 * import { brown } from "@ultrachess/themes/brown";
 * <Chessboard game={game} theme={brown} />
 * ```
 */

import type { Theme } from "./index.js";

export const brown: Theme = Object.freeze({
  "--ucr-sq-light": "#f0d9b5",
  "--ucr-sq-dark": "#b58863",
  "--ucr-last-move": "rgba(155, 199, 0, 0.41)",
  "--ucr-selected": "rgba(20, 85, 30, 0.5)",
  "--ucr-legal-target": "rgba(0, 0, 0, 0.14)",
  "--ucr-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--ucr-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--ucr-coord-light": "#b58863",
  "--ucr-coord-dark": "#f0d9b5",
});
