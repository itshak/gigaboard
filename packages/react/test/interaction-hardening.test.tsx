/**
 * Smaller M1 interaction-hardening features: `canDragPiece`,
 * `onSquareMouseEnter/Leave`, `ranksPosition`, `disableContextMenu`,
 * and the drag-ghost opacity CSS-var.
 */

import { fireEvent, screen } from "@testing-library/react";
import type { BoardModel, SquareIndex } from "../src/core/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("canDragPiece", () => {
  installBoardGeometry(400);
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("aborts the drag when the predicate returns false", () => {
    const canDrag = vi.fn().mockReturnValue(false);
    renderBoard(model, { canDragPiece: canDrag });

    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));

    expect(canDrag).toHaveBeenCalledTimes(1);
    expect(canDrag).toHaveBeenCalledWith(expect.objectContaining({ square: 12 as SquareIndex }));
    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("allows the drag when the predicate returns true", () => {
    renderBoard(model, { canDragPiece: () => true });
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));

    expect(model.getSnapshot().historyPly).toBe(1);
  });
});

describe("onSquareMouseEnter / onSquareMouseLeave", () => {
  installBoardGeometry(400);
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("fires enter/leave transitions exactly once per square crossing", () => {
    const enter = vi.fn();
    const leave = vi.fn();
    renderBoard(model, {
      onSquareMouseEnter: enter,
      onSquareMouseLeave: leave,
    });

    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");

    fireEvent(root, pointerEvent("pointermove", { x: e2.x, y: e2.y }));
    expect(enter).toHaveBeenCalledTimes(1);
    expect(enter).toHaveBeenLastCalledWith(expect.objectContaining({ square: 12 as SquareIndex }));

    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenLastCalledWith(expect.objectContaining({ square: 12 as SquareIndex }));
    expect(enter).toHaveBeenCalledTimes(2);
    expect(enter).toHaveBeenLastCalledWith(expect.objectContaining({ square: 28 as SquareIndex }));
  });

  it("does not install a listener when neither callback is supplied", () => {
    // Indirect check: mounting without the callbacks must not throw and
    // a subsequent pointermove must not cause any spurious effect (we
    // don't have a direct observable, but zero errors + zero model
    // mutations is the contract).
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    fireEvent(root, pointerEvent("pointermove", { x: e2.x, y: e2.y }));
    expect(model.getSnapshot().historyPly).toBe(0);
  });
});

describe("ranksPosition", () => {
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  function rankLabels(): HTMLSpanElement[] {
    return Array.from(container().querySelectorAll<HTMLSpanElement>("span")).filter((el) =>
      /^[1-8]$/.test(el.textContent ?? ""),
    );
  }

  it('defaults to "left" — rank labels sit on the left edge', () => {
    renderBoard(model);
    for (const el of rankLabels()) {
      expect(el.style.left).toBe("1%");
      expect(el.style.right).toBe("");
    }
  });

  it('"right" moves the labels to the right edge', () => {
    renderBoard(model, { ranksPosition: "right" });
    for (const el of rankLabels()) {
      expect(el.style.right).toBe("1%");
      expect(el.style.left).toBe("");
    }
  });
});

describe("disableContextMenu", () => {
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("calls preventDefault on contextmenu events by default", () => {
    renderBoard(model);
    const root = container();
    const evt = new Event("contextmenu", { bubbles: true, cancelable: true });
    root.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
  });

  it("leaves the menu alone when disableContextMenu=false AND arrows disabled", () => {
    renderBoard(model, { disableContextMenu: false, allowDrawingArrows: false });
    const root = container();
    const evt = new Event("contextmenu", { bubbles: true, cancelable: true });
    root.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(false);
  });
});

describe("drag ghost origin opacity", () => {
  installBoardGeometry(400);
  let model: BoardModel;
  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("sets opacity via the --gb-drag-ghost-opacity CSS var on drag-start", () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));

    // The origin piece DOM element is flagged with data-piece-square="e2".
    const origin = root.querySelector<HTMLElement>(`[data-piece-square="e2"]`);
    expect(origin).not.toBeNull();
    // Reads through var() so themes control the behaviour; fallback 0.35.
    expect(origin?.style.opacity).toMatch(/var\(--gb-drag-ghost-opacity,\s*0.35\)/);

    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));
  });
});
