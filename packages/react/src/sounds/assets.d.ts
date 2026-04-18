/**
 * Module declarations for static MP3 imports.
 *
 * The tsup `file` loader emits referenced `.mp3` files into `dist/` and
 * rewrites imports to their runtime URLs (strings). TypeScript needs a
 * module declaration so these imports type-check as `string`.
 */

declare module "*.mp3" {
  const url: string;
  export default url;
}
