/**
 * **Cburnett** — chess.com "classic" style.
 *
 * Chess.com hosts a `classic` piece set that visually matches the look
 * and spirit of the `cburnett` Lichess set — bold outlines, traditional
 * silhouette. This export points at chess.com's CDN for legal and visual
 * consistency with the rest of the `@gigaboard/pieces` range.
 *
 * ```tsx
 * import { cburnett } from "@gigaboard/pieces/cburnett";
 * <Chessboard game={game} pieces={cburnett} />
 * ```
 */

import { chesscomPieceUrls, createImagePieceSet } from "../create-image-piece-set.js";

export const cburnett = createImagePieceSet(chesscomPieceUrls("classic"));
