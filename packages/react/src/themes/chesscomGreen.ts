/**
 * Chess.com Green theme — exact standard web green/cream palette.
 *
 * ```tsx
 * import { chesscomGreen } from "gigaboard/themes/chesscomGreen";
 * <Chessboard game={game} theme={chesscomGreen} />
 * ```
 */

import type { Theme } from "./index.js";

export const chesscomGreen: Theme = Object.freeze({
  "--gb-sq-light": "#eeeed2",
  "--gb-sq-dark": "#769656",
  "--gb-last-move": "rgba(255, 255, 51, 0.5)",
  "--gb-selected": "rgba(255, 255, 51, 0.6)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.14)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#769656",
  "--gb-coord-dark": "#eeeed2",
});
