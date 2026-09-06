/**
 * `gigaboard/core` — framework-agnostic state machine for Gigaboard.
 *
 * Zero React, zero DOM. This barrel is hand-curated; sub-modules are never
 * re-exported wholesale so consumers can tree-shake aggressively.
 */

// ---- Gigachess adapter ----
export {
  createGigachessAdapter,
  preloadGigachessAdapter,
} from "./adapters/gigachess.js";
// ---- Animation planner ----
export { animationInspect, decodePackedMove, planAnimations } from "./animation-planner.js";
// ---- Arrow model ----
export type { ArrowModel } from "./arrow-model.js";
export { createArrowModel, makeArrow } from "./arrow-model.js";
// ---- Board model ----
export type { BoardModel, BoardModelOptions, SyncPositionOptions } from "./board-model.js";
export { createBoardModel } from "./board-model.js";
// ---- Drag controller ----
export type {
  CancelEvent,
  ClickEvent,
  DragController,
  DragControllerOptions,
  DragEvent,
  DragMoveEvent,
  DragStartEvent,
  DropEvent,
} from "./drag-controller.js";
export { createDragController } from "./drag-controller.js";
// ---- Engine adapter protocol ----
export type { EngineAdapter } from "./engine-adapter.js";
export { writeBoardCell } from "./engine-adapter.js";
// ---- Legal-move cache ----
export type {
  LegalMoveEntry,
  LegalMoveIndex,
  LegalMoveIndexOptions,
  PositionHash,
} from "./legal-move-index.js";
export { createLegalMoveIndex } from "./legal-move-index.js";
// ---- Premove buffer ----
export type { PremoveBuffer } from "./premove-buffer.js";
export { createPremoveBuffer, makePremove } from "./premove-buffer.js";
// ---- Subscribe store ----
export type { BoardStore, Unsubscribe } from "./subscribe-store.js";
export { createBoardStore } from "./subscribe-store.js";
// ---- Types ----
export type {
  AnimDescriptor,
  Arrow,
  ArrowCustomSvg,
  ArrowLabel,
  BoardCell,
  BoardSnapshot,
  DragState,
  PackedMove,
  Premove,
  SquareIndex,
  ZobristKey,
} from "./types.js";
export {
  BOARD_CELL_BB,
  BOARD_CELL_BK,
  BOARD_CELL_BN,
  BOARD_CELL_BP,
  BOARD_CELL_BQ,
  BOARD_CELL_BR,
  BOARD_CELL_EMPTY,
  BOARD_CELL_WB,
  BOARD_CELL_WK,
  BOARD_CELL_WN,
  BOARD_CELL_WP,
  BOARD_CELL_WQ,
  BOARD_CELL_WR,
  Color,
  colorOf,
  encodeBoardCell,
  isEmptyCell,
  isSquareIndex,
  MOVE2_PROMO_BISHOP,
  MOVE2_PROMO_KNIGHT,
  MOVE2_PROMO_NONE,
  MOVE2_PROMO_QUEEN,
  MOVE2_PROMO_ROOK,
  PieceType,
  packMove,
  pieceTypeOf,
  toSquareIndex,
  unpackMove,
} from "./types.js";

/** Package version. Baked in at build time by the consumer's bundler. */
export const PACKAGE_VERSION = "1.3.3";
