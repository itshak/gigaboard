/**
 * Tritanopia theme — accessible palette scientifically tuned for blue-yellow color blindness.
 *
 * Employs clean seafoam teal and muted salmon tones paired with rich magenta/violet
 * highlights to ensure clarity for blue-yellow color vision deficiency.
 *
 * ```tsx
 * import { tritanopia } from "gigaboard/themes/tritanopia";
 * <Chessboard game={game} theme={tritanopia} />
 * ```
 */

import type { Theme } from "./index.js";

export const tritanopia: Theme = Object.freeze({
  "--gb-sq-light": "#d6ece5",
  "--gb-sq-dark": "#c75d5d",
  "--gb-piece-filter-white": "drop-shadow(0 0 1px rgba(0, 0, 0, 0.6))",
  "--gb-piece-filter-black": "drop-shadow(0 0 1px rgba(255, 255, 255, 0.6))",
  "--gb-last-move": "rgba(160, 32, 240, 0.45)",
  "--gb-selected": "rgba(160, 32, 240, 0.65)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.18)",
  "--gb-legal-target-capture": "rgba(160, 32, 240, 0.55)",
  "--gb-check": "radial-gradient(rgba(220, 20, 60, 0.7) 30%, rgba(220, 20, 60, 0) 80%)",
  "--gb-coord-light": "#c75d5d",
  "--gb-coord-dark": "#d6ece5",
});
