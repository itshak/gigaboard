/**
 * Purple theme — lavender and deep royal violet.
 *
 * Elegant, royal aesthetic with crisp square definition.
 *
 * ```tsx
 * import { purple } from "gigaboard/themes/purple";
 * <Chessboard game={game} theme={purple} />
 * ```
 */

import type { Theme } from "./index.js";

export const purple: Theme = Object.freeze({
  "--gb-sq-light": "#e1d5e7",
  "--gb-sq-dark": "#825a99",
  "--gb-last-move": "rgba(186, 104, 200, 0.45)",
  "--gb-selected": "rgba(186, 104, 200, 0.65)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.16)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.32)",
  "--gb-check": "radial-gradient(rgba(255, 0, 60, 0.6) 30%, rgba(255, 0, 60, 0) 80%)",
  "--gb-coord-light": "#825a99",
  "--gb-coord-dark": "#e1d5e7",
});
