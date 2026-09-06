import { describe, expect, it, vi } from "vitest";
import { type BoardSnapshot, Color, createBoardStore, type SquareIndex } from "../../src/core/index.js";

function makeSnapshot(board: Uint8Array, overrides: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return Object.freeze({
    board,
    turn: Color.White,
    hash: 0n,
    lastMove: null,
    selected: null,
    legalTargets: new Set<SquareIndex>(),
    inCheck: false,
    isGameOver: false,
    historyPly: 0,
    historyLength: 0,
    arrows: [],
    premoves: [],
    ...overrides,
  });
}

describe("createBoardStore", () => {
  it("getSnapshot returns the initial snapshot", () => {
    const initial = makeSnapshot(new Uint8Array(64));
    const store = createBoardStore(initial);
    expect(store.getSnapshot()).toBe(initial);
  });

  it("subscribe + commit notifies the global listener", () => {
    const store = createBoardStore(makeSnapshot(new Uint8Array(64)));
    const fn = vi.fn();
    store.subscribe(fn);
    store.commit(makeSnapshot(new Uint8Array(64)));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("commit with a board change notifies only changed-square subscribers", () => {
    const prev = new Uint8Array(64);
    const next = new Uint8Array(64);
    next[12] = 1; // white pawn appears at e2
    const store = createBoardStore(makeSnapshot(prev));

    const listeners = Array.from({ length: 64 }, () => vi.fn());
    for (let i = 0; i < 64; i++) {
      const l = listeners[i];
      if (l) store.subscribeSquare(i as SquareIndex, l);
    }

    store.commit(makeSnapshot(next));
    expect(listeners[12]).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 64; i++) {
      if (i !== 12) expect(listeners[i]).not.toHaveBeenCalled();
    }
  });

  it("commit with same snapshot reference is a no-op", () => {
    const snap = makeSnapshot(new Uint8Array(64));
    const store = createBoardStore(snap);
    const fn = vi.fn();
    store.subscribe(fn);
    store.commit(snap);
    expect(fn).not.toHaveBeenCalled();
  });

  it("unsubscribe is idempotent", () => {
    const store = createBoardStore(makeSnapshot(new Uint8Array(64)));
    const fn = vi.fn();
    const unsub = store.subscribe(fn);
    unsub();
    unsub(); // second call safe
    store.commit(makeSnapshot(new Uint8Array(64)));
    expect(fn).not.toHaveBeenCalled();
  });

  it("per-square unsubscribe detaches correctly", () => {
    const store = createBoardStore(makeSnapshot(new Uint8Array(64)));
    const fn = vi.fn();
    const unsub = store.subscribeSquare(12 as SquareIndex, fn);
    unsub();
    const next = new Uint8Array(64);
    next[12] = 1;
    store.commit(makeSnapshot(next));
    expect(fn).not.toHaveBeenCalled();
  });

  it("a listener unsubscribing a peer mid-notification is safe", () => {
    const store = createBoardStore(makeSnapshot(new Uint8Array(64)));
    let unsubB: (() => void) | null = null;
    const fnA = vi.fn(() => unsubB?.());
    const fnB = vi.fn();
    store.subscribe(fnA);
    unsubB = store.subscribe(fnB);
    store.commit(makeSnapshot(new Uint8Array(64)));
    expect(fnA).toHaveBeenCalledTimes(1);
    // fnB is either fired once or zero times (depending on set iteration order
    // after fnA's unsubscribe); either way, no crash. Both outcomes are valid.
    expect(fnB.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("same Uint8Array identity across commits skips per-square diff loop", () => {
    const board = new Uint8Array(64);
    const store = createBoardStore(makeSnapshot(board));
    const squareFn = vi.fn();
    store.subscribeSquare(0 as SquareIndex, squareFn);
    // Next snapshot reuses the same underlying buffer but with a different
    // snapshot object → global fires, but per-square listener doesn't.
    store.commit(makeSnapshot(board, { turn: Color.Black }));
    expect(squareFn).not.toHaveBeenCalled();
  });
});
