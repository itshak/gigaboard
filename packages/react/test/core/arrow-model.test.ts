import { describe, expect, it } from "vitest";
import { type Arrow, createArrowModel, makeArrow, type SquareIndex } from "../../src/core/index.js";

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

  describe("badge labels (engine eval pills)", () => {
    const pill = (
      from: number,
      to: number,
      text: string,
      extra?: Partial<Arrow["label"]>,
    ): Arrow => ({
      from: from as SquareIndex,
      to: to as SquareIndex,
      color: "rgba(0, 80, 180, 0.8)",
      brush: "blue",
      label: {
        text,
        fill: "#fff",
        background: "rgba(20, 14, 10, 0.94)",
        fontSize: 3.4,
        anchor: "label",
        ...extra,
      },
      managed: true as const,
    });

    it("eval text participates in identity (changed text = changed arrow)", () => {
      const m = createArrowModel();
      m.setManaged([pill(12, 28, "+0.3")]);
      expect(m.lastChanged).toBe(true);
      m.setManaged([pill(12, 28, "+0.4")]);
      expect(m.lastChanged).toBe(true);
      expect(m.arrows[0]?.label?.text).toBe("+0.4");
    });

    it("identical pills are a no-op across commits", () => {
      const m = createArrowModel();
      m.setManaged([pill(12, 28, "+0.3")]);
      const snap = m.arrows;
      m.setManaged([pill(12, 28, "+0.3")]);
      expect(m.lastChanged).toBe(false);
      expect(m.arrows).toBe(snap);
    });

    it("styling-only fields do not fork identity (still additive)", () => {
      const m = createArrowModel();
      m.setManaged([pill(12, 28, "+0.3")]);
      // Same text, different background/fontSize/anchor → same key, so
      // still exactly one arrow — but the new styling replaces the
      // stored instance and commits, or live setting changes (e.g. an
      // eval-pill font-size switch) would never repaint.
      m.setManaged([pill(12, 28, "+0.3", { background: "#000", fontSize: 7 })]);
      expect(m.arrows).toHaveLength(1);
      expect(m.lastChanged).toBe(true);
      expect(m.arrows[0]?.label?.background).toBe("#000");
      expect(m.arrows[0]?.label?.fontSize).toBe(7);
    });

    it("fontSize-only change commits (live eval-pill size feedback)", () => {
      const m = createArrowModel();
      m.setManaged([pill(12, 28, "+0.3", { fontSize: 2.45 })]);
      const snap = m.arrows;
      // Identical re-submit stays a no-op with a stable array identity.
      m.setManaged([pill(12, 28, "+0.3", { fontSize: 2.45 })]);
      expect(m.lastChanged).toBe(false);
      expect(m.arrows).toBe(snap);
      // Size-only change: same single arrow, new visuals, committed.
      m.setManaged([pill(12, 28, "+0.3", { fontSize: 3.85 })]);
      expect(m.arrows).toHaveLength(1);
      expect(m.lastChanged).toBe(true);
      expect(m.arrows[0]?.label?.fontSize).toBe(3.85);
    });

    it("plain arrows still have exactly three own properties", () => {
      const m = createArrowModel();
      m.add(a(12, 28));
      expect(Object.keys(m.arrows[0] as object).sort()).toEqual(["color", "from", "to"]);
    });
  });
});
