/**
 * Tests for the cursor controller — verifies that `data-ucr-grabbable`
 * is written on the right squares per the allowDrag / allowPremove
 * predicate, and that the container flips `data-ucr-dragging` during
 * an active drag.
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

  it("marks white pieces grabbable on the starting position (white to move)", () => {
    renderBoard(model);
    // A white pawn — should be grabbable.
    expect(cellFor("e2")?.dataset["ucrGrabbable"]).toBe("true");
    // A black pawn — not our turn and premoves are off (default).
    expect(cellFor("e7")?.dataset["ucrGrabbable"]).toBeUndefined();
    // An empty square — never grabbable.
    expect(cellFor("e4")?.dataset["ucrGrabbable"]).toBeUndefined();
  });

  it("does not mark anything grabbable when `allowDrag` is false", () => {
    renderBoard(model, { allowDrag: false });
    expect(cellFor("e2")?.dataset["ucrGrabbable"]).toBeUndefined();
    expect(cellFor("e7")?.dataset["ucrGrabbable"]).toBeUndefined();
  });

  it("marks opponent pieces grabbable as well when `allowPremove` is true", () => {
    renderBoard(model, { allowPremove: true });
    expect(cellFor("e2")?.dataset["ucrGrabbable"]).toBe("true");
    // The opposite colour is now also considered grabbable (premove source).
    expect(cellFor("e7")?.dataset["ucrGrabbable"]).toBe("true");
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
