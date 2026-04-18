/**
 * `@ultrachess/themes` — CSS-variable-only board themes.
 *
 * Each theme ships as a frozen record of CSS custom-property pairs that the
 * React layer writes inline on the board container at first paint. Themes
 * are CSS-only and carry zero runtime cost beyond the one-time variable
 * assignment.
 *
 * Import sub-paths to keep bundles minimal:
 *
 * ```tsx
 * import { brown } from "@ultrachess/themes/brown";
 * import { green } from "@ultrachess/themes/green";  // chess.com default
 * import { blue }  from "@ultrachess/themes/blue";
 * import { wood }  from "@ultrachess/themes/wood";
 * ```
 *
 * Or pull the full set from the package root (convenient for theme pickers,
 * at a marginally larger bundle cost):
 *
 * ```tsx
 * import { brown, green, blue, wood } from "@ultrachess/themes";
 * ```
 */

import { blue } from "./blue.js";
import { brown } from "./brown.js";
import { green } from "./green.js";
import { wood } from "./wood.js";

/** Shape of a board theme: CSS custom-property pairs. */
export type Theme = Readonly<Record<string, string>>;

export { blue, brown, green, wood };

/** Registry mapping a theme name to its theme object. */
export const themes = Object.freeze({
  brown,
  blue,
  green,
  wood,
}) satisfies Readonly<Record<string, Theme>>;

/** Union of the built-in theme names. */
export type ThemeName = keyof typeof themes;

export const PACKAGE_VERSION = "0.1.0-alpha";
