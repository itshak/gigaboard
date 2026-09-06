/**
 * Chess.com Blue theme — exact standard web blue/slate palette.
 *
 * ```tsx
 * import { chesscomBlue } from "gigaboard/themes/chesscomBlue";
 * <Chessboard game={game} theme={chesscomBlue} />
 * ```
 */

import type { Theme } from "./index.js";

export const chesscomBlue: Theme = Object.freeze({
  "--gb-sq-light": "#dee3e6",
  "--gb-sq-dark": "#8ca2ad",
  "--gb-last-move": "rgba(122, 178, 216, 0.5)",
  "--gb-selected": "rgba(122, 178, 216, 0.65)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.14)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#8ca2ad",
  "--gb-coord-dark": "#dee3e6",
});
