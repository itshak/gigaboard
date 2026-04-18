/**
 * `@ultrachess/pieces` — piece renderers for `<Chessboard/>`.
 *
 * Every set is a URL-backed `PieceRenderer` built by
 * {@link createImagePieceSet}. Ships **image** pieces (chess.com's public
 * PNG CDN by default) rather than inline SVG so the JS budget stays under
 * 1 KB per set — the pixels live in the browser's image cache, not in
 * your bundle.
 *
 * ### Tree-shaking
 *
 * Import a specific set from its sub-path to keep your bundle minimal:
 *
 * ```tsx
 * import { neo } from "@ultrachess/pieces/neo";        // chess.com default
 * import { chesscom } from "@ultrachess/pieces/chesscom"; // alias of `neo`
 * import { alpha } from "@ultrachess/pieces/alpha";
 * import { cburnett } from "@ultrachess/pieces/cburnett";
 * import { merida } from "@ultrachess/pieces/merida";
 * ```
 *
 * Or bring the whole registry (useful when building a piece-set picker):
 *
 * ```tsx
 * import { pieceSets } from "@ultrachess/pieces";
 * ```
 *
 * ### Custom chess.com styles
 *
 * chess.com hosts ~25 piece styles — if one of them isn't exported here
 * you can plug its slug into {@link chesscomPieceUrls} and build the
 * renderer yourself:
 *
 * ```tsx
 * import { chesscomPieceUrls, createImagePieceSet } from "@ultrachess/pieces";
 * const marble = createImagePieceSet(chesscomPieceUrls("marble"));
 * ```
 */

import { alpha } from "./sets/alpha.js";
import { cburnett } from "./sets/cburnett.js";
import { chesscom } from "./sets/chesscom.js";
import { merida } from "./sets/merida.js";
import { neo } from "./sets/neo.js";

export type {
  PieceRenderer,
  PieceUrlTable,
} from "./create-image-piece-set.js";
export {
  BOARD_CELL_KEY,
  chesscomPieceUrls,
  createImagePieceSet,
} from "./create-image-piece-set.js";
export { alpha, cburnett, chesscom, merida, neo };

/** Registry of every built-in set. Handy when building piece-set pickers. */
export const pieceSets = Object.freeze({
  alpha,
  cburnett,
  chesscom,
  merida,
  neo,
});

/** Union of built-in piece-set names. */
export type PieceSetName = keyof typeof pieceSets;

export const PACKAGE_VERSION = "0.1.0-alpha";
