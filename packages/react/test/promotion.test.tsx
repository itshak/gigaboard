/**
 * Promotion-overlay integration tests.
 *
 * Exercises the built-in dialog (no `onPromote` prop) as well as the
 * caller-provided async resolver, covering pointer selection, keyboard
 * shortcuts, and cancellation paths.
 */

import { fireEvent, screen } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { PieceType } from "@ultrachess/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBoardModel, renderBoard } from "./helpers.js";

/** FEN with white pawn on a7 ready to promote to a8. */
const PROMOTION_FEN = "4k3/P7/8/8/8/8/8/4K3 w - - 0 1";

describe("promotion — built-in overlay", () => {
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel(PROMOTION_FEN);
  });

  afterEach(() => {
    model.dispose();
  });

  it("click-to-move a7→a8 opens the overlay", () => {
    renderBoard(model);
    fireEvent.click(screen.getByRole("gridcell", { name: "a7" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a8" }));
    expect(screen.getByRole("dialog")).toBeDefined();
    // Move is NOT yet played.
    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("pointer-click on a choice resolves the move", () => {
    renderBoard(model);
    fireEvent.click(screen.getByRole("gridcell", { name: "a7" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a8" }));
    fireEvent.click(screen.getByRole("button", { name: "Rook" }));
    expect(model.getSnapshot().historyPly).toBe(1);
    // Promoted piece is a rook (white rook on a8 → cell 4).
    expect(model.getSnapshot().board[56]).toBe(4);
  });

  it("keyboard shortcut resolves the move", () => {
    renderBoard(model);
    fireEvent.click(screen.getByRole("gridcell", { name: "a7" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a8" }));
    fireEvent.keyDown(window, { key: "n" });
    expect(model.getSnapshot().historyPly).toBe(1);
    // Promoted piece is a knight (white knight → cell 2).
    expect(model.getSnapshot().board[56]).toBe(2);
  });

  it("Escape cancels without playing the move", () => {
    renderBoard(model);
    fireEvent.click(screen.getByRole("gridcell", { name: "a7" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a8" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("clicking the overlay backdrop cancels", () => {
    renderBoard(model);
    fireEvent.click(screen.getByRole("gridcell", { name: "a7" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a8" }));
    const backdrop = document.querySelector('[data-layer="promotion-overlay"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(model.getSnapshot().historyPly).toBe(0);
  });
});

describe("promotion — caller-provided onPromote", () => {
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel(PROMOTION_FEN);
  });

  afterEach(() => {
    model.dispose();
  });

  it("invokes the async resolver and plays the returned piece", async () => {
    const onPromote = vi.fn(async () => PieceType.Rook);
    renderBoard(model, { onPromote });
    fireEvent.click(screen.getByRole("gridcell", { name: "a7" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a8" }));
    expect(onPromote).toHaveBeenCalledWith(
      expect.objectContaining({ from: 48, to: 56, color: 0 }),
    );
    await vi.waitFor(() => {
      expect(model.getSnapshot().historyPly).toBe(1);
    });
    // Promoted piece is a rook (white rook → cell 4).
    expect(model.getSnapshot().board[56]).toBe(4);
  });

  it("caller-provided reject abandons the move", async () => {
    const onPromote = vi.fn(async () => {
      throw new Error("user cancelled");
    });
    renderBoard(model, { onPromote });
    fireEvent.click(screen.getByRole("gridcell", { name: "a7" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "a8" }));
    await vi.waitFor(() => expect(onPromote).toHaveBeenCalled());
    // Move was not played.
    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("onPromote receives color=1 for black pawn promotion", async () => {
    const localModel = await makeBoardModel("4k3/8/8/8/8/8/7p/4K3 b - - 0 1");
    const onPromote = vi.fn(async () => PieceType.Queen);
    renderBoard(localModel, { onPromote });
    fireEvent.click(screen.getByRole("gridcell", { name: "h2" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "h1" }));
    expect(onPromote).toHaveBeenCalledWith(
      expect.objectContaining({ from: 15, to: 7, color: 1 }),
    );
    // Wait for the async resolver to settle before disposing the engine —
    // otherwise the Promise chain calls tryMove on a disposed Chess instance.
    await vi.waitFor(() => expect(localModel.getSnapshot().historyPly).toBe(1));
    localModel.dispose();
  });
});
