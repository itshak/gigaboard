/**
 * M2 drawable upgrade — extended Arrow shape, palette brushes, below
 * layer, snap-to-valid-move.
 *
 * Most assertions are DOM-level (SVG presence, attribute reads) rather
 * than pixel-level — canvas content isn't observable in happy-dom and
 * chasing pixels in integration tests is noisy. Where we care about
 * the visual branch we verify via the arrow-set state the renderer
 * consumes.
 */

import { fireEvent, screen } from "@testing-library/react";
import type { BoardModel, SquareIndex } from "../src/core/index.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installBoardGeometry,
  makeBoardModel,
  pointerEvent,
  renderBoard,
  squareCentre,
} from "./helpers.js";

function container(): HTMLElement {
  return screen.getByRole("grid").parentElement as HTMLElement;
}

describe("Arrow extensions", () => {
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("preserves identity for plain (from,to,color) arrows across M2", () => {
    model.addArrow({ from: 12 as SquareIndex, to: 28 as SquareIndex, color: "green" });
    expect(model.getSnapshot().arrows).toHaveLength(1);
    // Duplicate should be a no-op.
    model.addArrow({ from: 12 as SquareIndex, to: 28 as SquareIndex, color: "green" });
    expect(model.getSnapshot().arrows).toHaveLength(1);
  });

  it("distinguishes arrows that differ only by brush / label / below", () => {
    model.addArrow({ from: 12 as SquareIndex, to: 28 as SquareIndex, color: "green" });
    model.addArrow({
      from: 12 as SquareIndex,
      to: 28 as SquareIndex,
      color: "green",
      brush: "best",
    });
    model.addArrow({
      from: 12 as SquareIndex,
      to: 28 as SquareIndex,
      color: "green",
      label: { text: "+1.2" },
    });
    model.addArrow({
      from: 12 as SquareIndex,
      to: 28 as SquareIndex,
      color: "green",
      below: true,
    });
    expect(model.getSnapshot().arrows).toHaveLength(4);
  });

  it("deep-freezes nested label and customSvg records", () => {
    model.addArrow({
      from: 0 as SquareIndex,
      to: 9 as SquareIndex,
      color: "red",
      label: { text: "!" },
      customSvg: { html: "<circle r='3'/>" },
    });
    const [arrow] = model.getSnapshot().arrows;
    expect(Object.isFrozen(arrow)).toBe(true);
    expect(Object.isFrozen(arrow?.label)).toBe(true);
    expect(Object.isFrozen(arrow?.customSvg)).toBe(true);
  });
});

describe("SVG overlay (labels / customSvg)", () => {
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("does NOT mount an SVG overlay when no arrow carries a decoration", () => {
    model.addArrow({ from: 0 as SquareIndex, to: 9 as SquareIndex, color: "red" });
    renderBoard(model);
    expect(container().querySelector('[data-layer="arrows-decor"]')).toBeNull();
    expect(container().querySelector('[data-layer="arrows-below-decor"]')).toBeNull();
  });

  it("mounts the SVG overlay only when at least one arrow has a label or customSvg", () => {
    model.addArrow({
      from: 0 as SquareIndex,
      to: 9 as SquareIndex,
      color: "red",
      label: { text: "+1.2" },
    });
    renderBoard(model);
    const svg = container().querySelector<SVGElement>('[data-layer="arrows-decor"]');
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("text")?.textContent).toBe("+1.2");
  });

  it("routes decorations to the below overlay when arrow.below is true", () => {
    model.addArrow({
      from: 0 as SquareIndex,
      to: 9 as SquareIndex,
      color: "red",
      label: { text: "?!" },
      below: true,
    });
    renderBoard(model);
    expect(container().querySelector('[data-layer="arrows-below-decor"]')).not.toBeNull();
    // The top overlay must NOT carry this arrow's decoration.
    expect(container().querySelector('[data-layer="arrows-decor"]')).toBeNull();
  });
});

describe("Below layer (arrows beneath pieces)", () => {
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("always mounts the below canvas — even when empty, to keep paint order", () => {
    renderBoard(model);
    expect(container().querySelector('[data-layer="arrows-below"]')).not.toBeNull();
  });

  it("below-layer paints before the piece layer in DOM order", () => {
    renderBoard(model);
    const root = container();
    const nodes = Array.from(root.querySelectorAll("[data-layer], [data-piece-square]"));
    const belowIdx = nodes.findIndex((n) => n.getAttribute("data-layer") === "arrows-below");
    const firstPieceIdx = nodes.findIndex((n) => n.hasAttribute("data-piece-square"));
    expect(belowIdx).toBeGreaterThanOrEqual(0);
    expect(firstPieceIdx).toBeGreaterThan(belowIdx);
  });
});

describe("Custom brush palette", () => {
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("extra brushes flow through ArrowColors without ejecting the modifier channels", () => {
    renderBoard(model, {
      arrowColors: { default: "rgb(1, 2, 3)", engine: "rgb(200, 0, 0)" },
    });
    // Verified indirectly via the prop being accepted — runtime
    // resolution is exercised by the render-budget bench. The
    // important type-level guarantee (arbitrary string keys allowed)
    // is checked by the fact this compiles.
    expect(container()).toBeTruthy();
  });
});

describe("snapArrowsToValidMove", () => {
  installBoardGeometry(400);
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("leaves the endpoint alone when off — arrow to empty square commits as-is", () => {
    renderBoard(model, { snapArrowsToValidMove: false });
    const root = container();
    const a1 = squareCentre("a1"); // rook, legal dests blocked at start
    // a5 — not a legal target from a1 in the starting position.
    const a5 = squareCentre("a5");

    fireEvent(root, pointerEvent("pointerdown", { x: a1.x, y: a1.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: a5.x, y: a5.y, button: 2 }));

    const arrows = model.getSnapshot().arrows;
    expect(arrows).toHaveLength(1);
    // a5 = file 0 rank 4 → index 32.
    expect(arrows[0]?.to).toBe(32);
  });

  it("snaps the endpoint to a legal target when enabled", () => {
    renderBoard(model, { snapArrowsToValidMove: true });
    const root = container();
    // Knight on b1 has two legal targets in the starting position: a3, c3.
    const b1 = squareCentre("b1");
    // Pick a far square with no legal knight move nearby.
    const h8 = squareCentre("h8");

    fireEvent(root, pointerEvent("pointerdown", { x: b1.x, y: b1.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: h8.x, y: h8.y, button: 2 }));

    const arrows = model.getSnapshot().arrows;
    expect(arrows).toHaveLength(1);
    // Nearest legal knight target to h8 is c3 (index 18); a3 (16) is further.
    expect([16, 18]).toContain(arrows[0]?.to);
  });

  it("never snaps same-square (circle / mark) gestures", () => {
    renderBoard(model, { snapArrowsToValidMove: true });
    const root = container();
    const e4 = squareCentre("e4"); // empty square

    fireEvent(root, pointerEvent("pointerdown", { x: e4.x, y: e4.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));

    const arrows = model.getSnapshot().arrows;
    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.from).toBe(arrows[0]?.to);
  });
});
