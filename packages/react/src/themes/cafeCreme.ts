/**
 * Café Crème theme — soft latte and roasted almond palette with subtle woven texture.
 *
 * Inspired by classic French café aesthetic.
 *
 * ```tsx
 * import { cafeCreme } from "gigaboard/themes/cafeCreme";
 * <Chessboard game={game} theme={cafeCreme} />
 * ```
 */

import type { Theme } from "./index.js";

const WOVEN_LIGHT =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'6\' height=\'6\'%3E%3Ccircle cx=\'1\' cy=\'1\' r=\'0.6\' fill=\'%23000\' fill-opacity=\'0.04\'/%3E%3Ccircle cx=\'4\' cy=\'4\' r=\'0.6\' fill=\'%23fff\' fill-opacity=\'0.08\'/%3E%3C/svg%3E")';

const WOVEN_DARK =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'6\' height=\'6\'%3E%3Ccircle cx=\'1\' cy=\'1\' r=\'0.6\' fill=\'%23000\' fill-opacity=\'0.08\'/%3E%3Ccircle cx=\'4\' cy=\'4\' r=\'0.6\' fill=\'%23fff\' fill-opacity=\'0.05\'/%3E%3C/svg%3E")';

export const cafeCreme: Theme = Object.freeze({
  "--gb-sq-light": "#f7ece1",
  "--gb-sq-dark": "#b88b58",
  "--gb-sq-light-image": WOVEN_LIGHT,
  "--gb-sq-dark-image": WOVEN_DARK,
  "--gb-sq-image-size": "6px 6px",
  "--gb-sq-blend-mode": "overlay",
  "--gb-last-move": "rgba(180, 140, 60, 0.4)",
  "--gb-selected": "rgba(180, 140, 60, 0.55)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.14)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#b88b58",
  "--gb-coord-dark": "#f7ece1",
});
