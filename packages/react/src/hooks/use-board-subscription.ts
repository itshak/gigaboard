"use client";

/**
 * Thin `useSyncExternalStore` wrappers for the `BoardModel` subscribe store.
 *
 * Rationale: components should read the slice they actually care about and
 * nothing more. Reading the whole snapshot triggers a re-render on every
 * commit (arrow add, premove queue, selection change — anything). Reading a
 * single field leverages React's `Object.is` bailout and limits re-renders
 * to commits that actually moved that field.
 *
 * The per-byte square hook uses the store's `subscribeSquare` path, so a
 * component that reads `board[12]` only wakes up on commits that changed
 * that byte.
 */

import type { BoardModel, BoardSnapshot, SquareIndex } from "../core/index.js";
import { useCallback, useSyncExternalStore } from "react";

/** Subscribe to the entire board snapshot. Wakes up on every commit. */
export function useBoardSnapshot(model: BoardModel): BoardSnapshot {
  return useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
}

/**
 * Subscribe to a slice derived from the snapshot. Re-renders only when the
 * selector's return value changes by `Object.is`.
 *
 * The selector is called on every `getSnapshot` tick, so it should be cheap
 * (a field access) and must return a stable reference when the underlying
 * data didn't change. Our snapshot store guarantees stability for primitive
 * fields and for the `legalTargets` / `arrows` / `premoves` collections.
 */
export function useBoardSlice<T>(model: BoardModel, selector: (snapshot: BoardSnapshot) => T): T {
  const getSnapshot = useCallback((): T => selector(model.getSnapshot()), [model, selector]);
  return useSyncExternalStore(model.subscribe, getSnapshot, getSnapshot);
}

/**
 * Subscribe to a single board byte via `subscribeSquare`. The component
 * receives the byte's current value (0 for empty, 1–12 for a piece) and
 * wakes up only when that byte changes.
 *
 * @remarks
 * The returned value is a primitive number, so React's default `Object.is`
 * bailout handles equality. The `useCallback` pins the subscribe function
 * to `(model, index)` — a Square that re-renders for unrelated reasons
 * doesn't force a re-subscription.
 */
export function useSquareCell(
  model: BoardModel | null | undefined,
  index: SquareIndex,
): number {
  const subscribe = useCallback(
    (listener: () => void) => (model ? model.subscribeSquare(index, listener) : () => {}),
    [model, index],
  );
  const getSnapshot = useCallback((): number => {
    if (!model) return 0;
    const snap = model.getSnapshot();
    return snap.board[index] ?? 0;
  }, [model, index]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
