/**
 * `@ultrachess/core` — framework-agnostic state machine for Ultra Chess React.
 *
 * Zero React, zero DOM. This barrel is hand-curated; sub-modules are never
 * re-exported wholesale so consumers can tree-shake aggressively.
 */

// ---- Types ----
export type {
  AnimDescriptor,
  Arrow,
  BoardCell,
  BoardSnapshot,
  DragState,
  PackedMove,
  Premove,
  SquareIndex,
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
  PieceType,
  colorOf,
  encodeBoardCell,
  fromUltrachessPiece,
  isEmptyCell,
  isSquareIndex,
  pieceTypeOf,
  toSquareIndex,
} from "./types.js";

// ---- Engine adapter protocol ----
export type { EngineAdapter } from "./engine-adapter.js";
export { writeBoardCell } from "./engine-adapter.js";

// ---- Default adapter (ultrachess) ----
export {
  createUltrachessAdapter,
  createUltrachessAdapterSync,
} from "./adapters/ultrachess.js";

// ---- Subscribe store ----
export type { BoardStore, Unsubscribe } from "./subscribe-store.js";
export { createBoardStore } from "./subscribe-store.js";

// ---- Legal-move cache ----
export type { LegalMoveEntry, LegalMoveIndex, LegalMoveIndexOptions } from "./legal-move-index.js";
export { createLegalMoveIndex } from "./legal-move-index.js";

// ---- Arrow model ----
export type { ArrowModel } from "./arrow-model.js";
export { createArrowModel, makeArrow } from "./arrow-model.js";

// ---- Premove buffer ----
export type { PremoveBuffer } from "./premove-buffer.js";
export { createPremoveBuffer, makePremove } from "./premove-buffer.js";

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

// ---- Animation planner ----
export { animationInspect, decodePackedMove, planAnimations } from "./animation-planner.js";

// ---- Board model ----
export type { BoardModel, BoardModelOptions } from "./board-model.js";
export { createBoardModel } from "./board-model.js";

/** Package version. Baked in at build time by the consumer's bundler. */
export const PACKAGE_VERSION = "0.1.0-alpha";
