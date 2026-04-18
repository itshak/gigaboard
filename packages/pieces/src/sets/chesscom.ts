/**
 * **Chesscom** — explicit alias for the chess.com default ("Neo") set.
 *
 * Identical to `@ultrachess/pieces/neo` — exposed under the `chesscom`
 * name for users who want the intent ("I want chess.com's look") to be
 * explicit in their imports:
 *
 * ```tsx
 * import { chesscom } from "@ultrachess/pieces/chesscom";
 * <Chessboard game={game} pieces={chesscom} />
 * ```
 */

export { neo as chesscom } from "./neo.js";
