import { describe, expect, expectTypeOf, it } from "vitest";
import {
  BOARD_CELL_BK,
  BOARD_CELL_BP,
  BOARD_CELL_EMPTY,
  BOARD_CELL_WK,
  BOARD_CELL_WP,
  type BoardCell,
  Color,
  type PackedMove,
  PieceType,
  type SquareIndex,
  colorOf,
  encodeBoardCell,
  fromUltrachessPiece,
  isEmptyCell,
  isSquareIndex,
  pieceTypeOf,
  toSquareIndex,
} from "../src/index.js";

describe("SquareIndex", () => {
  it("accepts every value in [0, 63]", () => {
    for (let i = 0; i < 64; i++) {
      expect(() => toSquareIndex(i)).not.toThrow();
    }
  });

  it.each([-1, 64, 100, 1.5, Number.NaN])("rejects %p in dev", (bad) => {
    expect(() => toSquareIndex(bad)).toThrow(RangeError);
  });

  it("isSquareIndex narrows the input", () => {
    const n: number = 10;
    if (isSquareIndex(n)) {
      expectTypeOf(n).toEqualTypeOf<SquareIndex>();
    }
  });

  it.each([-1, 64, 1.5, Number.NaN])("isSquareIndex rejects %p", (n) => {
    expect(isSquareIndex(n)).toBe(false);
  });
});

describe("BoardCell encoding", () => {
  it("empty cell round-trips as 0", () => {
    expect(BOARD_CELL_EMPTY).toBe(0);
    expect(isEmptyCell(0 as BoardCell)).toBe(true);
  });

  it("encodes every white piece in [1, 6]", () => {
    expect(encodeBoardCell(Color.White, PieceType.Pawn)).toBe(BOARD_CELL_WP);
    expect(encodeBoardCell(Color.White, PieceType.King)).toBe(BOARD_CELL_WK);
    for (let t = 0; t <= 5; t++) {
      const cell = encodeBoardCell(Color.White, t as PieceType);
      expect(cell).toBeGreaterThanOrEqual(1);
      expect(cell).toBeLessThanOrEqual(6);
    }
  });

  it("encodes every black piece in [7, 12]", () => {
    expect(encodeBoardCell(Color.Black, PieceType.Pawn)).toBe(BOARD_CELL_BP);
    expect(encodeBoardCell(Color.Black, PieceType.King)).toBe(BOARD_CELL_BK);
    for (let t = 0; t <= 5; t++) {
      const cell = encodeBoardCell(Color.Black, t as PieceType);
      expect(cell).toBeGreaterThanOrEqual(7);
      expect(cell).toBeLessThanOrEqual(12);
    }
  });

  it("colorOf and pieceTypeOf are inverses of encodeBoardCell", () => {
    for (const color of [Color.White, Color.Black]) {
      for (let t = 0; t <= 5; t++) {
        const cell = encodeBoardCell(color, t as PieceType);
        expect(colorOf(cell)).toBe(color);
        expect(pieceTypeOf(cell)).toBe(t);
      }
    }
  });

  it("fromUltrachessPiece translates 255 -> empty and (color<<3|type) -> our encoding", () => {
    expect(fromUltrachessPiece(255)).toBe(BOARD_CELL_EMPTY);
    // White pawn in ultrachess is (0 << 3) | 0 = 0
    expect(fromUltrachessPiece(0)).toBe(BOARD_CELL_WP);
    // Black king is (1 << 3) | 5 = 13
    expect(fromUltrachessPiece(13)).toBe(BOARD_CELL_BK);
  });
});

describe("PackedMove type is numeric and branded", () => {
  it("branding is structural, not runtime", () => {
    const m = 0x1234 as PackedMove;
    expect(typeof m).toBe("number");
    expectTypeOf(m).toMatchTypeOf<number>();
  });
});
