/**
 * Green theme — chess.com's default green/cream board.
 *
 * CSS-variable-only. Import this theme and pass it as the `theme` prop on
 * `<Chessboard/>`:
 *
 * ```tsx
 * import { green } from "gigaboard/themes/green";
 * <Chessboard game={game} theme={green} />
 * ```
 *
 * Palette tuned to visually match chess.com's board at a glance — the light
 * square is a warm off-white and the dark square is the recognisable
 * olive-green used across their web and mobile clients.
 */

import type { Theme } from "./index.js";

export const green: Theme = Object.freeze({
  "--gb-sq-light": "#eeeed2",
  "--gb-sq-dark": "#769656",
  "--gb-last-move": "rgba(255, 255, 51, 0.45)",
  "--gb-selected": "rgba(255, 255, 51, 0.55)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.14)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#769656",
  "--gb-coord-dark": "#eeeed2",
});
