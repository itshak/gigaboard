/**
 * Brown theme — the classic lichess-inspired wood-tone board.
 *
 * CSS-variable-only. Import this theme and pass it as the `theme` prop on
 * `<Chessboard/>`:
 *
 * ```tsx
 * import { brown } from "@gigaboard/themes/brown";
 * <Chessboard game={game} theme={brown} />
 * ```
 */

import type { Theme } from "./index.js";

export const brown: Theme = Object.freeze({
  "--gb-sq-light": "#f0d9b5",
  "--gb-sq-dark": "#b58863",
  "--gb-last-move": "rgba(155, 199, 0, 0.41)",
  "--gb-selected": "rgba(20, 85, 30, 0.5)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.14)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#b58863",
  "--gb-coord-dark": "#f0d9b5",
});
