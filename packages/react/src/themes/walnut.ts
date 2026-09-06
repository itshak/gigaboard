/**
 * Walnut theme — deep American walnut heartwood with honey sapwood light squares.
 *
 * Rich furniture-grade tournament board aesthetics.
 *
 * ```tsx
 * import { walnut } from "gigaboard/themes/walnut";
 * <Chessboard game={game} theme={walnut} />
 * ```
 */

import type { Theme } from "./index.js";

export const walnut: Theme = Object.freeze({
  "--gb-sq-light": "#c9a070",
  "--gb-sq-dark": "#593a22",
  "--gb-sq-light-image":
    "linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 0%, rgba(0, 0, 0, 0.06) 100%)",
  "--gb-sq-dark-image":
    "linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 0%, rgba(0, 0, 0, 0.12) 100%)",
  "--gb-last-move": "rgba(235, 180, 60, 0.45)",
  "--gb-selected": "rgba(235, 180, 60, 0.6)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.16)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.32)",
  "--gb-check": "radial-gradient(rgba(240, 40, 40, 0.6) 30%, rgba(240, 40, 40, 0) 80%)",
  "--gb-coord-light": "#593a22",
  "--gb-coord-dark": "#c9a070",
});
