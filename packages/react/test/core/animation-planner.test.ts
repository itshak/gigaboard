import { describe, expect, it } from "vitest";
import {
  BOARD_CELL_BK,
  BOARD_CELL_BP,
  BOARD_CELL_BR,
  BOARD_CELL_WK,
  BOARD_CELL_WN,
  BOARD_CELL_WP,
  BOARD_CELL_WQ,
  BOARD_CELL_WR,
  type BoardCell,
  decodePackedMove,
  MOVE2_PROMO_QUEEN,
  type PackedMove,
  PieceType,
  packMove,
  planAnimations,
} from "../../src/core/index.js";

/** Pack a move conforming to the 16-bit Move2 wire format. */
function pack(opts: { from: number; to: number; promotion?: number }): PackedMove {
  return packMove(opts.from, opts.to, opts.promotion ?? 0);
}

function freshBoard(): Uint8Array {
  return new Uint8Array(64);
}

describe("planAnimations — fast path with packed move", () => {
  it("classifies a normal move", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[12] = BOARD_CELL_WP;
    next[28] = BOARD_CELL_WP;
    const descriptors = planAnimations(prev, next, pack({ from: 12, to: 28 }));
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]).toEqual({
      kind: "move",
      from: 12,
      to: 28,
      piece: BOARD_CELL_WP,
    });
  });

  it("classifies a capture", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[27] = BOARD_CELL_WN;
    prev[42] = BOARD_CELL_BP;
    next[42] = BOARD_CELL_WN;
    const descriptors = planAnimations(prev, next, pack({ from: 27, to: 42 }));
    expect(descriptors[0]).toEqual({
      kind: "capture",
      from: 27,
      to: 42,
      piece: BOARD_CELL_WN,
      captured: BOARD_CELL_BP,
    });
  });

  it("classifies en-passant (captured pawn on same file as `to`, same rank as `from`)", () => {
    const prev = freshBoard();
    const next = freshBoard();
    // White pawn on e5 (rank 4, idx 36). Black pawn on d5 (idx 35). White
    // captures en passant to d6 (idx 43).
    prev[36] = BOARD_CELL_WP;
    prev[35] = BOARD_CELL_BP;
    next[43] = BOARD_CELL_WP;
    const descriptors = planAnimations(prev, next, pack({ from: 36, to: 43 }));
    expect(descriptors[0]).toEqual({
      kind: "en-passant",
      from: 36,
      to: 43,
      capturedSquare: 35,
      piece: BOARD_CELL_WP,
      captured: BOARD_CELL_BP,
    });
  });

  it("classifies kingside castle with canonical King-captures-Rook move (e1h1)", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[4] = BOARD_CELL_WK;
    prev[7] = BOARD_CELL_WR;
    next[6] = BOARD_CELL_WK;
    next[5] = BOARD_CELL_WR;
    const descriptors = planAnimations(prev, next, pack({ from: 4, to: 7 }));
    expect(descriptors[0]).toEqual({
      kind: "castle",
      kingFrom: 4,
      kingTo: 6,
      rookFrom: 7,
      rookTo: 5,
    });
  });

  it("classifies kingside castle with 2-square King jump (e1g1)", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[4] = BOARD_CELL_WK;
    prev[7] = BOARD_CELL_WR;
    next[6] = BOARD_CELL_WK;
    next[5] = BOARD_CELL_WR;
    const descriptors = planAnimations(prev, next, pack({ from: 4, to: 6 }));
    expect(descriptors[0]).toEqual({
      kind: "castle",
      kingFrom: 4,
      kingTo: 6,
      rookFrom: 7,
      rookTo: 5,
    });
  });

  it("classifies queenside castle with canonical King-captures-Rook move (e1a1)", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[4] = BOARD_CELL_WK;
    prev[0] = BOARD_CELL_WR;
    next[2] = BOARD_CELL_WK;
    next[3] = BOARD_CELL_WR;
    const descriptors = planAnimations(prev, next, pack({ from: 4, to: 0 }));
    expect(descriptors[0]).toEqual({
      kind: "castle",
      kingFrom: 4,
      kingTo: 2,
      rookFrom: 0,
      rookTo: 3,
    });
  });

  it("classifies queenside castle with 2-square King jump (e1c1)", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[4] = BOARD_CELL_WK;
    prev[0] = BOARD_CELL_WR;
    next[2] = BOARD_CELL_WK;
    next[3] = BOARD_CELL_WR;
    const descriptors = planAnimations(prev, next, pack({ from: 4, to: 2 }));
    expect(descriptors[0]).toEqual({
      kind: "castle",
      kingFrom: 4,
      kingTo: 2,
      rookFrom: 0,
      rookTo: 3,
    });
  });

  it("classifies promotion (no capture)", () => {
    const prev = freshBoard();
    const next = freshBoard();
    // White pawn on 7th rank (a7 = 48) promotes to a8 (= 56) into a queen.
    prev[48] = BOARD_CELL_WP;
    next[56] = BOARD_CELL_WQ;
    const descriptors = planAnimations(
      prev,
      next,
      pack({ from: 48, to: 56, promotion: MOVE2_PROMO_QUEEN }),
    );
    expect(descriptors[0]).toEqual({
      kind: "promotion",
      from: 48,
      to: 56,
      pieceBefore: BOARD_CELL_WP,
      pieceAfter: BOARD_CELL_WQ,
      captured: null,
    });
  });

  it("classifies promotion with capture", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[48] = BOARD_CELL_WP;
    prev[57] = BOARD_CELL_BR;
    next[57] = BOARD_CELL_WQ;
    const descriptors = planAnimations(
      prev,
      next,
      pack({ from: 48, to: 57, promotion: MOVE2_PROMO_QUEEN }),
    );
    expect(descriptors[0]).toEqual({
      kind: "promotion",
      from: 48,
      to: 57,
      pieceBefore: BOARD_CELL_WP,
      pieceAfter: BOARD_CELL_WQ,
      captured: BOARD_CELL_BR,
    });
  });
});

describe("planAnimations — fallback byte-diff", () => {
  it("emits disappear for a removed piece", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[0] = BOARD_CELL_WK;
    const descriptors = planAnimations(prev, next, null);
    expect(descriptors).toEqual([{ kind: "disappear", at: 0, piece: BOARD_CELL_WK }]);
  });

  it("emits appear for a placed piece", () => {
    const prev = freshBoard();
    const next = freshBoard();
    next[0] = BOARD_CELL_BK;
    const descriptors = planAnimations(prev, next, null);
    expect(descriptors).toEqual([{ kind: "appear", at: 0, piece: BOARD_CELL_BK }]);
  });

  it("emits disappear + appear when a piece changes identity", () => {
    const prev = freshBoard();
    const next = freshBoard();
    prev[0] = BOARD_CELL_WK;
    next[0] = BOARD_CELL_BK;
    const descriptors = planAnimations(prev, next, null);
    expect(descriptors).toEqual([
      { kind: "disappear", at: 0, piece: BOARD_CELL_WK },
      { kind: "appear", at: 0, piece: BOARD_CELL_BK },
    ]);
  });

  it("empty diff -> empty descriptors", () => {
    expect(planAnimations(freshBoard(), freshBoard(), null)).toEqual([]);
  });

  it("rejects non-64 buffers in dev", () => {
    expect(() => planAnimations(new Uint8Array(63), freshBoard(), null)).toThrow(RangeError);
    expect(() => planAnimations(freshBoard(), new Uint8Array(65), null)).toThrow(RangeError);
  });
});

describe("decodePackedMove", () => {
  it("round-trips normal moves", () => {
    const m = pack({ from: 12, to: 28 });
    expect(decodePackedMove(m)).toEqual({
      from: 12,
      to: 28,
      kind: "normal",
      promotion: null,
    });
  });

  it("round-trips promotion moves with the correct promoted piece", () => {
    const m = pack({ from: 48, to: 56, promotion: MOVE2_PROMO_QUEEN });
    const d = decodePackedMove(m);
    expect(d.kind).toBe("promotion");
    expect(d.promotion).toBe(PieceType.Queen);
  });

  it("round-trips castle moves (both e1h1 and e1g1)", () => {
    expect(decodePackedMove(pack({ from: 4, to: 7 })).kind).toBe("castle");
    expect(decodePackedMove(pack({ from: 4, to: 6 })).kind).toBe("castle");
    expect(decodePackedMove(pack({ from: 4, to: 0 })).kind).toBe("castle");
    expect(decodePackedMove(pack({ from: 4, to: 2 })).kind).toBe("castle");
  });
});

// Prevent "unused" warnings for constants held for readability.
void [BOARD_CELL_BK];
void ({} as BoardCell);
