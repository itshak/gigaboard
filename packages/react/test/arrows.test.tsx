/**
 * Arrow-gesture integration tests.
 *
 * Because `<canvas>` rendering is imperative and happy-dom doesn't
 * implement the 2D context meaningfully, we assert via the **model's**
 * arrow set rather than by inspecting the canvas pixels. The gesture
 * hook's contract: on pointer-up, invoke `game.toggleArrow`. That's what
 * we verify.
 */

import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type BoardModel, makeArrow, type SquareIndex } from "../src/core/index.js";
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

interface CanvasCall {
  readonly method: string;
  readonly args: readonly number[];
}

function installCanvasRecorder(calls: CanvasCall[]): () => void {
  const original = HTMLCanvasElement.prototype.getContext;
  const context = {
    setTransform: (...args: number[]) => calls.push({ method: "setTransform", args }),
    clearRect: (...args: number[]) => calls.push({ method: "clearRect", args }),
    beginPath: () => calls.push({ method: "beginPath", args: [] }),
    moveTo: (x: number, y: number) => calls.push({ method: "moveTo", args: [x, y] }),
    lineTo: (x: number, y: number) => calls.push({ method: "lineTo", args: [x, y] }),
    stroke: () => calls.push({ method: "stroke", args: [] }),
    arc: (...args: number[]) => calls.push({ method: "arc", args }),
    closePath: () => calls.push({ method: "closePath", args: [] }),
    fill: () => calls.push({ method: "fill", args: [] }),
  } as unknown as CanvasRenderingContext2D;

  HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as unknown as typeof original;
  return () => {
    HTMLCanvasElement.prototype.getContext = original;
  };
}

function firstStrokePath(calls: readonly CanvasCall[]): readonly CanvasCall[] {
  const firstMove = calls.findIndex((call) => call.method === "moveTo");
  const firstStroke = calls.findIndex(
    (call, index) => index > firstMove && call.method === "stroke",
  );
  expect(firstMove).toBeGreaterThanOrEqual(0);
  expect(firstStroke).toBeGreaterThan(firstMove);
  return calls.slice(firstMove, firstStroke + 1);
}

describe("arrow gesture", () => {
  installBoardGeometry(400);
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("right-click drag from a to b adds a default-green arrow", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));

    const arrows = model.getSnapshot().arrows;
    expect(arrows).toHaveLength(1);
    const arrow = arrows[0]!;
    expect(arrow.from).toBe(12);
    expect(arrow.to).toBe(28);
  });

  it("Shift swaps the colour channel", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2, shiftKey: true }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2, shiftKey: true }));
    const arrow = model.getSnapshot().arrows[0]!;
    // Default Shift colour is the lichess red.
    expect(arrow.color).toMatch(/153, 40, 40/);
  });

  it("Alt and Ctrl select distinct colour channels", () => {
    renderBoard(model);
    const root = container();
    const a1 = squareCentre("a1");
    const h8 = squareCentre("h8");

    fireEvent(root, pointerEvent("pointerdown", { x: a1.x, y: a1.y, button: 2, altKey: true }));
    fireEvent(root, pointerEvent("pointerup", { x: h8.x, y: h8.y, button: 2, altKey: true }));

    const a1b = squareCentre("b2");
    const h8c = squareCentre("g7");
    fireEvent(root, pointerEvent("pointerdown", { x: a1b.x, y: a1b.y, button: 2, ctrlKey: true }));
    fireEvent(root, pointerEvent("pointerup", { x: h8c.x, y: h8c.y, button: 2, ctrlKey: true }));

    const arrows = model.getSnapshot().arrows;
    expect(arrows).toHaveLength(2);
    // Yellow for alt, blue for ctrl.
    expect(arrows.some((a) => /230, 160, 0/.test(a.color))).toBe(true);
    expect(arrows.some((a) => /0, 60, 130/.test(a.color))).toBe(true);
  });

  it("right-click on a single square (no drag) adds a same-square mark", () => {
    renderBoard(model);
    const root = container();
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e4.x, y: e4.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    const arrow = model.getSnapshot().arrows[0]!;
    expect(arrow.from).toBe(arrow.to);
    expect(arrow.from).toBe(28);
  });

  it("drawing the same arrow twice toggles it off", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    const draw = () => {
      fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
      fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    };
    draw();
    draw();
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("allowDrawingArrows={false} disables the gesture", () => {
    renderBoard(model, { allowDrawingArrows: false });
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("left-click drags don't trigger arrow drawing", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("preventDefault is called on contextmenu", () => {
    renderBoard(model);
    const root = container();
    const evt = new Event("contextmenu", { bubbles: true, cancelable: true });
    const prevented = !root.dispatchEvent(evt);
    expect(prevented).toBe(true);
  });

  it("clearArrowsOnMove wipes arrows after a move", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");

    // Draw an arrow.
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    expect(model.getSnapshot().arrows).toHaveLength(1);

    // Play a move.
    model.tryMove(12, 28);
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("clearArrowsOnMove={false} preserves arrows across a move", () => {
    renderBoard(model, { clearArrowsOnMove: false });
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    model.tryMove(12, 28);
    expect(model.getSnapshot().arrows).toHaveLength(1);
  });

  it("renders an <ArrowsLayer/> canvas in the tree", () => {
    renderBoard(model);
    const layer = document.querySelector('[data-layer="arrows"]');
    expect(layer).not.toBeNull();
    expect(layer?.tagName).toBe("CANVAS");
  });

  it("renders knight arrows as a bent Russian-G path", () => {
    const calls: CanvasCall[] = [];
    const restoreCanvas = installCanvasRecorder(calls);
    try {
      model.addArrow(makeArrow(21 as SquareIndex, 36 as SquareIndex, "rgba(255, 120, 170, 0.62)"));

      renderBoard(model);

      expect(firstStrokePath(calls)).toEqual([
        { method: "moveTo", args: [275, 261] },
        { method: "lineTo", args: [275, 175] },
        { method: "lineTo", args: [247, 175] },
        { method: "stroke", args: [] },
      ]);
    } finally {
      restoreCanvas();
    }
  });

  it("stops straight arrow shafts at the arrowhead base", () => {
    const calls: CanvasCall[] = [];
    const restoreCanvas = installCanvasRecorder(calls);
    try {
      model.addArrow(makeArrow(0 as SquareIndex, 4 as SquareIndex, "rgba(120, 200, 235, 0.72)"));

      renderBoard(model);

      expect(firstStrokePath(calls)).toEqual([
        { method: "moveTo", args: [39, 375] },
        { method: "lineTo", args: [203, 375] },
        { method: "stroke", args: [] },
      ]);
    } finally {
      restoreCanvas();
    }
  });

  it("a left-click on any square wipes existing arrows", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    expect(model.getSnapshot().arrows).toHaveLength(1);

    fireEvent.click(screen.getByRole("gridcell", { name: "a5" }));
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("a left-drag start clears existing arrows", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    expect(model.getSnapshot().arrows).toHaveLength(1);

    // Drag e2 → e4. Arrows clear at drag-start.
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("Escape clears arrows", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    expect(model.getSnapshot().arrows).toHaveLength(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("clearArrowsOnClick={false} preserves arrows across clicks", () => {
    renderBoard(model, { clearArrowsOnClick: false });
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y, button: 2 }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a5" }));
    expect(model.getSnapshot().arrows).toHaveLength(1);
  });
});
