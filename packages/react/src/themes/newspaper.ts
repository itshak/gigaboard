/**
 * Newspaper theme — high-contrast monochrome with diagonal hatching pattern.
 *
 * Inspired by Lichess Newspaper. Light squares feature subtle diagonal lines,
 * and dark squares feature dense cross-hatch patterning using an embedded
 * zero-HTTP SVG data URI.
 *
 * ```tsx
 * import { newspaper } from "gigaboard/themes/newspaper";
 * <Chessboard game={game} theme={newspaper} />
 * ```
 */

import type { Theme } from "./index.js";

const LIGHT_HATCH =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\'%3E%3Cpath d=\'M0 8L8 0M-1 1L1 -1M7 9L9 7\' stroke=\'%23000\' stroke-width=\'1\' stroke-opacity=\'0.08\'/%3E%3C/svg%3E")';

const DARK_HATCH =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'8\' height=\'8\'%3E%3Cpath d=\'M0 8L8 0M-1 1L1 -1M7 9L9 7\' stroke=\'%23000\' stroke-width=\'1.5\' stroke-opacity=\'0.2\'/%3E%3C/svg%3E")';

export const newspaper: Theme = Object.freeze({
  "--gb-sq-light": "#ffffff",
  "--gb-sq-dark": "#b8b8b8",
  "--gb-sq-light-image": LIGHT_HATCH,
  "--gb-sq-dark-image": DARK_HATCH,
  "--gb-sq-image-size": "8px 8px",
  "--gb-sq-blend-mode": "multiply",
  "--gb-piece-filter-white": "drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.45))",
  "--gb-piece-filter-black": "drop-shadow(0 1px 1.5px rgba(255, 255, 255, 0.35))",
  "--gb-last-move": "rgba(0, 0, 0, 0.22)",
  "--gb-selected": "rgba(0, 0, 0, 0.32)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.2)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.38)",
  "--gb-check": "radial-gradient(rgba(200, 0, 0, 0.6) 30%, rgba(200, 0, 0, 0) 80%)",
  "--gb-coord-light": "#777777",
  "--gb-coord-dark": "#ffffff",
});
