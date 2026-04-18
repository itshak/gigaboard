import { describe, expect, it } from "vitest";
import { createArrowModel, makeArrow, type SquareIndex } from "../src/index.js";

const a = (from: number, to: number, color = "green") =>
  makeArrow(from as SquareIndex, to as SquareIndex, color);

describe("createArrowModel", () => {
  it("starts empty", () => {
    const m = createArrowModel();
    expect(m.arrows).toEqual([]);
  });

  it("add + has", () => {
    const m = createArrowModel();
    m.add(a(12, 28));
    expect(m.has(a(12, 28))).toBe(true);
    expect(m.arrows).toHaveLength(1);
    expect(m.lastChanged).toBe(true);
  });

  it("duplicate add is a no-op and does not mark changed", () => {
    const m = createArrowModel();
    m.add(a(12, 28));
    m.add(a(12, 28));
    expect(m.arrows).toHaveLength(1);
    expect(m.lastChanged).toBe(false);
  });

  it("different color is a distinct arrow", () => {
    const m = createArrowModel();
    m.add(a(12, 28, "green"));
    m.add(a(12, 28, "red"));
    expect(m.arrows).toHaveLength(2);
  });

  it("remove drops an existing arrow", () => {
    const m = createArrowModel();
    m.add(a(12, 28));
    m.remove(a(12, 28));
    expect(m.arrows).toEqual([]);
    expect(m.lastChanged).toBe(true);
  });

  it("remove of a missing arrow is a no-op", () => {
    const m = createArrowModel();
    m.remove(a(12, 28));
    expect(m.lastChanged).toBe(false);
  });

  it("toggle alternates presence and returns the resulting presence", () => {
    const m = createArrowModel();
    expect(m.toggle(a(12, 28))).toBe(true);
    expect(m.has(a(12, 28))).toBe(true);
    expect(m.toggle(a(12, 28))).toBe(false);
    expect(m.has(a(12, 28))).toBe(false);
  });

  it("clear empties and marks changed", () => {
    const m = createArrowModel();
    m.add(a(12, 28));
    m.clear();
    expect(m.arrows).toEqual([]);
    expect(m.lastChanged).toBe(true);
  });

  it("clear on empty is a no-op and does not mark changed", () => {
    const m = createArrowModel();
    m.clear();
    expect(m.lastChanged).toBe(false);
  });

  it("returned arrow objects are frozen", () => {
    const m = createArrowModel();
    m.add(a(12, 28));
    const arrow = m.arrows[0]!;
    expect(Object.isFrozen(arrow)).toBe(true);
  });
});
