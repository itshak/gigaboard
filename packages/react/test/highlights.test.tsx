/**
 * Tests for the check highlight + illegal-flash layers.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import type { BoardModel } from "../src/core/index.js";
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

describe("check highlight", () => {
  it("renders a CheckLayer when side-to-move is in check", async () => {
    // Scholar's-mate trap position: black king to move, in check from Qxf7.
    const model = await makeBoardModel(
      "rnbqkbnr/pppp1Qpp/8/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 3",
    );
    try {
      renderBoard(model);
      expect(document.querySelector('[data-layer="check"]')).not.toBeNull();
    } finally {
      model.dispose();
    }
  });

  it("renders nothing when not in check", async () => {
    const model = await makeBoardModel();
    try {
      renderBoard(model);
      expect(document.querySelector('[data-layer="check"]')).toBeNull();
    } finally {
      model.dispose();
    }
  });

  it("showCheckHighlight={false} suppresses the layer", async () => {
    const model = await makeBoardModel(
      "rnbqkbnr/pppp1Qpp/8/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 3",
    );
    try {
      renderBoard(model, { showCheckHighlight: false });
      expect(document.querySelector('[data-layer="check"]')).toBeNull();
    } finally {
      model.dispose();
    }
  });
});

describe("illegal flash", () => {
  installBoardGeometry(400);
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("renders when a drag attempt is rejected", async () => {
    renderBoard(model);
    const root = container();
    // White pawn e2 attempts to jump to e6 — illegal.
    const e2 = squareCentre("e2");
    const e6 = squareCentre("e6");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e6.x, y: e6.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e6.x, y: e6.y }));
    await waitFor(() => {
      expect(document.querySelector('[data-layer="illegal-flash"]')).not.toBeNull();
    });
  });

  it("clears after the hold window", async () => {
    renderBoard(model);
    const root = container();
    const e2 = squareCentre("e2");
    const e6 = squareCentre("e6");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e6.x, y: e6.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e6.x, y: e6.y }));
    await waitFor(() => {
      expect(document.querySelector('[data-layer="illegal-flash"]')).not.toBeNull();
    });
    // ILLEGAL_FLASH_HOLD_MS is 320; waitFor default timeout is 1000ms.
    await waitFor(() => expect(document.querySelector('[data-layer="illegal-flash"]')).toBeNull(), {
      timeout: 1000,
    });
  });

  it("showIllegalFlash={false} suppresses the flash entirely", async () => {
    renderBoard(model, { showIllegalFlash: false });
    const root = container();
    const e2 = squareCentre("e2");
    const e6 = squareCentre("e6");
    fireEvent(root, pointerEvent("pointerdown", { x: e2.x, y: e2.y }));
    fireEvent(root, pointerEvent("pointermove", { x: e6.x, y: e6.y }));
    fireEvent(root, pointerEvent("pointerup", { x: e6.x, y: e6.y }));
    // Wait a tick and confirm nothing appeared.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector('[data-layer="illegal-flash"]')).toBeNull();
  });
});
