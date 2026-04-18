/**
 * Drag + drop integration tests.
 *
 * happy-dom provides synthetic pointer events but doesn't layout the DOM —
 * `getBoundingClientRect` returns zeros by default. We monkey-patch it so
 * the drag's hit-testing has a coordinate system to work with.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { Color } from "@ultrachess/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  squareCentre as centreOf,
  installBoardGeometry,
  makeBoardModel,
  pointerEvent,
  renderBoard,
} from "./helpers.js";

function container(): HTMLElement {
  return screen.getByRole("grid").parentElement as HTMLElement;
}

describe("drag + drop", () => {
  installBoardGeometry(400);
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("drags e2 → e4 and plays the move", () => {
    renderBoard(model);
    const root = container();
    const e2 = centreOf("e2");
    const e4 = centreOf("e4");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));

    const snap = model.getSnapshot();
    expect(snap.historyPly).toBe(1);
    expect(snap.turn).toBe(Color.Black);
  });

  it("drop on the same square is a no-op", () => {
    renderBoard(model);
    const root = container();
    const e2 = centreOf("e2");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e2.x + 20, y: e2.y + 20 }));
    fireEvent(root, pointerEvent("pointerup", { x: e2.x, y: e2.y }));

    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("drop outside the board cancels", () => {
    renderBoard(model);
    const root = container();
    const e2 = centreOf("e2");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: -50, y: -50 }));
    fireEvent(root, pointerEvent("pointerup", { x: -50, y: -50 }));

    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("pointerdown on an empty square ignores the drag", () => {
    renderBoard(model);
    const root = container();
    const a5 = centreOf("a5");
    const a4 = centreOf("a4");

    fireEvent(root, pointerEvent("pointerdown", { x: a5.x, y: a5.y }));
    fireEvent(root, pointerEvent("pointermove", { x: a4.x, y: a4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: a4.x, y: a4.y }));

    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("pointercancel aborts an in-flight drag", () => {
    renderBoard(model);
    const root = container();
    const e2 = centreOf("e2");
    const e4 = centreOf("e4");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointercancel", { x: e4.x, y: e4.y }));

    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("allowDrag={false} disables drag but leaves click-to-move intact", () => {
    renderBoard(model, { allowDrag: false });
    const root = container();
    const e2 = centreOf("e2");
    const e4 = centreOf("e4");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));
    expect(model.getSnapshot().historyPly).toBe(0);

    // Click-to-move still works.
    fireEvent.click(screen.getByRole("gridcell", { name: "e2" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "e4" }));
    expect(model.getSnapshot().historyPly).toBe(1);
  });

  it("fires onMove with the packed move after a successful drop", async () => {
    const onMove = vi.fn();
    renderBoard(model, { onMove });
    const root = container();
    const e2 = centreOf("e2");
    const e4 = centreOf("e4");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));

    await waitFor(() => expect(onMove).toHaveBeenCalledTimes(1));
  });

  it("drag-start populates the model selection so SelectionLayer shows legal targets", () => {
    renderBoard(model);
    const root = container();
    const e2 = centreOf("e2");
    const e4 = centreOf("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    // Selected square is populated during the drag so the overlay renders.
    expect(model.getSnapshot().selected).toBe(12);
    expect(model.getSnapshot().legalTargets.size).toBeGreaterThan(0);
  });

  it("drag-end clears the selection regardless of drop outcome", () => {
    renderBoard(model);
    const root = container();
    const e2 = centreOf("e2");
    const a6 = centreOf("a6"); // illegal target
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: a6.x, y: a6.y }));
    fireEvent(root, pointerEvent("pointerup", { x: a6.x, y: a6.y }));
    // Illegal drop — but selection is cleared so legal-target rings disappear.
    expect(model.getSnapshot().selected).toBeNull();
  });

  it("DragLayer renders a floating piece during dragging and unmounts after drop", async () => {
    renderBoard(model);
    const root = container();
    const e2 = centreOf("e2");
    const e3 = centreOf("e3");
    const e4 = centreOf("e4");

    act(() => {
      fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
      fireEvent(root, pointerEvent("pointermove", { x: e3.x, y: e3.y }));
    });
    await waitFor(() => {
      expect(document.querySelector('[data-layer="drag"]')).not.toBeNull();
    });

    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));
    await waitFor(() => {
      expect(document.querySelector('[data-layer="drag"]')).toBeNull();
    });
  });
});
