/**
 * IC theme — icy grey and cold steel blue.
 *
 * Minimalist tournament styling popular in desktop chess GUIs.
 *
 * ```tsx
 * import { ic } from "gigaboard/themes/ic";
 * <Chessboard game={game} theme={ic} />
 * ```
 */

import type { Theme } from "./index.js";

export const ic: Theme = Object.freeze({
  "--gb-sq-light": "#eceef2",
  "--gb-sq-dark": "#bac3c7",
  "--gb-last-move": "rgba(100, 160, 220, 0.45)",
  "--gb-selected": "rgba(100, 160, 220, 0.6)",
  "--gb-legal-target": "rgba(0, 0, 0, 0.15)",
  "--gb-legal-target-capture": "rgba(0, 0, 0, 0.3)",
  "--gb-check": "radial-gradient(rgba(255, 0, 0, 0.55) 30%, rgba(255, 0, 0, 0) 80%)",
  "--gb-coord-light": "#bac3c7",
  "--gb-coord-dark": "#eceef2",
});
