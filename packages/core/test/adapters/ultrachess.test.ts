import { describe, expect, it } from "vitest";
import {
  BOARD_CELL_EMPTY,
  BOARD_CELL_WK,
  BOARD_CELL_WP,
  Color,
  createUltrachessAdapter,
  preloadUltrachessAdapter,
  type SquareIndex,
} from "../../src/index.js";

const E2 = 12 as SquareIndex;
const E4 = 28 as SquareIndex;

describe("createUltrachessAdapter", () => {
  it("initialises at the starting position", async () => {
    const engine = await createUltrachessAdapter();
    try {
      expect(engine.turn()).toBe(Color.White);
      expect(engine.inCheck()).toBe(false);
      expect(engine.isGameOver()).toBe(false);
      const buf = new Uint8Array(64);
      engine.readBoard(buf);
      expect(buf[E2]).toBe(BOARD_CELL_WP);
      expect(buf[4]).toBe(BOARD_CELL_WK); // e1 = 4
      expect(buf[36]).toBe(BOARD_CELL_EMPTY); // e5
    } finally {
      engine.dispose();
    }
  });

  it("makes and undoes moves, tracking turn + hash", async () => {
    const engine = await createUltrachessAdapter();
    try {
      const h0 = engine.hash();
      const m = engine.makeMove(E2, E4);
      expect(m).not.toBeNull();
      expect(engine.turn()).toBe(Color.Black);
      expect(engine.hash()).not.toBe(h0);

      const undone = engine.undo();
      expect(undone).toBe(m);
      expect(engine.turn()).toBe(Color.White);
      expect(engine.hash()).toBe(h0);
    } finally {
      engine.dispose();
    }
  });

  it("returns null on an illegal move rather than throwing", async () => {
    const engine = await createUltrachessAdapter();
    try {
      // e2 → e5 is two ranks from a non-starting-row pawn push, illegal.
      expect(engine.makeMove(E2, 36 as SquareIndex)).toBeNull();
    } finally {
      engine.dispose();
    }
  });

  it("legalMoves(from) returns 2 pawn moves from e2 at startpos", async () => {
    const engine = await createUltrachessAdapter();
    try {
      const moves = engine.legalMoves(E2);
      expect(moves).toHaveLength(2); // e3 and e4
    } finally {
      engine.dispose();
    }
  });

  it("legalMoves() returns 20 at the starting position", async () => {
    const engine = await createUltrachessAdapter();
    try {
      expect(engine.legalMoves()).toHaveLength(20);
    } finally {
      engine.dispose();
    }
  });

  it("load + reset replace position and clear history", async () => {
    const engine = await createUltrachessAdapter();
    try {
      engine.load("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
      expect(engine.turn()).toBe(Color.Black);
      engine.reset();
      expect(engine.turn()).toBe(Color.White);
    } finally {
      engine.dispose();
    }
  });

  it("readBoard(out) rejects wrong-length buffers in dev", async () => {
    const engine = await createUltrachessAdapter();
    try {
      expect(() => engine.readBoard(new Uint8Array(32))).toThrow(RangeError);
    } finally {
      engine.dispose();
    }
  });
});

describe("preloadUltrachessAdapter", () => {
  it("returns a Promise that resolves", async () => {
    const result = preloadUltrachessAdapter();
    expect(result).toBeInstanceOf(Promise);
    // Resolves to `void`; we only care that it resolves without throwing.
    await expect(result).resolves.toBeUndefined();
  });

  it("is idempotent across repeat calls", async () => {
    const a = preloadUltrachessAdapter();
    const b = preloadUltrachessAdapter();
    // Same cached Promise — no extra init work is queued.
    expect(a).toBe(b);
    await a;
    const c = preloadUltrachessAdapter();
    expect(c).toBe(a);
  });

  it("does not block subsequent adapter construction", async () => {
    await preloadUltrachessAdapter();
    const engine = await createUltrachessAdapter();
    try {
      // If preload worked, the engine is fully usable immediately.
      expect(engine.turn()).toBe(Color.White);
    } finally {
      engine.dispose();
    }
  });
});
