import { describe, expect, it } from "vitest";
import { createArrowModel, makeArrow, type SquareIndex } from "../src/index.js";

const a = (from: number, to: number, color = "green") =>
  makeArrow(from as SquareIndex, to as SquareIndex, color);

/** Build a managed (`managed: true`) arrow literal for the partition tests. */
const mg = (from: number, to: number, color = "green") => ({
  from: from as SquareIndex,
  to: to as SquareIndex,
  color,
  managed: true as const,
});

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

  describe("setAll", () => {
    it("replaces the set atomically and preserves identity for matches", () => {
      const m = createArrowModel();
      m.add(a(12, 28, "green"));
      const before = m.arrows[0]!;

      // Same (from, to, color) should reuse the stored frozen instance.
      m.setAll([a(12, 28, "green"), a(0, 7, "red")]);
      expect(m.arrows).toHaveLength(2);
      expect(m.arrows.find((x) => x.from === 12)).toBe(before);
      expect(m.lastChanged).toBe(true);
    });

    it("drops arrows not in the incoming list", () => {
      const m = createArrowModel();
      m.add(a(12, 28));
      m.add(a(0, 7));
      m.setAll([a(12, 28)]);
      expect(m.arrows).toHaveLength(1);
      expect(m.has(a(0, 7))).toBe(false);
      expect(m.lastChanged).toBe(true);
    });

    it("identical set leaves lastChanged false and keeps array identity", () => {
      const m = createArrowModel();
      m.add(a(12, 28));
      m.add(a(0, 7));
      const snap = m.arrows;
      m.setAll([a(12, 28), a(0, 7)]);
      expect(m.lastChanged).toBe(false);
      // Invalidation didn't fire → cached array identity is preserved.
      expect(m.arrows).toBe(snap);
    });

    it("de-duplicates the incoming list", () => {
      const m = createArrowModel();
      m.setAll([a(12, 28), a(12, 28), a(12, 28)]);
      expect(m.arrows).toHaveLength(1);
    });

    it("setAll([]) clears the set", () => {
      const m = createArrowModel();
      m.add(a(12, 28));
      m.setAll([]);
      expect(m.arrows).toEqual([]);
      expect(m.lastChanged).toBe(true);
    });
  });

  describe("managed partition", () => {
    it("clearUser drops only user-drawn arrows", () => {
      const m = createArrowModel();
      m.add(a(12, 28)); // user
      m.add(mg(0, 7)); // managed
      m.clearUser();
      expect(m.arrows).toHaveLength(1);
      expect(m.arrows[0]?.managed).toBe(true);
      expect(m.lastChanged).toBe(true);
    });

    it("clearUser on only-managed set is a no-op", () => {
      const m = createArrowModel();
      m.add(mg(0, 7));
      m.clearUser();
      expect(m.arrows).toHaveLength(1);
      expect(m.lastChanged).toBe(false);
    });

    it("clearManaged drops only managed arrows", () => {
      const m = createArrowModel();
      m.add(a(12, 28));
      m.add(mg(0, 7));
      m.clearManaged();
      expect(m.arrows).toHaveLength(1);
      expect(m.arrows[0]?.from).toBe(12);
      expect(m.lastChanged).toBe(true);
    });

    it("setManaged stamps incoming arrows as managed", () => {
      const m = createArrowModel();
      m.setManaged([a(12, 28)]); // deliberately unstamped input
      expect(m.arrows).toHaveLength(1);
      expect(m.arrows[0]?.managed).toBe(true);
    });

    it("setManaged does not touch user-drawn arrows", () => {
      const m = createArrowModel();
      m.add(a(12, 28)); // user-drawn
      m.setManaged([a(0, 7, "green")]);
      expect(m.arrows).toHaveLength(2);
      expect(m.has(a(12, 28))).toBe(true);
    });

    it("successive setManaged replaces the managed subset atomically", () => {
      const m = createArrowModel();
      m.add(a(12, 28)); // user-drawn, should survive every setManaged call
      m.setManaged([a(0, 7)]);
      m.setManaged([a(1, 8)]); // replaces the managed hint
      expect(m.arrows).toHaveLength(2);
      expect(m.has(a(12, 28))).toBe(true);
      expect(m.arrows.some((x) => x.from === 1 && x.managed === true)).toBe(true);
      expect(m.arrows.some((x) => x.from === 0)).toBe(false);
    });

    it("setManaged([]) clears only managed arrows", () => {
      const m = createArrowModel();
      m.add(a(12, 28)); // user
      m.add(mg(0, 7));
      m.setManaged([]);
      expect(m.arrows).toHaveLength(1);
      expect(m.arrows[0]?.from).toBe(12);
    });

    it("setManaged with unchanged managed set is a no-op", () => {
      const m = createArrowModel();
      m.setManaged([a(0, 7)]);
      m.setManaged([a(0, 7)]);
      expect(m.lastChanged).toBe(false);
    });
  });
});
