import { describe, expect, it } from "vitest";
import {
  PieceType,
  type SquareIndex,
  createPremoveBuffer,
  makePremove,
} from "../src/index.js";

const pm = (from: number, to: number) =>
  makePremove(from as SquareIndex, to as SquareIndex);

describe("createPremoveBuffer", () => {
  it("starts empty", () => {
    const b = createPremoveBuffer();
    expect(b.length).toBe(0);
    expect(b.all).toEqual([]);
    expect(b.peek()).toBeUndefined();
  });

  it("push appends FIFO and shift drains FIFO", () => {
    const b = createPremoveBuffer();
    b.push(pm(12, 28));
    b.push(pm(6, 21));
    expect(b.length).toBe(2);
    expect(b.peek()?.from).toBe(12);
    expect(b.shift()?.from).toBe(12);
    expect(b.shift()?.from).toBe(6);
    expect(b.shift()).toBeUndefined();
  });

  it("preserves the 'no promotion field' vs 'promotion: undefined' distinction", () => {
    const without = makePremove(12 as SquareIndex, 28 as SquareIndex);
    expect(Object.hasOwn(without, "promotion")).toBe(false);

    const withPromo = makePremove(
      12 as SquareIndex,
      28 as SquareIndex,
      PieceType.Queen,
    );
    expect(withPromo.promotion).toBe(PieceType.Queen);
  });

  it("push freezes a copy so callers can't mutate the stored entry", () => {
    const b = createPremoveBuffer();
    const raw = makePremove(12 as SquareIndex, 28 as SquareIndex);
    b.push(raw);
    const stored = b.peek()!;
    expect(Object.isFrozen(stored)).toBe(true);
  });

  it("clear empties the queue", () => {
    const b = createPremoveBuffer();
    b.push(pm(12, 28));
    b.clear();
    expect(b.length).toBe(0);
  });

  it(".all returns a frozen snapshot array", () => {
    const b = createPremoveBuffer();
    b.push(pm(12, 28));
    const snap = b.all;
    expect(Object.isFrozen(snap)).toBe(true);
  });
});
