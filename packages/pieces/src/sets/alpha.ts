/**
 * **Alpha** — chess.com's Alpha set.
 *
 * Thin, minimalist silhouettes; reads well at small sizes. Good fit for
 * mobile boards and puzzle thumbnails.
 *
 * ```tsx
 * import { alpha } from "@gigaboard/pieces/alpha";
 * <Chessboard game={game} pieces={alpha} />
 * ```
 */

import { chesscomPieceUrls, createImagePieceSet } from "../create-image-piece-set.js";

export const alpha = createImagePieceSet(chesscomPieceUrls("alpha"));
