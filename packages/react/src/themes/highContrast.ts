/**
 * High-Contrast theme — pure black and white with enhanced piece outline filters.
 *
 * Engineered for low-vision accessibility and extreme visibility environments.
 *
 * ```tsx
 * import { highContrast } from "gigaboard/themes/highContrast";
 * <Chessboard game={game} theme={highContrast} />
 * ```
 */

import type { Theme } from "./index.js";

export const highContrast: Theme = Object.freeze({
  "--gb-sq-light": "#ffffff",
  "--gb-sq-dark": "#000000",
  "--gb-piece-filter-white": "drop-shadow(0 0 2px #000000) drop-shadow(0 0 1px #000000)",
  "--gb-piece-filter-black": "drop-shadow(0 0 2px #ffffff) drop-shadow(0 0 1px #ffffff)",
  "--gb-last-move": "rgba(255, 255, 0, 0.6)",
  "--gb-selected": "rgba(0, 255, 255, 0.7)",
  "--gb-legal-target": "rgba(128, 128, 128, 0.5)",
  "--gb-legal-target-capture": "rgba(255, 0, 0, 0.6)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.85) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#000000",
  "--gb-coord-dark": "#ffffff",
});
