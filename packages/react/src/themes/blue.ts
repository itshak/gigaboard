/**
 * Blue theme — chess.com's "Blue" board.
 *
 * Calm, high-contrast palette that reads well on bright monitors and
 * projector setups. Light square is near-white; dark square is a muted
 * steel blue.
 *
 * ```tsx
 * import { blue } from "gigaboard/themes/blue";
 * <Chessboard game={game} theme={blue} />
 * ```
 */

import type { Theme } from "./index.js";

export const blue: Theme = Object.freeze({
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
