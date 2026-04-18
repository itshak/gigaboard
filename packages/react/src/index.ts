/**
 * `@ultrachess/react` — interactive React chessboard.
 *
 * Hand-curated barrel; sub-modules are never re-exported wholesale so
 * consumers can tree-shake aggressively.
 *
 * Server-only entry (static SSR board, zero client JS): `@ultrachess/react/server`.
 */

// ---- Components ----
export { Chessboard } from "./chessboard.js";

// ---- Hooks ----
export { useChessGame } from "./hooks/use-chess-game.js";
export {
  useBoardSlice,
  useBoardSnapshot,
  useSquareCell,
} from "./hooks/use-board-subscription.js";
export { useClickToMove } from "./hooks/use-click-to-move.js";
export { useDrag } from "./hooks/use-drag.js";
export { useAnimation } from "./hooks/use-animation.js";
export { useArrowGesture } from "./hooks/use-arrow-gesture.js";
export { useKeyboardNav } from "./hooks/use-keyboard-nav.js";

// ---- Defaults ----
export { defaultPieces } from "./pieces/default-pieces.js";
export {
  CSS_VARS,
  DEFAULT_ILLEGAL_FLASH_TINT,
  DEFAULT_PREMOVE_TINT,
  defaultArrowColors,
  defaultTheme,
} from "./default-theme.js";

// ---- Types ----
export type {
  AnimationOptions,
  ArrowColors,
  ChessboardProps,
  LegalTargetStyle,
  Orientation,
  PieceRenderer,
  PromotionContext,
  SquareContext,
  Theme,
  UseChessGameOptions,
} from "./types.js";

/** Package version — keep in sync with `package.json`. */
export const PACKAGE_VERSION = "0.1.0-alpha";
