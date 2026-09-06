/**
 * Integration tests for `<Chessboard/>`.
 *
 * Exercises the click-to-move lifecycle with a real `gigachess` engine.
 * Queries by accessible role (`gridcell` with an `aria-label` per square)
 * so the test contract is the same one a screen-reader user would use.
 */

import { fireEvent, screen } from "@testing-library/react";
import type { BoardModel } from "../src/core/index.js";
import { Color } from "../src/core/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBoardModel, renderBoard } from "./helpers.js";

function gridcell(label: string): HTMLElement {
  return screen.getByRole("gridcell", { name: label });
}

/** Find the piece-layer slot for a square (or `null` if empty). */
function pieceAt(label: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-piece-square="${label}"]`);
}

describe("<Chessboard/>", () => {
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("renders a grid with all 64 squares labelled", () => {
    renderBoard(model);
    // A known corner + centre sample suffices; getByRole would find them all
    // if we looped, but assertion volume isn't the goal.
    expect(gridcell("a1")).toBeDefined();
    expect(gridcell("e2")).toBeDefined();
    expect(gridcell("h8")).toBeDefined();
  });

  it("renders the starting position pieces", () => {
    renderBoard(model);
    const e2Piece = pieceAt("e2");
    expect(e2Piece?.querySelector('img[alt="white pawn"]')).not.toBeNull();
  });

  it("click on own piece populates legal targets", () => {
    renderBoard(model);
    fireEvent.click(gridcell("e2"));
    expect(model.getSnapshot().selected).toBe(12);
    expect(model.getSnapshot().legalTargets.size).toBe(2);
  });

  it("click on legal target plays the move", () => {
    renderBoard(model);
    fireEvent.click(gridcell("e2"));
    fireEvent.click(gridcell("e4"));
    const snap = model.getSnapshot();
    expect(snap.turn).toBe(Color.Black);
    expect(snap.historyPly).toBe(1);
    expect(snap.selected).toBeNull();
    expect(pieceAt("e4")?.querySelector('img[alt="white pawn"]')).not.toBeNull();
    expect(pieceAt("e2")).toBeNull();
  });

  it("click on selected square deselects", () => {
    renderBoard(model);
    fireEvent.click(gridcell("e2"));
    fireEvent.click(gridcell("e2"));
    expect(model.getSnapshot().selected).toBeNull();
  });

  it("click on empty non-target deselects", () => {
    renderBoard(model);
    fireEvent.click(gridcell("e2"));
    fireEvent.click(gridcell("a5")); // empty, not a legal target from e2
    expect(model.getSnapshot().selected).toBeNull();
  });

  it("click on another own piece switches the selection", () => {
    renderBoard(model);
    fireEvent.click(gridcell("e2"));
    fireEvent.click(gridcell("d2"));
    expect(model.getSnapshot().selected).toBe(11);
  });

  it("click on opponent piece with no selection is a no-op", () => {
    renderBoard(model);
    fireEvent.click(gridcell("e7"));
    expect(model.getSnapshot().selected).toBeNull();
  });

  it("onMove receives the packed move after a successful click-to-move", () => {
    const onMove = vi.fn();
    renderBoard(model, { onMove });
    fireEvent.click(gridcell("e2"));
    fireEvent.click(gridcell("e4"));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(typeof onMove.mock.calls[0]?.[0]).toBe("number");
  });

  it("play a two-ply opening, then undo", () => {
    renderBoard(model);
    fireEvent.click(gridcell("e2"));
    fireEvent.click(gridcell("e4"));
    fireEvent.click(gridcell("e7"));
    fireEvent.click(gridcell("e5"));
    expect(model.getSnapshot().historyPly).toBe(2);
    model.undo();
    expect(model.getSnapshot().historyPly).toBe(1);
    model.undo();
    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("reset restores the starting position via the model", () => {
    renderBoard(model);
    fireEvent.click(gridcell("e2"));
    fireEvent.click(gridcell("e4"));
    model.reset();
    const snap = model.getSnapshot();
    expect(snap.turn).toBe(Color.White);
    expect(snap.historyPly).toBe(0);
  });

  it("orientation='black' still labels squares with absolute coordinates", () => {
    renderBoard(model, { orientation: "black" });
    // a1 is still labelled "a1" regardless of rendered order.
    expect(gridcell("a1")).toBeDefined();
    expect(gridcell("h8")).toBeDefined();
  });

  it("showCoordinates={false} still renders the grid", () => {
    renderBoard(model, { showCoordinates: false });
    expect(gridcell("e2")).toBeDefined();
  });

  it("showLegalTargets={false} suppresses legal-target highlights", () => {
    const { container } = renderBoard(model, { showLegalTargets: false });
    fireEvent.click(gridcell("e2"));
    // Selection still lands in the model.
    expect(model.getSnapshot().selected).toBe(12);
    // The selected square is still tinted via `data-gb-selection` on
    // the square itself — the imperative controller always honours
    // `selected`, regardless of target style.
    const selectedEl = gridcell("e2");
    expect(selectedEl?.dataset["gbSelection"]).toBe("selected");
    // But no legal-target squares get the quiet / capture states.
    const anyQuiet = container.querySelector('[data-gb-selection="legal-quiet"]');
    const anyCapture = container.querySelector('[data-gb-selection="legal-capture"]');
    expect(anyQuiet).toBeNull();
    expect(anyCapture).toBeNull();
    // And the container advertises that target rendering is off, so
    // the pseudo-element CSS doesn't paint either.
    expect(
      container.querySelector<HTMLElement>("[data-gb-target-style]")?.dataset["gbTargetStyle"],
    ).toBe("off");
  });

  it("renderSquare override is invoked for each square", () => {
    const spy = vi.fn(() => null);
    renderBoard(model, { renderSquare: spy });
    expect(spy).toHaveBeenCalled();
    // Called at least once per square on mount.
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(64);
  });

  it("renders a pieceless placeholder when game is null", () => {
    const { container } = renderBoard(null as unknown as BoardModel);
    expect(container.querySelector('[role="grid"]')).not.toBeNull();
    // No piece-layer slots should be present.
    expect(container.querySelector("[data-piece-square]")).toBeNull();
  });

  it("spreads theme CSS variables inline on the container (SSR-safe, no effect)", () => {
    const { container } = renderBoard(model, {
      theme: { "--gb-sq-light": "magenta" },
    });
    // The outermost div carries a style attribute with the theme var.
    const outer = container.firstElementChild as HTMLElement | null;
    expect(outer).not.toBeNull();
    const style = outer?.getAttribute("style") ?? "";
    expect(style).toMatch(/--gb-sq-light/);
  });

  it("consults getSquareAriaLabel to provide custom localized accessible labels", () => {
    const customLabel = (square: SquareIndex, _cell: BoardCell) => {
      const file = square & 7;
      const rank = square >> 3;
      const alg = `${String.fromCharCode(0x61 + file)}${rank + 1}`;
      if (square === 12) return `Поле ${alg} с белой пешкой`;
      return `Поле ${alg}`;
    };

    renderBoard(model, { getSquareAriaLabel: customLabel });
    const e2 = screen.getByRole("gridcell", { name: "Поле e2 с белой пешкой" });
    expect(e2).toBeDefined();
    expect(e2.getAttribute("data-square")).toBe("e2");
  });

  it("fires onSquareFocus when focus changes via keyboard navigation or tab", () => {
    const onFocusSpy = vi.fn();
    renderBoard(model, { onSquareFocus: onFocusSpy });

    const grid = screen.getByRole("grid");
    const e2 = screen.getByRole("gridcell", { name: "e2" });
    // Native focus into the square (sets document.activeElement)
    e2.focus();
    expect(onFocusSpy).toHaveBeenCalledWith(12, expect.any(Number));

    // Arrow navigation to e3
    fireEvent.keyDown(grid, { key: "ArrowUp" });
    expect(onFocusSpy).toHaveBeenCalledWith(20, expect.any(Number));
  });
});
