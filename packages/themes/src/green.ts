/**
 * Green theme — chess.com's default green/cream board.
 *
 * CSS-variable-only. Import this theme and pass it as the `theme` prop on
 * `<Chessboard/>`:
 *
 * ```tsx
 * import { green } from "@ultrachess/themes/green";
 * <Chessboard game={game} theme={green} />
 * ```
 *
 * Palette tuned to visually match chess.com's board at a glance — the light
 * square is a warm off-white and the dark square is the recognisable
 * olive-green used across their web and mobile clients.
 */

import type { Theme } from "./index.js";

export const green: Theme = Object.freeze({
  "--ucr-sq-light": "#eeeed2",
  "--ucr-sq-dark": "#769656",
  "--ucr-last-move": "rgba(255, 255, 51, 0.45)",
  "--ucr-selected": "rgba(255, 255, 51, 0.55)",
  "--ucr-legal-target": "rgba(0, 0, 0, 0.14)",
  "--ucr-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--ucr-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--ucr-coord-light": "#769656",
  "--ucr-coord-dark": "#eeeed2",
});
