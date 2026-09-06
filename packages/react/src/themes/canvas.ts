/**
 * Canvas theme — warm textured linen/cloth tone.
 *
 * Tactile fabric feel inspired by canvas chessboards.
 *
 * ```tsx
 * import { canvas } from "gigaboard/themes/canvas";
 * <Chessboard game={game} theme={canvas} />
 * ```
 */

import type { Theme } from "./index.js";

const LINEN_PATTERN =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Cpath d=\'M0 2h4M2 0v4\' stroke=\'%23000\' stroke-width=\'0.5\' stroke-opacity=\'0.05\'/%3E%3C/svg%3E")';

export const canvas: Theme = Object.freeze({
  "--gb-sq-light": "#ede4d3",
  "--gb-sq-dark": "#a38c6d",
  "--gb-sq-light-image": LINEN_PATTERN,
  "--gb-sq-dark-image": LINEN_PATTERN,
  "--gb-sq-image-size": "4px 4px",
  "--gb-sq-blend-mode": "multiply",
  "--gb-last-move": "rgba(180, 140, 60, 0.42)",
  "--gb-selected": "rgba(180, 140, 60, 0.58)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.15)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.32)",
  "--gb-check": "radial-gradient(rgba(230, 40, 40, 0.6) 30%, rgba(230, 40, 40, 0) 80%)",
  "--gb-coord-light": "#a38c6d",
  "--gb-coord-dark": "#ede4d3",
});
