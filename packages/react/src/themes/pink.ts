/**
 * Pink theme — soft pastel rose and muted crimson.
 *
 * Playful, elegant palette with clear contrast.
 *
 * ```tsx
 * import { pink } from "gigaboard/themes/pink";
 * <Chessboard game={game} theme={pink} />
 * ```
 */

import type { Theme } from "./index.js";

export const pink: Theme = Object.freeze({
  "--gb-sq-light": "#f9e4e8",
  "--gb-sq-dark": "#c46d85",
  "--gb-last-move": "rgba(255, 105, 180, 0.4)",
  "--gb-selected": "rgba(255, 105, 180, 0.6)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.15)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.32)",
  "--gb-check": "radial-gradient(rgba(220, 20, 60, 0.65) 30%, rgba(220, 20, 60, 0) 80%)",
  "--gb-coord-light": "#c46d85",
  "--gb-coord-dark": "#f9e4e8",
});
