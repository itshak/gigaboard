/**
 * `gigaboard/themes` — CSS-variable-only board themes.
 *
 * Each theme ships as a frozen record of CSS custom-property pairs that the
 * React layer writes inline on the board container at first paint. Themes
 * are CSS-only and carry zero runtime cost beyond the one-time variable
 * assignment.
 *
 * Import sub-paths to keep bundles minimal:
 *
 * ```tsx
 * import { brown } from "gigaboard/themes/brown";
 * import { green } from "gigaboard/themes/green";  // chess.com default
 * import { blue }  from "gigaboard/themes/blue";
 * import { wood }  from "gigaboard/themes/wood";
 * ```
 *
 * Or pull the full set from the package root (convenient for theme pickers,
 * at a marginally larger bundle cost):
 *
 * ```tsx
 * import { brown, green, blue, wood } from "gigaboard/themes";
 * ```
 */

import { blue } from "./blue.js";
import { brown } from "./brown.js";
import { cafeCreme } from "./cafeCreme.js";
import { canvas } from "./canvas.js";
import { chesscomBlue } from "./chesscomBlue.js";
import { chesscomGreen } from "./chesscomGreen.js";
import { darkWood } from "./darkWood.js";
import { deuteranopia } from "./deuteranopia.js";
import { espresso } from "./espresso.js";
import { green } from "./green.js";
import { highContrast } from "./highContrast.js";
import { ic } from "./ic.js";
import { leather } from "./leather.js";
import { marble } from "./marble.js";
import { neon } from "./neon.js";
import { newspaper } from "./newspaper.js";
import { olive } from "./olive.js";
import { pink } from "./pink.js";
import { purple } from "./purple.js";
import { tritanopia } from "./tritanopia.js";
import { walnut } from "./walnut.js";
import { wood } from "./wood.js";

/** Shape of a board theme: CSS custom-property pairs. */
export type Theme = Readonly<Record<string, string>>;

export {
  blue,
  brown,
  cafeCreme,
  canvas,
  chesscomBlue,
  chesscomGreen,
  darkWood,
  deuteranopia,
  espresso,
  green,
  highContrast,
  ic,
  leather,
  marble,
  neon,
  newspaper,
  olive,
  pink,
  purple,
  tritanopia,
  walnut,
  wood,
};

/** Registry mapping a theme name to its theme object. */
export const themes = Object.freeze({
  blue,
  brown,
  cafeCreme,
  canvas,
  chesscomBlue,
  chesscomGreen,
  darkWood,
  deuteranopia,
  espresso,
  green,
  highContrast,
  ic,
  leather,
  marble,
  neon,
  newspaper,
  olive,
  pink,
  purple,
  tritanopia,
  walnut,
  wood,
}) satisfies Readonly<Record<string, Theme>>;

/** Union of the built-in theme names. */
export type ThemeName = keyof typeof themes;

export const PACKAGE_VERSION = "1.3.3";
