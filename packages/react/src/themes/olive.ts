/**
 * Olive theme — warm sage cream and muted earthy olive.
 *
 * Muted, natural tone that is gentle on the eyes during extended play.
 *
 * ```tsx
 * import { olive } from "gigaboard/themes/olive";
 * <Chessboard game={game} theme={olive} />
 * ```
 */

import type { Theme } from "./index.js";

export const olive: Theme = Object.freeze({
  "--gb-sq-light": "#e8e4c9",
  "--gb-sq-dark": "#748259",
  "--gb-last-move": "rgba(205, 220, 57, 0.45)",
  "--gb-selected": "rgba(205, 220, 57, 0.6)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.14)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#748259",
  "--gb-coord-dark": "#e8e4c9",
});
