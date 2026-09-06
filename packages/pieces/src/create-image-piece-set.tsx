/**
 * Shared piece-renderer factory.
 *
 * Every piece set shipped by `@gigaboard/pieces` is a URL-based set — a
 * thin map from board-cell → image URL. This factory builds a memoised
 * {@link PieceRenderer} around such a map, so every set file is two lines
 * of configuration plus a URL table.
 *
 * ### Why images, not inline SVG?
 *
 * The React packages target <15 KB gzip. Shipping 12 detailed SVG paths
 * per set × 4 sets would blow that budget immediately. URL-based sets
 * push the bytes onto the browser's image cache, where the pieces are
 * decoded exactly once per session and shared across every board.
 *
 * ### Render cost
 *
 * One `<img>` per occupied square. The image is `pointer-events: none`
 * so it never intercepts drag/click; the piece layer on the board owns
 * hit testing. Each renderer is pure and does not allocate on the hot
 * path — the URL lookup is a constant-time array read.
 */

import type { ReactNode } from "react";

/** Shape a consumer's `PieceRenderer` prop expects. */
export type PieceRenderer = (args: { readonly cell: number; readonly square: number }) => ReactNode;

/**
 * 12-entry URL table, indexed by board cell `1..12`. Cell `0` is the
 * empty square and is never looked up. Use {@link BOARD_CELL_KEY} to
 * remember which index maps to which piece.
 */
export type PieceUrlTable = Readonly<{
  /** white pawn (cell 1) */ 1: string;
  /** white knight (cell 2) */ 2: string;
  /** white bishop (cell 3) */ 3: string;
  /** white rook (cell 4) */ 4: string;
  /** white queen (cell 5) */ 5: string;
  /** white king (cell 6) */ 6: string;
  /** black pawn (cell 7) */ 7: string;
  /** black knight (cell 8) */ 8: string;
  /** black bishop (cell 9) */ 9: string;
  /** black rook (cell 10) */ 10: string;
  /** black queen (cell 11) */ 11: string;
  /** black king (cell 12) */ 12: string;
}>;

/** Readable cell labels for the table — useful for callers building sets. */
export const BOARD_CELL_KEY = Object.freeze({
  wP: 1,
  wN: 2,
  wB: 3,
  wR: 4,
  wQ: 5,
  wK: 6,
  bP: 7,
  bN: 8,
  bB: 9,
  bR: 10,
  bQ: 11,
  bK: 12,
} as const);

/** Readable piece-name for `aria-label`, derived from a board cell. */
function pieceLabel(cell: number): string {
  if (cell <= 0 || cell > 12) return "";
  const color = cell > 6 ? "black" : "white";
  const type = (cell - 1) % 6;
  const name = ["pawn", "knight", "bishop", "rook", "queen", "king"][type];
  return `${color} ${name}`;
}

/**
 * Shared style object for every `<img>` — frozen and re-used so React's
 * shallow-equality checks short-circuit and we don't allocate a fresh
 * object on every render.
 */
const PIECE_IMG_STYLE = Object.freeze({
  display: "block",
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  userSelect: "none",
} as const);

/**
 * Build a {@link PieceRenderer} backed by a URL table. The returned
 * function is referentially stable AND allocates **zero** React elements
 * on the hot path: we pre-materialise one `<img>` element per piece
 * code at factory time and hand out the same element for every call with
 * the same cell.
 *
 * Why pre-materialise? The renderer is called inside `<PieceSlot/>` on
 * every move that touches its square. Returning a fresh React element
 * per call means React's reconciler has to shallow-diff the new element
 * against the last one to decide whether DOM changed. A pool of 12
 * frozen elements (one per piece code) bypasses that entirely — React
 * short-circuits on identity.
 */
export function createImagePieceSet(urls: PieceUrlTable): PieceRenderer {
  // Pre-materialise the 12 piece elements at factory time. `cell === 0`
  // (empty square) returns null; we don't allocate an element for it.
  const pool: Array<ReactNode | null> = new Array(13).fill(null);
  for (let cell = 1; cell <= 12; cell++) {
    const url = (urls as Record<number, string | undefined>)[cell];
    if (url === undefined) continue;
    pool[cell] = <img src={url} alt={pieceLabel(cell)} draggable={false} style={PIECE_IMG_STYLE} />;
  }
  return function ImagePieceSet({ cell }: { readonly cell: number }) {
    return pool[cell] ?? null;
  };
}

/**
 * Helper that builds a chess.com-style PNG CDN URL for a given piece style.
 *
 * chess.com serves piece artwork at:
 *     `https://images.chesscomfiles.com/chess-themes/pieces/<style>/<size>/<colorPiece>.png`
 *
 * where `colorPiece` is one of `wp wn wb wr wq wk bp bn bb br bq bk`. The
 * `size` options are `150` (default), `300`, etc. We pin to 150 by default
 * because boards render at roughly that density on desktop, and larger
 * sizes inflate page weight without perceptible benefit.
 *
 * @param style chess.com piece-style slug. Known values include `neo`
 *              (chess.com's default), `alpha`, `bases`, `cases`, `classic`,
 *              `club`, `condal`, `graffiti`, `leipzig`, `marble`, `maya`,
 *              `metal`, `modern`, `nature`, `neo_wood`, `newspaper`, `ocean`,
 *              `sky`, `space`, `tournament`, `vintage`, `wood`.
 * @param size  One of chess.com's supported pixel sizes (default 150).
 */
export function chesscomPieceUrls(style: string, size: 150 | 300 = 150): PieceUrlTable {
  const base = `https://images.chesscomfiles.com/chess-themes/pieces/${style}/${size}`;
  return Object.freeze({
    1: `${base}/wp.png`,
    2: `${base}/wn.png`,
    3: `${base}/wb.png`,
    4: `${base}/wr.png`,
    5: `${base}/wq.png`,
    6: `${base}/wk.png`,
    7: `${base}/bp.png`,
    8: `${base}/bn.png`,
    9: `${base}/bb.png`,
    10: `${base}/br.png`,
    11: `${base}/bq.png`,
    12: `${base}/bk.png`,
  });
}
