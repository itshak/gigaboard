import { describe, expect, it } from "vitest";
import {
  BOARD_CELL_EMPTY,
  BOARD_CELL_WK,
  BOARD_CELL_WP,
  Color,
  createGigachessAdapter,
  packMove,
  preloadGigachessAdapter,
  type SquareIndex,
  unpackMove,
} from "../../../src/core/index.js";

const E2 = 12 as SquareIndex;
const E4 = 28 as SquareIndex;

describe("createGigachessAdapter", () => {
  it("initialises synchronously at the starting position on frame 0", () => {
    // Note: fully synchronous, no await
    const engine = createGigachessAdapter();
    try {
      expect(engine.turn()).toBe(Color.White);
      expect(engine.inCheck()).toBe(false);
      expect(engine.isGameOver()).toBe(false);
      const buf = new Uint8Array(64);
      engine.readBoard(buf);
      expect(buf[E2]).toBe(BOARD_CELL_WP);
      expect(buf[4]).toBe(BOARD_CELL_WK);
      expect(buf[36]).toBe(BOARD_CELL_EMPTY);
    } finally {
      engine.dispose();
    }
  });

  it("makes and undoes moves, tracking turn + Zobrist hash", () => {
    const engine = createGigachessAdapter();
    try {
      const h0 = engine.hash();
      const m = engine.makeMove(E2, E4);
      expect(m).not.toBeNull();
      expect(engine.turn()).toBe(Color.Black);

      const h1 = engine.hash();
      if (typeof h0 === "object" && typeof h1 === "object") {
        expect(h1.lo !== h0.lo || h1.hi !== h0.hi).toBe(true);
      } else {
        expect(h1).not.toBe(h0);
      }

      const undone = engine.undo();
      expect(undone).toBe(m);
      expect(engine.turn()).toBe(Color.White);

      const h2 = engine.hash();
      if (typeof h0 === "object" && typeof h2 === "object") {
        expect(h2.lo).toBe(h0.lo);
        expect(h2.hi).toBe(h0.hi);
      } else {
        expect(h2).toBe(h0);
      }
    } finally {
      engine.dispose();
    }
  });

  it("returns null on an illegal move rather than throwing", () => {
    const engine = createGigachessAdapter();
    try {
      expect(engine.makeMove(E2, 36 as SquareIndex)).toBeNull();
    } finally {
      engine.dispose();
    }
  });

  it("canonicalizes castling output to King-captures-Rook for e1g1 and e1h1", () => {
    const fen = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
    // 1. Moving king to g1 returns canonical e1h1 (4 -> 7)
    const engine1 = createGigachessAdapter(fen);
    expect(engine1.san(packMove(4, 7))).toBe("O-O");
    expect(engine1.san(packMove(4, 6))).toBe("O-O");
    const m1 = engine1.makeMove(4 as SquareIndex, 6 as SquareIndex);
    expect(m1).not.toBeNull();
    const unpacked1 = unpackMove(m1!);
    expect(unpacked1.from).toBe(4);
    expect(unpacked1.to).toBe(7); // Canonical King-captures-Rook

    // Undoing returns canonical King-captures-Rook
    const undone1 = engine1.undo();
    expect(undone1).not.toBeNull();
    expect(unpackMove(undone1!).to).toBe(7);

    // 2. Moving king onto rook h1 returns canonical e1h1 (4 -> 7)
    const engine2 = createGigachessAdapter(fen);
    const m2 = engine2.makeMove(4 as SquareIndex, 7 as SquareIndex);
    expect(m2).not.toBeNull();
    const unpacked2 = unpackMove(m2!);
    expect(unpacked2.from).toBe(4);
    expect(unpacked2.to).toBe(7);

    // 3. Queenside: e1c1 and e1a1 return canonical e1a1 (4 -> 0)
    const engine3 = createGigachessAdapter(fen);
    expect(engine3.san(packMove(4, 0))).toBe("O-O-O");
    expect(engine3.san(packMove(4, 2))).toBe("O-O-O");
    const m3 = engine3.makeMove(4 as SquareIndex, 2 as SquareIndex);
    expect(m3).not.toBeNull();
    expect(unpackMove(m3!).to).toBe(0);
  });

  it("preloadGigachessAdapter resolves cleanly", async () => {
    await expect(preloadGigachessAdapter()).resolves.toBeUndefined();
  });
});
