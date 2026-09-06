/**
 * Dark Wood theme — golden-brown teak light squares and deep ebony dark squares.
 *
 * High-contrast dark board with subtle piece filters for readability.
 *
 * ```tsx
 * import { darkWood } from "gigaboard/themes/darkWood";
 * <Chessboard game={game} theme={darkWood} />
 * ```
 */

import type { Theme } from "./index.js";

export const darkWood: Theme = Object.freeze({
  "--gb-sq-light": "#9e6b45",
  "--gb-sq-dark": "#3d2314",
  "--gb-sq-light-image":
    "linear-gradient(to bottom, rgba(255, 255, 255, 0.06) 0%, rgba(0, 0, 0, 0.08) 100%)",
  "--gb-sq-dark-image":
    "linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 0%, rgba(0, 0, 0, 0.16) 100%)",
  "--gb-piece-filter-black": "drop-shadow(0 0 1.5px rgba(255, 255, 255, 0.45))",
  "--gb-last-move": "rgba(240, 195, 75, 0.48)",
  "--gb-selected": "rgba(240, 195, 75, 0.62)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.2)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.4)",
  "--gb-check": "radial-gradient(rgba(240, 40, 40, 0.6) 30%, rgba(240, 40, 40, 0) 80%)",
  "--gb-coord-light": "#3d2314",
  "--gb-coord-dark": "#9e6b45",
});
