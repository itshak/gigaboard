/**
 * Board model: the orchestrator.
 *
 * Owns the engine adapter, the subscribe store, the legal-move cache, the
 * arrow set, the premove buffer, and the redo stack. Every public action
 * funnels here: `tryMove`, `undo`, `redo`, `goto`, `load`, `reset`,
 * `selectSquare`, and arrow / premove mutators. Each action produces **at
 * most one** snapshot commit so that React subscribers receive a single,
 * coherent update per user intent.
 *
 * The model is intentionally framework-agnostic: no React, no DOM, no
 * `useState`. Consumers drive it imperatively and subscribe to the store
 * for state.
 */

import { planAnimations } from "./animation-planner.js";
import { createArrowModel } from "./arrow-model.js";
import {
  createDragController,
  type DragController,
  type DragControllerOptions,
} from "./drag-controller.js";
import type { EngineAdapter } from "./engine-adapter.js";
import {
  createLegalMoveIndex,
  type LegalMoveIndex,
  type LegalMoveIndexOptions,
} from "./legal-move-index.js";
import { createPremoveBuffer } from "./premove-buffer.js";
import { type BoardStore, createBoardStore, type Unsubscribe } from "./subscribe-store.js";
import type {
  AnimDescriptor,
  Arrow,
  BoardSnapshot,
  PackedMove,
  PieceType,
  Premove,
  SquareIndex,
} from "./types.js";

/** Frozen empty set singleton — returned when nothing is selected. */
const EMPTY_SET: ReadonlySet<SquareIndex> = Object.freeze(
  new Set<SquareIndex>(),
) as ReadonlySet<SquareIndex>;

/** Extract the "to" square from a packed move without importing `ultrachess`. */
function moveTo(m: PackedMove): SquareIndex {
  return (((m as unknown as number) >> 6) & 0x3f) as SquareIndex;
}

/** Constructor options for {@link createBoardModel}. */
export interface BoardModelOptions {
  /** Options forwarded to the legal-move cache. */
  readonly legalMoveIndex?: LegalMoveIndexOptions;
  /** Options forwarded to the drag controller. */
  readonly dragController?: DragControllerOptions;
  /**
   * In development, freeze every emitted `BoardSnapshot` to catch accidental
   * mutation. Defaults to `true` when `NODE_ENV !== "production"`. Turning
   * this off is reserved for profiling; leave it alone otherwise.
   */
  readonly freezeSnapshots?: boolean;
}

/** Options for one coherent controlled-position update. */
export interface SyncPositionOptions {
  /** FEN to load into the underlying engine. */
  readonly fen: string;
  /**
   * Managed, application-owned arrows to install with the position. When
   * omitted, managed arrows are left alone if the FEN is already current
   * and cleared on a real position load, matching `load(fen)` semantics.
   */
  readonly managedArrows?: readonly Arrow[];
  /**
   * Preserve user-drawn arrows across a position load. Defaults to `false`
   * because arrows usually describe the previous position.
   */
  readonly preserveUserArrows?: boolean;
}

/** The orchestrator API consumed by React. */
export interface BoardModel {
  // ---- Store ----
  /** Current snapshot. Stable between commits. */
  getSnapshot(): BoardSnapshot;
  /** Subscribe to every commit. */
  subscribe(listener: () => void): Unsubscribe;
  /** Subscribe to commits that changed `board[index]`. */
  subscribeSquare(index: SquareIndex, listener: () => void): Unsubscribe;

  // ---- Actions ----
  /** Select a square. Passing `null` clears the selection. No-op if unchanged. */
  selectSquare(index: SquareIndex | null): void;
  /** Attempt a move. Returns the packed move on success, `null` on illegal. */
  tryMove(from: SquareIndex, to: SquareIndex, promotion?: PieceType): PackedMove | null;
  /** Undo the most recent move. */
  undo(): PackedMove | null;
  /** Redo the most recently undone move. */
  redo(): PackedMove | null;
  /** Jump to ply `n` in the history (0 = initial position). */
  goto(ply: number): void;
  /** Load a FEN; clears history, redo, arrows, and premoves. */
  load(fen: string): void;
  /**
   * Controlled-position sync for analysis/replay viewers. Loads the FEN
   * and replaces the managed arrow subset in the same snapshot commit.
   */
  syncPosition(options: SyncPositionOptions): void;
  /** Reset to the starting position; clears history, redo, arrows, premoves. */
  reset(): void;

  // ---- Queries ----
  /** `true` if a move `from → to` (optionally promoting) is legal right now. */
  isLegal(from: SquareIndex, to: SquareIndex, promotion?: PieceType): boolean;
  /** Legal target squares from `from`, cached by position hash. */
  legalFrom(from: SquareIndex): ReadonlySet<SquareIndex>;

  // ---- Arrows ----
  addArrow(arrow: Arrow): void;
  removeArrow(arrow: Arrow): void;
  toggleArrow(arrow: Arrow): void;
  /** Drop every arrow, managed or not. Nuclear option. */
  clearArrows(): void;
  /**
   * Drop only **user-drawn** arrows (anything without `managed: true`).
   * The board uses this for its click-to-dismiss behaviour so engine /
   * app-owned hints survive user interaction.
   */
  clearUserArrows(): void;
  /** Drop only **managed** arrows. Leaves user drawings untouched. */
  clearManagedArrows(): void;
  /**
   * Atomic replace of the **entire** arrow set (managed and user). Use
   * this when the board is a pure programmatic surface with no human
   * drawing — a review / replay viewer, a puzzle diagram, tests.
   *
   * For analysis-style boards that stream engine hints alongside human
   * arrow drawings, prefer {@link setManagedArrows}: it replaces only
   * the managed subset and preserves whatever the user has drawn by
   * right-clicking.
   *
   * @remarks
   * Arrows whose identity tuple already exists are preserved by
   * reference across the call, so React subscribers that compare
   * per-arrow references skip unchanged entries. A true no-op (same set
   * in the same order) commits nothing.
   */
  setArrows(arrows: readonly Arrow[]): void;
  /**
   * Atomic replace of **only** the managed subset. User-drawn arrows
   * are untouched; every incoming arrow is implicitly marked
   * `managed: true`. Idiomatic for engine-annotation feeds (Stockfish
   * best-moves, multi-PV fans): the arrow set turns over as a whole per
   * position without racing the user's right-click gesture.
   *
   * @example
   * ```ts
   * game.setManagedArrows(bestLine ? [uciToArrow(bestLine[0])] : []);
   * ```
   */
  setManagedArrows(arrows: readonly Arrow[]): void;

  // ---- Premoves ----
  queuePremove(premove: Premove): void;
  clearPremoves(): void;

  // ---- Subsystems exposed for the React layer ----
  /** The drag controller; React layer binds pointer events to it. */
  readonly drag: DragController;
  /** Statistics view of the legal-move cache (for benchmarks). */
  readonly legalMoveCache: LegalMoveIndex;
  /** The underlying engine adapter, for escape-hatch callers. */
  readonly engine: EngineAdapter;
  /**
   * The animation descriptors produced by the most recent commit. Empty on
   * the initial snapshot. Consumed by the React layer's `useAnimation` hook.
   */
  readonly lastAnimations: readonly AnimDescriptor[];

  /** Release engine resources and drop all subscriptions. */
  dispose(): void;
}

/**
 * Construct a board model around an engine adapter.
 *
 * The model does **not** create the adapter — the caller does, because
 * adapter construction is the only place async engine init can happen.
 * See `createUltrachessAdapter` for the async path.
 */
export function createBoardModel(
  engine: EngineAdapter,
  options: BoardModelOptions = {},
): BoardModel {
  const freezeSnapshots = options.freezeSnapshots ?? process.env["NODE_ENV"] !== "production";
  const legalMoveIndex = createLegalMoveIndex(options.legalMoveIndex ?? {});
  const arrowModel = createArrowModel();
  const premoveBuffer = createPremoveBuffer();
  const drag = createDragController(options.dragController ?? {});

  const history: PackedMove[] = [];
  const redoStack: PackedMove[] = [];
  let selected: SquareIndex | null = null;
  let lastMove: PackedMove | null = null;
  let lastAnimations: readonly AnimDescriptor[] = [];
  let disposed = false;

  const stageBuffer = new Uint8Array(64);

  const readBoardCopy = (): Uint8Array => {
    engine.readBoard(stageBuffer);
    return new Uint8Array(stageBuffer);
  };

  const computeLegalTargets = (fromBoard: Uint8Array): ReadonlySet<SquareIndex> => {
    if (selected === null) return EMPTY_SET;
    const pieceOnSquare = fromBoard[selected];
    // No piece there → no targets (avoids a WASM call).
    if (pieceOnSquare === 0 || pieceOnSquare === undefined) return EMPTY_SET;

    const hash = engine.hash();
    let tos = legalMoveIndex.get(hash, selected);
    if (tos === undefined) {
      const moves = engine.legalMoves(selected);
      const buf = new Uint8Array(moves.length);
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        if (m === undefined) continue;
        buf[i] = moveTo(m);
      }
      legalMoveIndex.set(hash, selected, buf);
      tos = buf;
    }
    if (tos.length === 0) return EMPTY_SET;
    const set = new Set<SquareIndex>();
    for (let i = 0; i < tos.length; i++) {
      const t = tos[i];
      if (t !== undefined) set.add(t as SquareIndex);
    }
    return set;
  };

  const buildSnapshot = (): BoardSnapshot => {
    const board = readBoardCopy();
    const legalTargets = computeLegalTargets(board);
    const snap: BoardSnapshot = {
      board,
      turn: engine.turn(),
      hash: engine.hash(),
      lastMove,
      selected,
      legalTargets,
      inCheck: engine.inCheck(),
      isGameOver: engine.isGameOver(),
      historyPly: history.length,
      historyLength: history.length + redoStack.length,
      arrows: arrowModel.arrows,
      premoves: premoveBuffer.all,
    };
    return freezeSnapshots ? Object.freeze(snap) : snap;
  };

  const store: BoardStore = createBoardStore(buildSnapshot());

  /**
   * Commit a fresh snapshot. If a packed move triggered the change, pass it
   * so the animation planner can take the fast path.
   */
  const commitWith = (triggerMove: PackedMove | null): void => {
    const prev = store.getSnapshot();
    const next = buildSnapshot();
    lastAnimations = planAnimations(prev.board, next.board, triggerMove);
    store.commit(next);
  };

  const tryApplyPremoves = (): PackedMove | null => {
    let last: PackedMove | null = null;
    while (premoveBuffer.length > 0) {
      const pm = premoveBuffer.peek();
      if (pm === undefined) break;
      const m = engine.makeMove(pm.from, pm.to, pm.promotion);
      if (m === null) {
        // Lichess semantics: first failure voids every queued premove.
        premoveBuffer.clear();
        break;
      }
      premoveBuffer.shift();
      history.push(m);
      last = m;
    }
    return last;
  };

  const selectSquare = (index: SquareIndex | null): void => {
    if (selected === index) return;
    selected = index;
    commitWith(null);
  };

  const tryMove = (
    from: SquareIndex,
    to: SquareIndex,
    promotion?: PieceType,
  ): PackedMove | null => {
    const m = engine.makeMove(from, to, promotion);
    if (m === null) return null;
    // A fresh move invalidates the redo line.
    redoStack.length = 0;
    history.push(m);
    lastMove = m;
    selected = null;
    const last = tryApplyPremoves();
    // Animation fast-path uses the triggering user move. Any premoves that
    // auto-applied on top are folded into the same commit; their animation
    // falls back to byte-diff (acceptable for this M1 pass, tightened later).
    if (last === null) {
      commitWith(m);
    } else {
      lastMove = last;
      commitWith(null);
    }
    return m;
  };

  const undo = (): PackedMove | null => {
    const m = engine.undo();
    if (m === null) return null;
    redoStack.push(m);
    history.pop();
    lastMove = history[history.length - 1] ?? null;
    selected = null;
    commitWith(null);
    return m;
  };

  const redo = (): PackedMove | null => {
    const m = redoStack.pop();
    if (m === undefined) return null;
    const from = ((m as unknown as number) & 0x3f) as SquareIndex;
    const to = moveTo(m);
    const kind = ((m as unknown as number) >> 14) & 0b11;
    let promotion: PieceType | undefined;
    if (kind === 1) {
      // Promotion piece bits 12–13: 0=N, 1=B, 2=R, 3=Q.
      const promoBits = ((m as unknown as number) >> 12) & 0b11;
      const map: PieceType[] = [1 as PieceType, 2 as PieceType, 3 as PieceType, 4 as PieceType];
      promotion = map[promoBits];
    }
    const applied = engine.makeMove(from, to, promotion);
    if (applied === null) {
      // Out-of-sync — don't crash; drop the bad entry.
      return null;
    }
    history.push(applied);
    lastMove = applied;
    selected = null;
    commitWith(applied);
    return applied;
  };

  const goto = (ply: number): void => {
    if (!Number.isInteger(ply) || ply < 0) return;
    const total = history.length + redoStack.length;
    if (ply > total) return;
    // Walk backwards until history.length === ply, stashing undone onto redo.
    while (history.length > ply) {
      const m = engine.undo();
      if (m === null) break;
      redoStack.push(m);
      history.pop();
    }
    // Walk forwards until history.length === ply, popping off redo.
    while (history.length < ply) {
      const m = redoStack.pop();
      if (m === undefined) break;
      const from = ((m as unknown as number) & 0x3f) as SquareIndex;
      const to = moveTo(m);
      const kind = ((m as unknown as number) >> 14) & 0b11;
      let promotion: PieceType | undefined;
      if (kind === 1) {
        const promoBits = ((m as unknown as number) >> 12) & 0b11;
        promotion = (promoBits + 1) as PieceType;
      }
      const applied = engine.makeMove(from, to, promotion);
      if (applied === null) break;
      history.push(applied);
    }
    lastMove = history[history.length - 1] ?? null;
    selected = null;
    commitWith(null);
  };

  const load = (fen: string): void => {
    engine.load(fen);
    history.length = 0;
    redoStack.length = 0;
    premoveBuffer.clear();
    arrowModel.clear();
    selected = null;
    lastMove = null;
    legalMoveIndex.clear();
    commitWith(null);
  };

  const syncPosition = ({
    fen,
    managedArrows,
    preserveUserArrows = false,
  }: SyncPositionOptions): void => {
    const positionChanged = engine.fen() !== fen;

    if (positionChanged) {
      engine.load(fen);
      history.length = 0;
      redoStack.length = 0;
      premoveBuffer.clear();
      if (preserveUserArrows) {
        if (managedArrows !== undefined) {
          arrowModel.setManaged(managedArrows);
        }
      } else {
        arrowModel.clear();
        if (managedArrows !== undefined) {
          arrowModel.setManaged(managedArrows);
        }
      }
      selected = null;
      lastMove = null;
      legalMoveIndex.clear();
      commitWith(null);
      return;
    }

    if (managedArrows === undefined) {
      return;
    }
    arrowModel.setManaged(managedArrows);
    if (arrowModel.lastChanged) commitWith(null);
  };

  const reset = (): void => {
    engine.reset();
    history.length = 0;
    redoStack.length = 0;
    premoveBuffer.clear();
    arrowModel.clear();
    selected = null;
    lastMove = null;
    legalMoveIndex.clear();
    commitWith(null);
  };

  const isLegal = (from: SquareIndex, to: SquareIndex, promotion?: PieceType): boolean => {
    const hash = engine.hash();
    const cached = legalMoveIndex.get(hash, from);
    if (cached !== undefined && promotion === undefined) {
      for (let i = 0; i < cached.length; i++) {
        if (cached[i] === to) return true;
      }
      return false;
    }
    const moves = engine.legalMoves(from);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (m === undefined) continue;
      if (moveTo(m) !== to) continue;
      if (promotion === undefined) return true;
      const kind = ((m as unknown as number) >> 14) & 0b11;
      if (kind !== 1) return true;
      const promoBits = ((m as unknown as number) >> 12) & 0b11;
      if (((promoBits + 1) as PieceType) === promotion) return true;
    }
    return false;
  };

  const legalFrom = (from: SquareIndex): ReadonlySet<SquareIndex> => {
    const hash = engine.hash();
    let tos = legalMoveIndex.get(hash, from);
    if (tos === undefined) {
      const moves = engine.legalMoves(from);
      const buf = new Uint8Array(moves.length);
      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        if (m === undefined) continue;
        buf[i] = moveTo(m);
      }
      legalMoveIndex.set(hash, from, buf);
      tos = buf;
    }
    if (tos.length === 0) return EMPTY_SET;
    const set = new Set<SquareIndex>();
    for (let i = 0; i < tos.length; i++) {
      const t = tos[i];
      if (t !== undefined) set.add(t as SquareIndex);
    }
    return set;
  };

  const addArrow = (arrow: Arrow): void => {
    arrowModel.add(arrow);
    if (arrowModel.lastChanged) commitWith(null);
  };
  const removeArrow = (arrow: Arrow): void => {
    arrowModel.remove(arrow);
    if (arrowModel.lastChanged) commitWith(null);
  };
  const toggleArrow = (arrow: Arrow): void => {
    arrowModel.toggle(arrow);
    if (arrowModel.lastChanged) commitWith(null);
  };
  const clearArrows = (): void => {
    arrowModel.clear();
    if (arrowModel.lastChanged) commitWith(null);
  };
  const clearUserArrows = (): void => {
    arrowModel.clearUser();
    if (arrowModel.lastChanged) commitWith(null);
  };
  const clearManagedArrows = (): void => {
    arrowModel.clearManaged();
    if (arrowModel.lastChanged) commitWith(null);
  };
  const setArrows = (arrows: readonly Arrow[]): void => {
    arrowModel.setAll(arrows);
    if (arrowModel.lastChanged) commitWith(null);
  };
  const setManagedArrows = (arrows: readonly Arrow[]): void => {
    arrowModel.setManaged(arrows);
    if (arrowModel.lastChanged) commitWith(null);
  };

  const queuePremove = (premove: Premove): void => {
    premoveBuffer.push(premove);
    commitWith(null);
  };
  const clearPremoves = (): void => {
    if (premoveBuffer.length === 0) return;
    premoveBuffer.clear();
    commitWith(null);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    engine.dispose();
    legalMoveIndex.clear();
    history.length = 0;
    redoStack.length = 0;
    premoveBuffer.clear();
    arrowModel.clear();
  };

  return {
    getSnapshot: () => store.getSnapshot(),
    subscribe: (l) => store.subscribe(l),
    subscribeSquare: (i, l) => store.subscribeSquare(i, l),

    selectSquare,
    tryMove,
    undo,
    redo,
    goto,
    load,
    syncPosition,
    reset,

    isLegal,
    legalFrom,

    addArrow,
    removeArrow,
    toggleArrow,
    clearArrows,
    clearUserArrows,
    clearManagedArrows,
    setArrows,
    setManagedArrows,

    queuePremove,
    clearPremoves,

    drag,
    legalMoveCache: legalMoveIndex,
    engine,
    get lastAnimations() {
      return lastAnimations;
    },

    dispose,
  };
}
