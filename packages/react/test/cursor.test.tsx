/**
 * Tests for the cursor controller — verifies that `data-ucr-turn` and
 * `data-ucr-premove` are written on the board container per the
 * allowDrag / allowPremove predicate, and that the container flips
 * `data-ucr-dragging` during an active drag.
 *
 * The cursor controller moved from per-square data-attributes to a
 * single container-level attribute + CSS selectors keyed to
 * `[data-piece-cell]` — see `hooks/use-cursor-controller.ts` for the
 * rationale. These tests verify the new surface.
 */

import { fireEvent, screen } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installBoardGeometry, makeBoardModel, pointerEvent, renderBoard } from "./helpers.js";

function cellFor(square: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[role=gridcell][data-square="${square}"]`);
}

function boardContainer(): HTMLElement {
  // The grid is the `role=grid` div; its parent is the `<Chessboard/>` root.
  const grid = screen.getByRole("grid");
  const container = grid.parentElement;
  if (container === null) throw new Error("no board container");
  return container;
}

describe("cursor controller", () => {
  installBoardGeometry();

  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("writes `data-ucr-turn` on the container (starting position = white)", () => {
    renderBoard(model);
    expect(boardContainer().dataset["ucrTurn"]).toBe("white");
    expect(boardContainer().dataset["ucrPremove"]).toBeUndefined();
    // Squares no longer carry per-piece grabbable state — the CSS rule
    // keyed to `data-piece-cell` on the overlay does the matching.
    expect(cellFor("e2")?.dataset["ucrGrabbable"]).toBeUndefined();
  });

  it("does NOT write `data-ucr-turn` when `allowDrag` is false", () => {
    renderBoard(model, { allowDrag: false });
    expect(boardContainer().dataset["ucrTurn"]).toBeUndefined();
    expect(boardContainer().dataset["ucrPremove"]).toBeUndefined();
  });

  it('writes `data-ucr-premove="true"` on the container when `allowPremove` is true', () => {
    renderBoard(model, { allowPremove: true });
    expect(boardContainer().dataset["ucrTurn"]).toBe("white");
    expect(boardContainer().dataset["ucrPremove"]).toBe("true");
  });

  it("flips `data-ucr-dragging` on the container during an active drag", () => {
    renderBoard(model);
    const container = boardContainer();
    expect(container.dataset["ucrDragging"]).toBeUndefined();

    const e2 = cellFor("e2");
    if (e2 === null) throw new Error("e2 missing");

    // Start the drag.
    fireEvent(container, pointerEvent("pointerdown", { x: 200, y: 300 }));
    fireEvent(container, pointerEvent("pointermove", { x: 200, y: 220 }));
    expect(container.dataset["ucrDragging"]).toBe("true");

    // End the drag — drop back on e2 so the move is rejected but the
    // drag-end callback still fires.
    fireEvent(container, pointerEvent("pointerup", { x: 200, y: 300 }));
    expect(container.dataset["ucrDragging"]).toBeUndefined();
  });
});
