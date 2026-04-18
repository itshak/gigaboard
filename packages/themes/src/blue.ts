/**
 * Blue theme — chess.com's "Blue" board.
 *
 * Calm, high-contrast palette that reads well on bright monitors and
 * projector setups. Light square is near-white; dark square is a muted
 * steel blue.
 *
 * ```tsx
 * import { blue } from "@ultrachess/themes/blue";
 * <Chessboard game={game} theme={blue} />
 * ```
 */

import type { Theme } from "./index.js";

export const blue: Theme = Object.freeze({
  "--ucr-sq-light": "#dee3e6",
  "--ucr-sq-dark": "#8ca2ad",
  "--ucr-last-move": "rgba(122, 178, 216, 0.5)",
  "--ucr-selected": "rgba(122, 178, 216, 0.65)",
  "--ucr-legal-target": "rgba(0, 0, 0, 0.14)",
  "--ucr-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--ucr-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--ucr-coord-light": "#8ca2ad",
  "--ucr-coord-dark": "#dee3e6",
});
