/**
 * Leather theme — rich tan and distressed saddle leather tones.
 *
 * Warm and tactile, reminiscent of artisan stitched leather boards.
 *
 * ```tsx
 * import { leather } from "gigaboard/themes/leather";
 * <Chessboard game={game} theme={leather} />
 * ```
 */

import type { Theme } from "./index.js";

const LEATHER_GRAIN =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'6\' height=\'6\'%3E%3Cpath d=\'M1 1h1v1H1zM4 3h1v1H4z\' fill=\'%23000\' fill-opacity=\'0.06\'/%3E%3C/svg%3E")';

export const leather: Theme = Object.freeze({
  "--gb-sq-light": "#c89d7c",
  "--gb-sq-dark": "#704222",
  "--gb-sq-light-image": LEATHER_GRAIN,
  "--gb-sq-dark-image": LEATHER_GRAIN,
  "--gb-sq-image-size": "6px 6px",
  "--gb-sq-blend-mode": "multiply",
  "--gb-last-move": "rgba(218, 165, 32, 0.45)",
  "--gb-selected": "rgba(218, 165, 32, 0.6)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.16)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.35)",
  "--gb-check": "radial-gradient(rgba(240, 40, 40, 0.6) 30%, rgba(240, 40, 40, 0) 80%)",
  "--gb-coord-light": "#704222",
  "--gb-coord-dark": "#c89d7c",
});
