/**
 * **Merida** — chess.com's `neo_wood` set.
 *
 * Warm wood-tinted pieces with traditional proportions; visually closest
 * to the classic `merida` tournament set used in print publications.
 *
 * ```tsx
 * import { merida } from "gigaboard/pieces/merida";
 * <Chessboard game={game} pieces={merida} />
 * ```
 */

import { chesscomPieceUrls, createImagePieceSet } from "../create-image-piece-set.js";

export const merida = createImagePieceSet(chesscomPieceUrls("neo_wood"));
