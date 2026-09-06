/**
 * Geometry helpers — `getSquareAtPoint` / `getPointAtSquareCentre` /
 * `algebraicOf`.
 *
 * Pure functions — no model, no render, no pointer events. Tests both
 * orientations and the boundaries around which `Math.floor` rounding
 * errors tend to land.
 */

import type { SquareIndex } from "../src/core/index.js";
import { describe, expect, it } from "vitest";
import { algebraicOf, getPointAtSquareCentre, getSquareAtPoint } from "../src/lib/geometry.js";

/** Stub an element whose `getBoundingClientRect` returns a fixed box. */
function stubContainer(size = 400): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: size,
      bottom: size,
      width: size,
      height: size,
      toJSON: () => ({}),
    }) as DOMRect;
  return el;
}

describe("getSquareAtPoint", () => {
  it("maps the corners in white orientation", () => {
    const el = stubContainer();
    // (0,0) is the top-left → a8 (index 56).
    expect(getSquareAtPoint(el, 0, 0, "white")).toBe(56 as SquareIndex);
    // (399, 399) is the bottom-right → h1 (index 7).
    expect(getSquareAtPoint(el, 399, 399, "white")).toBe(7 as SquareIndex);
    // Middle of e4 (file 4, rank 3) → index 28.
    expect(getSquareAtPoint(el, 4 * 50 + 25, (7 - 3) * 50 + 25, "white")).toBe(28 as SquareIndex);
  });

  it("maps the corners in black orientation", () => {
    const el = stubContainer();
    // (0,0) in black orientation is h1 → index 7.
    expect(getSquareAtPoint(el, 0, 0, "black")).toBe(7 as SquareIndex);
    // (399, 399) in black orientation is a8 → index 56.
    expect(getSquareAtPoint(el, 399, 399, "black")).toBe(56 as SquareIndex);
  });

  it("returns null for points outside the rect", () => {
    const el = stubContainer();
    expect(getSquareAtPoint(el, -1, 200, "white")).toBeNull();
    expect(getSquareAtPoint(el, 400, 200, "white")).toBeNull();
    expect(getSquareAtPoint(el, 200, -1, "white")).toBeNull();
    expect(getSquareAtPoint(el, 200, 400, "white")).toBeNull();
  });
});

describe("getPointAtSquareCentre", () => {
  it("round-trips through getSquareAtPoint in white orientation", () => {
    const el = stubContainer();
    for (let sq = 0; sq < 64; sq++) {
      const { x, y } = getPointAtSquareCentre(el, sq as SquareIndex, "white");
      expect(getSquareAtPoint(el, x, y, "white")).toBe(sq as SquareIndex);
    }
  });

  it("round-trips through getSquareAtPoint in black orientation", () => {
    const el = stubContainer();
    for (let sq = 0; sq < 64; sq++) {
      const { x, y } = getPointAtSquareCentre(el, sq as SquareIndex, "black");
      expect(getSquareAtPoint(el, x, y, "black")).toBe(sq as SquareIndex);
    }
  });
});

describe("algebraicOf", () => {
  it("translates every square index to its SAN label", () => {
    expect(algebraicOf(0 as SquareIndex)).toBe("a1");
    expect(algebraicOf(7 as SquareIndex)).toBe("h1");
    expect(algebraicOf(56 as SquareIndex)).toBe("a8");
    expect(algebraicOf(63 as SquareIndex)).toBe("h8");
    expect(algebraicOf(28 as SquareIndex)).toBe("e4");
  });
});
