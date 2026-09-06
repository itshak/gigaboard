/**
 * Deuteranopia theme — accessible palette scientifically tuned for red-green color blindness.
 *
 * Replaces red/green cues with high-contrast cobalt blue, warm ivory, and golden-amber
 * highlights to guarantee unambiguous piece and square recognition.
 *
 * ```tsx
 * import { deuteranopia } from "gigaboard/themes/deuteranopia";
 * <Chessboard game={game} theme={deuteranopia} />
 * ```
 */

import type { Theme } from "./index.js";

export const deuteranopia: Theme = Object.freeze({
  "--gb-sq-light": "#f2eee3",
  "--gb-sq-dark": "#3b6998",
  "--gb-piece-filter-white": "drop-shadow(0 0 1px rgba(0, 0, 0, 0.7))",
  "--gb-piece-filter-black": "drop-shadow(0 0 1px rgba(255, 255, 255, 0.7))",
  "--gb-last-move": "rgba(255, 191, 0, 0.5)",
  "--gb-selected": "rgba(255, 191, 0, 0.7)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.18)",
  "--gb-legal-target-capture": "rgba(255, 191, 0, 0.6)",
  "--gb-check": "radial-gradient(rgba(0, 100, 255, 0.75) 30%, rgba(0, 100, 255, 0) 80%)",
  "--gb-coord-light": "#3b6998",
  "--gb-coord-dark": "#f2eee3",
});
