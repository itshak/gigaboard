/**
 * @ultrachess/themes — CSS-variable-only board themes.
 *
 * Each theme ships as a frozen record of CSS custom-property pairs that the
 * React layer injects via `useInsertionEffect`. Themes are CSS-only and carry
 * no runtime cost beyond the variable write.
 *
 * @remarks
 * Individual themes land in M6.
 */

/** Shape of a board theme: CSS custom-property pairs. */
export type Theme = Readonly<Record<string, string>>;

export const PACKAGE_VERSION = "0.0.0";
