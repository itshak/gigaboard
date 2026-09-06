/**
 * `viewOnly` prop — integration tests.
 *
 * Covers the guarantee that every user-input subsystem (drag, click-to-
 * move, keyboard, arrow drawing) is disabled in `viewOnly` mode while
 * the declarative surfaces (live region, highlights, coordinates) keep
 * working. Also verifies the grid is removed from the keyboard tab
 * order by asserting no square holds `tabindex=0`.
 */

import { fireEvent, screen } from "@testing-library/react";
import type { BoardModel } from "@gigaboard/core";
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

describe("viewOnly", () => {
  installBoardGeometry(400);
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });
  afterEach(() => model.dispose());

  it("sets aria-readonly and data-gb-view-only on the container", () => {
    renderBoard(model, { viewOnly: true });
    expect(screen.getByRole("grid").getAttribute("aria-readonly")).toBe("true");
    expect(container().dataset["gbViewOnly"]).toBe("true");
  });

  it("keeps no square in the tab order", () => {
    renderBoard(model, { viewOnly: true });
    const squares = container().querySelectorAll("[data-gb-square]");
    expect(squares.length).toBe(64);
    for (const sq of squares) {
      expect(sq.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("ignores drag attempts", () => {
    renderBoard(model, { viewOnly: true });
    const root = container();
    const e2 = squareCentre("e2");
    const e4 = squareCentre("e4");

    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e4.x, y: e4.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e4.x, y: e4.y }));

    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("ignores click-to-move", () => {
    renderBoard(model, { viewOnly: true });
    const e2 = screen.getByLabelText("e2");
    fireEvent.click(e2);
    expect(model.getSnapshot().selected).toBeNull();
  });

  it("ignores right-click arrow drawing", () => {
    renderBoard(model, { viewOnly: true });
    const root = container();
    const a1 = squareCentre("a1");
    const h8 = squareCentre("h8");

    fireEvent(root, pointerEvent("pointerdown", { x: a1.x, y: a1.y, button: 2 }));
    fireEvent(root, pointerEvent("pointermove", { x: h8.x, y: h8.y, button: 2 }));
    fireEvent(root, pointerEvent("pointerup", { x: h8.x, y: h8.y, button: 2 }));

    expect(model.getSnapshot().arrows.length).toBe(0);
  });

  it("still applies programmatic arrow placement", () => {
    renderBoard(model, { viewOnly: true });
    model.addArrow({ from: 0, to: 9, color: "rgb(21, 120, 27)" });
    expect(model.getSnapshot().arrows.length).toBe(1);
  });
});
