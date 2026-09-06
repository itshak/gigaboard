/**
 * Keyboard-navigation integration tests.
 *
 * Exercises the WAI-ARIA grid pattern: arrow keys move the roving
 * tabindex, Enter/Space activate, Escape clears, Home/End jump.
 */

import { fireEvent, screen } from "@testing-library/react";
import type { BoardModel } from "@gigaboard/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeBoardModel, renderBoard } from "./helpers.js";

/** Find the cell that currently holds the roving tabindex. */
function focusedCell(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[role=gridcell][tabindex='0']");
}

/** Dispatch a keydown on the board container. */
function sendKey(key: string, init: KeyboardEventInit = {}): void {
  const grid = screen.getByRole("grid");
  fireEvent.keyDown(grid, { key, ...init });
}

describe("keyboard navigation", () => {
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("initial focus is on e2 for a white-orientation board", () => {
    renderBoard(model);
    const cell = focusedCell();
    expect(cell).not.toBeNull();
    expect(cell?.getAttribute("data-square")).toBe("e2");
  });

  it("ArrowUp moves the roving tabindex up one rank", () => {
    renderBoard(model);
    sendKey("ArrowUp");
    expect(focusedCell()?.getAttribute("data-square")).toBe("e3");
  });

  it("ArrowRight moves right one file", () => {
    renderBoard(model);
    sendKey("ArrowRight");
    expect(focusedCell()?.getAttribute("data-square")).toBe("f2");
  });

  it("Arrow at the edge clamps to the edge", () => {
    renderBoard(model);
    // From e2 → walk all the way left.
    for (let i = 0; i < 10; i++) sendKey("ArrowLeft");
    expect(focusedCell()?.getAttribute("data-square")).toBe("a2");
  });

  it("Home / End jump within the current rank", () => {
    renderBoard(model);
    sendKey("End");
    expect(focusedCell()?.getAttribute("data-square")).toBe("h2");
    sendKey("Home");
    expect(focusedCell()?.getAttribute("data-square")).toBe("a2");
  });

  it("Ctrl+Home / Ctrl+End jump to the board corners", () => {
    renderBoard(model);
    sendKey("Home", { ctrlKey: true });
    expect(focusedCell()?.getAttribute("data-square")).toBe("a8");
    sendKey("End", { ctrlKey: true });
    expect(focusedCell()?.getAttribute("data-square")).toBe("h1");
  });

  it("Enter activates the focused square (click-to-move)", () => {
    renderBoard(model);
    // Focus defaults to e2 (white pawn) — Enter selects it.
    sendKey("Enter");
    expect(model.getSnapshot().selected).toBe(12);
  });

  it("Space also activates (WAI-ARIA grid keyboard contract)", () => {
    renderBoard(model);
    sendKey(" ");
    expect(model.getSnapshot().selected).toBe(12);
  });

  it("Escape clears the selection", () => {
    renderBoard(model);
    sendKey("Enter");
    expect(model.getSnapshot().selected).toBe(12);
    sendKey("Escape");
    expect(model.getSnapshot().selected).toBeNull();
  });

  it("full keyboard-only workflow: select e2, arrow up twice, Enter → plays e4", () => {
    renderBoard(model);
    sendKey("Enter"); // select e2
    sendKey("ArrowUp");
    sendKey("ArrowUp");
    // Focus is now on e4 — Enter moves the selected pawn there.
    sendKey("Enter");
    const snap = model.getSnapshot();
    expect(snap.historyPly).toBe(1);
    expect(snap.board[28]).toBe(1); // white pawn on e4
  });

  it("orientation='black' flips the default focus landing", () => {
    renderBoard(model, { orientation: "black" });
    expect(focusedCell()?.getAttribute("data-square")).toBe("e7");
  });

  it("arrow keys respect orientation — ArrowUp on black goes toward white's side", () => {
    renderBoard(model, { orientation: "black" });
    // From e7, ArrowUp moves visually up (toward black's back rank = rank 8),
    // so focus lands on e8 (as seen by the player with black at the bottom,
    // rank 8 is visually at the top).
    sendKey("ArrowUp");
    // On a flipped board, e7 visually sits in row 1; "up" in visual space
    // means row 0, which maps back to rank 0 = e1 for black orientation...
    // no — actually with orientation=black: row 0 = rank 7 (visual top = a8 side).
    // So ArrowUp from e7 (rank=6, row=6) → row=5 → rank=5 → e6.
    expect(focusedCell()?.getAttribute("data-square")).toBe("e6");
  });
});
