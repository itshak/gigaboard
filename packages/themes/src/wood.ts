/**
 * Wood theme — a deep, rich wood-grain palette.
 *
 * Darker and warmer than the default "brown" theme — reads as a real
 * tournament board. Pair with a lighter piece set (`cburnett` or `alpha`)
 * for maximum contrast.
 *
 * ```tsx
 * import { wood } from "@gigaboard/themes/wood";
 * <Chessboard game={game} theme={wood} />
 * ```
 */

import type { Theme } from "./index.js";

export const wood: Theme = Object.freeze({
  "--gb-sq-light": "#d4a574",
  "--gb-sq-dark": "#8b5a2b",
  "--gb-last-move": "rgba(247, 220, 111, 0.45)",
  "--gb-selected": "rgba(247, 220, 111, 0.58)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.16)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.32)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#8b5a2b",
  "--gb-coord-dark": "#d4a574",
});
