/**
 * Espresso theme — warm cream & deep roast coffee tones with subtle grain texture.
 *
 * Designed for comfortable long-session analysis with rich roasted coffee hues.
 *
 * ```tsx
 * import { espresso } from "gigaboard/themes/espresso";
 * <Chessboard game={game} theme={espresso} />
 * ```
 */

import type { Theme } from "./index.js";

const GRAIN_LIGHT =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Crect width=\'1\' height=\'1\' fill=\'%235c3826\' fill-opacity=\'0.06\'/%3E%3Crect x=\'2\' y=\'2\' width=\'1\' height=\'1\' fill=\'%23ffffff\' fill-opacity=\'0.08\'/%3E%3C/svg%3E")';

const GRAIN_DARK =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'4\' height=\'4\'%3E%3Crect width=\'1\' height=\'1\' fill=\'%23000000\' fill-opacity=\'0.12\'/%3E%3Crect x=\'2\' y=\'2\' width=\'1\' height=\'1\' fill=\'%23ffffff\' fill-opacity=\'0.05\'/%3E%3C/svg%3E")';

export const espresso: Theme = Object.freeze({
  "--gb-sq-light": "#ebd3be",
  "--gb-sq-dark": "#6f4e37",
  "--gb-sq-light-image": GRAIN_LIGHT,
  "--gb-sq-dark-image": GRAIN_DARK,
  "--gb-sq-image-size": "4px 4px",
  "--gb-sq-blend-mode": "overlay",
  "--gb-last-move": "rgba(212, 163, 89, 0.45)",
  "--gb-selected": "rgba(212, 163, 89, 0.6)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.16)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.32)",
  "--gb-check": "radial-gradient(rgba(230, 40, 40, 0.6) 30%, rgba(230, 40, 40, 0) 80%)",
  "--gb-coord-light": "#6f4e37",
  "--gb-coord-dark": "#ebd3be",
});
