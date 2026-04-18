import { describe, expect, it } from "vitest";
import { type SquareIndex, createDragController } from "../src/index.js";

const FROM = 12 as SquareIndex;
const POINTER = 7;

describe("createDragController — transitions", () => {
  it("idle + pointerDown → pending", () => {
    const c = createDragController();
    expect(c.state.kind).toBe("idle");
    expect(c.pointerDown(FROM, POINTER, 0, 0)).toBe(true);
    expect(c.state.kind).toBe("pending");
  });

  it("pointerDown while not idle is rejected", () => {
    const c = createDragController();
    c.pointerDown(FROM, POINTER, 0, 0);
    expect(c.pointerDown(FROM, POINTER, 0, 0)).toBe(false);
  });

  it("pending + small pointerMove stays pending, no event", () => {
    const c = createDragController({ activationDistance: 10 });
    c.pointerDown(FROM, POINTER, 0, 0);
    expect(c.pointerMove(POINTER, 2, 2)).toBeNull();
    expect(c.state.kind).toBe("pending");
  });

  it("pending + move past threshold → dragging with drag-start event", () => {
    const c = createDragController({ activationDistance: 4 });
    c.pointerDown(FROM, POINTER, 0, 0);
    const evt = c.pointerMove(POINTER, 10, 10);
    expect(evt?.kind).toBe("drag-start");
    expect(c.state.kind).toBe("dragging");
  });

  it("dragging + pointerMove emits drag-move and updates (x, y)", () => {
    const c = createDragController({ activationDistance: 1 });
    c.pointerDown(FROM, POINTER, 0, 0);
    c.pointerMove(POINTER, 10, 10);
    const evt = c.pointerMove(POINTER, 15, 20);
    expect(evt?.kind).toBe("drag-move");
    if (c.state.kind === "dragging") {
      expect(c.state.x).toBe(15);
      expect(c.state.y).toBe(20);
    } else {
      throw new Error("expected dragging");
    }
  });

  it("dragging + pointerUp emits drop and returns to idle", () => {
    const c = createDragController({ activationDistance: 1 });
    c.pointerDown(FROM, POINTER, 0, 0);
    c.pointerMove(POINTER, 10, 10);
    const evt = c.pointerUp(POINTER, 10, 10);
    expect(evt).toEqual({
      kind: "drop",
      from: FROM,
      x: 10,
      y: 10,
      wasDrag: true,
    });
    expect(c.state.kind).toBe("idle");
  });

  it("pending + pointerUp emits click (no drag happened)", () => {
    const c = createDragController();
    c.pointerDown(FROM, POINTER, 0, 0);
    const evt = c.pointerUp(POINTER, 0, 0);
    expect(evt?.kind).toBe("click");
    expect(c.state.kind).toBe("idle");
  });

  it("pointerMove / pointerUp with wrong pointerId is ignored", () => {
    const c = createDragController({ activationDistance: 1 });
    c.pointerDown(FROM, POINTER, 0, 0);
    expect(c.pointerMove(POINTER + 1, 100, 100)).toBeNull();
    expect(c.pointerUp(POINTER + 1, 100, 100)).toBeNull();
    expect(c.state.kind).toBe("pending");
  });

  it("pointerMove in idle is ignored", () => {
    const c = createDragController();
    expect(c.pointerMove(POINTER, 10, 10)).toBeNull();
  });

  it("pointerUp in idle is ignored", () => {
    const c = createDragController();
    expect(c.pointerUp(POINTER, 0, 0)).toBeNull();
  });

  it("cancel in pending emits cancel and returns to idle", () => {
    const c = createDragController();
    c.pointerDown(FROM, POINTER, 0, 0);
    const evt = c.cancel();
    expect(evt?.kind).toBe("cancel");
    expect(c.state.kind).toBe("idle");
  });

  it("cancel in dragging emits cancel and returns to idle", () => {
    const c = createDragController({ activationDistance: 1 });
    c.pointerDown(FROM, POINTER, 0, 0);
    c.pointerMove(POINTER, 10, 10);
    const evt = c.cancel();
    expect(evt?.kind).toBe("cancel");
    expect(c.state.kind).toBe("idle");
  });

  it("cancel in idle returns null", () => {
    const c = createDragController();
    expect(c.cancel()).toBeNull();
  });

  it("rejects invalid activationDistance", () => {
    expect(() => createDragController({ activationDistance: -1 })).toThrow(RangeError);
    expect(() => createDragController({ activationDistance: Number.NaN })).toThrow(RangeError);
  });

  it("activationDistance 0 activates drag on any movement", () => {
    const c = createDragController({ activationDistance: 0 });
    c.pointerDown(FROM, POINTER, 0, 0);
    // With threshold 0, even (0,0) → (0,0) yields dragging on first move? No —
    // a true move must have dx/dy ≠ 0 for dx²+dy² < 0 to be false.
    // We test a real move:
    const evt = c.pointerMove(POINTER, 1, 0);
    expect(evt?.kind).toBe("drag-start");
  });
});
