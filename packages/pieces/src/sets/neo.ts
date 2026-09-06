/**
 * **Neo** — chess.com's default piece set.
 *
 * ```tsx
 * import { neo } from "@gigaboard/pieces/neo";
 * <Chessboard game={game} pieces={neo} />
 * ```
 *
 * Sources its PNGs from chess.com's public piece CDN. Neo is the set
 * chess.com ships on every board by default, so this renderer delivers
 * the highest chess.com-visual-parity out of the box.
 */

import { chesscomPieceUrls, createImagePieceSet } from "../create-image-piece-set.js";

export const neo = createImagePieceSet(chesscomPieceUrls("neo"));
