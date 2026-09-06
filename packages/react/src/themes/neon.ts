/**
 * Neon theme — cyberpunk electric cyan and deep midnight navy.
 *
 * Vivid high-energy palette with glowing piece filter accents.
 *
 * ```tsx
 * import { neon } from "gigaboard/themes/neon";
 * <Chessboard game={game} theme={neon} />
 * ```
 */

import type { Theme } from "./index.js";

export const neon: Theme = Object.freeze({
  "--gb-sq-light": "#00e5ff",
  "--gb-sq-dark": "#121a36",
  "--gb-piece-filter-white": "drop-shadow(0 0 2px #00e5ff)",
  "--gb-piece-filter-black": "drop-shadow(0 0 2px #ff007f)",
  "--gb-last-move": "rgba(255, 0, 128, 0.45)",
  "--gb-selected": "rgba(255, 0, 128, 0.65)",
  "--gb-legal-target": "rgba(0, 229, 255, 0.3)",
  "--gb-legal-target-capture": "rgba(255, 0, 128, 0.5)",
  "--gb-check": "radial-gradient(rgba(255, 0, 80, 0.8) 30%, rgba(255, 0, 80, 0) 80%)",
  "--gb-coord-light": "#121a36",
  "--gb-coord-dark": "#00e5ff",
});
