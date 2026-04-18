/**
 * `useSyncExternalStore`-compatible store with byte-level per-square diff.
 *
 * Global listeners fire on every commit. Per-square listeners fire **only** when
 * their byte of `snapshot.board` changed — so a move that touches 2–4 squares
 * wakes only 2–4 Square components instead of all 64.
 */

import type { BoardSnapshot, SquareIndex } from "./types.js";

/** Cleanup returned from a subscription. Idempotent. */
export type Unsubscribe = () => void;

/** Internal listener type: a void-returning callback. */
type Listener = () => void;

/**
 * The store API. Surface area is intentionally minimal; everything else lives
 * in `board-model`.
 */
export interface BoardStore {
  /** Return the current frozen snapshot. Same reference between commits. */
  getSnapshot(): BoardSnapshot;
  /** Subscribe to every commit. Returns an unsubscribe function. */
  subscribe(listener: Listener): Unsubscribe;
  /**
   * Subscribe to commits in which `board[index]` changed. Useful from a
   * per-square React component via `useSyncExternalStore`.
   */
  subscribeSquare(index: SquareIndex, listener: Listener): Unsubscribe;
  /**
   * Install a new snapshot. Diffs `board` bytes against the previous snapshot
   * and fires only the per-square listeners whose byte actually changed, plus
   * every global listener.
   *
   * @remarks
   * Callers must build a fresh snapshot object — mutating the previous one in
   * place would make `getSnapshot()` return `=== previous`, which React treats
   * as "no change" and skips the render.
   */
  commit(next: BoardSnapshot): void;
}

/** Create a new board store initialised with `initial`. */
export function createBoardStore(initial: BoardSnapshot): BoardStore {
  let snapshot: BoardSnapshot = initial;
  const globalListeners = new Set<Listener>();
  // 64 slots; lazily allocated per square on first subscriber.
  const squareListeners: Array<Set<Listener> | undefined> = new Array(64);

  const notify = (set: Set<Listener>): void => {
    // Snapshot the iteration set before firing. A listener that unsubscribes
    // its neighbour mid-iteration would otherwise skip it.
    for (const l of [...set]) l();
  };

  const getSnapshot = (): BoardSnapshot => snapshot;

  const subscribe = (listener: Listener): Unsubscribe => {
    globalListeners.add(listener);
    let alive = true;
    return () => {
      if (!alive) return;
      alive = false;
      globalListeners.delete(listener);
    };
  };

  const subscribeSquare = (index: SquareIndex, listener: Listener): Unsubscribe => {
    let set = squareListeners[index];
    if (!set) {
      set = new Set();
      squareListeners[index] = set;
    }
    set.add(listener);
    let alive = true;
    return () => {
      if (!alive) return;
      alive = false;
      set.delete(listener);
    };
  };

  const commit = (next: BoardSnapshot): void => {
    if (next === snapshot) return;
    const prev = snapshot;
    snapshot = next;

    const prevBoard = prev.board;
    const nextBoard = next.board;
    if (prevBoard !== nextBoard) {
      for (let i = 0; i < 64; i++) {
        if (prevBoard[i] !== nextBoard[i]) {
          const set = squareListeners[i];
          if (set && set.size > 0) notify(set);
        }
      }
    }
    if (globalListeners.size > 0) notify(globalListeners);
  };

  return { getSnapshot, subscribe, subscribeSquare, commit };
}
