/**
 * Drag + drop integration tests.
 *
 * happy-dom provides synthetic pointer events but doesn't layout the DOM —
 * `getBoundingClientRect` returns zeros by default. We monkey-patch it so
 * the drag's hit-testing has a coordinate system to work with.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { Color, type SquareIndex } from "@ultrachess/core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBoardModel, renderBoard } from "./helpers.js";

/** Stub `getBoundingClientRect` on every element to a 400×400 board. Stays
 *  installed across the whole describe so every test sees the same geometry. */
function installBoardGeometry(size = 400): void {
  let original: typeof Element.prototype.getBoundingClientRect;
  beforeAll(() => {
    original = Element.prototype.getBoundingClientRect;
    // biome-ignore lint/suspicious/noExplicitAny: type-cast the stub
    (Element.prototype.getBoundingClientRect as any) = function () {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: size,
        bottom: size,
        width: size,
        height: size,
        toJSON: () => ({}),
      };
    };
  });
  afterAll(() => {
    Element.prototype.getBoundingClientRect = original;
  });
}

/** Viewport coordinates (px) for a square in white-orientation on a 400px board. */
function centreOf(label: string, boardSize = 400): { x: number; y: number } {
  const file = label.charCodeAt(0) - 0x61;
  const rank = Number(label[1]) - 1;
  const sq = boardSize / 8;
  return {
    x: sq * file + sq / 2,
    y: sq * (7 - rank) + sq / 2,
  };
}

function container(): HTMLElement {
  return screen.getByRole("grid").parentElement as HTMLElement;
}

function pointerEvent(type: string, { x, y, id = 1 }: { x: number; y: number; id?: number }) {
  // happy-dom doesn't reliably carry PointerEvent init-dict values through to
  // the constructed event. We build a plain `Event` and attach the props we
  // read in production (clientX/Y, pointerId, button) via `defineProperty`.
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: x, configurable: true });
  Object.defineProperty(event, "clientY", { value: y, configurable: true });
  Object.defineProperty(event, "pointerId", { value: id, configurable: true });
  Object.defineProperty(event, "button", { value: 0, configurable: true });
  Object.defineProperty(event, "isPrimary", { value: true, configurable: true });
  return event;
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
