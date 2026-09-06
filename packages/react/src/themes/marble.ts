/**
 * Marble theme — cool Carrara white stone and veined slate grey.
 *
 * Classic architectural styling with subtle stone gradients.
 *
 * ```tsx
 * import { marble } from "gigaboard/themes/marble";
 * <Chessboard game={game} theme={marble} />
 * ```
 */

import type { Theme } from "./index.js";

export const marble: Theme = Object.freeze({
  "--gb-sq-light": "#e2e6ea",
  "--gb-sq-dark": "#727d85",
  "--gb-sq-light-image":
    "linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(0, 0, 0, 0.04) 100%)",
  "--gb-sq-dark-image":
    "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(0, 0, 0, 0.12) 100%)",
  "--gb-last-move": "rgba(70, 140, 240, 0.42)",
  "--gb-selected": "rgba(70, 140, 240, 0.58)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.14)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--gb-check": "radial-gradient(rgba(240, 40, 40, 0.6) 30%, rgba(240, 40, 40, 0) 80%)",
  "--gb-coord-light": "#727d85",
  "--gb-coord-dark": "#e2e6ea",
});
