/**
 * React-layer null-move (pass) tolerance.
 *
 * The core suite pins the transition and the arithmetic. This file pins the
 * *rendered* consequences, which is where a pass is easiest to get wrong: a
 * pass must be invisible. No piece animates, no last-move tint lands on the
 * square the sentinel decodes to, no legality ring is painted, and the
 * screen reader hears a pass rather than a phantom h8 move.
 *
 * It also pins the other half of the contract at the UI level: no user
 * gesture — click, drag, or keyboard — can originate a pass.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type BoardModel,
  Color,
  isNullMove,
  NULL_MOVE_WORD,
  type SquareIndex,
} from "../src/core/index.js";
import {
  installBoardGeometry,
  makeBoardModel,
  pointerEvent,
  renderBoard,
  squareCentre,
} from "./helpers.js";

const E2 = 12 as SquareIndex;
const E4 = 28 as SquareIndex;

/** Install a minimal WAAPI stub and return the captured `animate` calls. */
function installAnimateStub(): Array<{ element: HTMLElement }> {
  const calls: Array<{ element: HTMLElement }> = [];
  const fakeAnimation = { cancel: () => {}, finish: () => {}, play: () => {}, pause: () => {} };
  // biome-ignore lint/suspicious/noExplicitAny: stub
  (HTMLElement.prototype as any).animate = function () {
    calls.push({ element: this as HTMLElement });
    return fakeAnimation;
  };
  // biome-ignore lint/suspicious/noExplicitAny: stub
  (HTMLElement.prototype as any).getAnimations = () => [];
  return calls;
}

function container(): HTMLElement {
  return screen.getByRole("grid").parentElement as HTMLElement;
}

describe("a pass renders as nothing at all", () => {
  installBoardGeometry(400);
  let model: BoardModel;
  let calls: ReturnType<typeof installAnimateStub>;

  beforeEach(async () => {
    calls = installAnimateStub();
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("schedules no piece animation", async () => {
    renderBoard(model);
    await waitFor(() => {
      expect(document.querySelector('[data-piece-square="e2"]')).not.toBeNull();
    });

    calls.length = 0;
    act(() => {
      model.pass();
    });

    // A pass moves no piece, so no element may be animated. Before the
    // sentinel guard the planner decoded 0xffff as an h8-to-h8 move and
    // emitted a glide descriptor, which this asserts against.
    await waitFor(() => {
      expect(model.getSnapshot().turn).toBe(Color.Black);
    });
    expect(model.lastAnimations).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("paints no last-move tint", async () => {
    renderBoard(model);
    // A real move first, so a tint exists and a pass has one to clear.
    act(() => {
      model.tryMove(E2, E4);
    });
    await waitFor(() => {
      expect(document.querySelector("[data-gb-last-move]")).not.toBeNull();
    });

    act(() => {
      model.pass();
    });

    // The sentinel decodes to from = to = 63, so an unguarded controller
    // would paint h8. Nothing may remain tinted.
    await waitFor(() => {
      expect(document.querySelectorAll("[data-gb-last-move]")).toHaveLength(0);
    });
  });

  it("paints no legal-target ring", async () => {
    renderBoard(model);
    act(() => {
      model.selectSquare(E2);
    });
    await waitFor(() => {
      expect(document.querySelector('[data-gb-selection="legal-quiet"]')).not.toBeNull();
    });

    act(() => {
      model.pass();
    });

    // The pass consumes White's turn, so the selection and its ring are gone.
    await waitFor(() => {
      expect(document.querySelectorAll("[data-gb-selection]")).toHaveLength(0);
    });
  });

  it("announces the pass to screen readers", async () => {
    renderBoard(model);
    act(() => {
      model.pass();
    });
    const region = document.querySelector('[data-layer="live-region"]');
    await waitFor(() => {
      expect(region?.textContent ?? "").not.toBe("");
    });
    // "Passes." — not "king to h8" or any other phantom move description.
    expect(region?.textContent).toBe("Passes.");
  });

  it("keeps every piece exactly where it was on the board", async () => {
    renderBoard(model);
    const before = Array.from(model.getSnapshot().board);
    act(() => {
      model.pass();
    });
    expect(Array.from(model.getSnapshot().board)).toEqual(before);
    // The DOM still shows the same occupied squares.
    expect(document.querySelector('[data-piece-square="e2"]')).not.toBeNull();
    expect(document.querySelector('[data-piece-square="a1"]')).not.toBeNull();
  });

  it("does not throw when a pass is refused while in check", async () => {
    const checked = await makeBoardModel(
      "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
    );
    try {
      renderBoard(checked);
      expect(checked.getSnapshot().inCheck).toBe(true);
      expect(() =>
        act(() => {
          checked.pass();
        }),
      ).not.toThrow();
      // Refused: history is untouched.
      expect(checked.getSnapshot().historyPly).toBe(0);
    } finally {
      checked.dispose();
    }
  });
});

describe("no gesture originates a pass", () => {
  installBoardGeometry(400);
  let model: BoardModel;
  let onMove: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    installAnimateStub();
    model = await makeBoardModel();
    onMove = vi.fn();
  });

  afterEach(() => {
    model.dispose();
  });

  it("click-to-move never reports a pass", async () => {
    renderBoard(model, { onMove });
    fireEvent.click(screen.getByRole("gridcell", { name: "e2" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "e4" }));
    await waitFor(() => {
      expect(model.getSnapshot().historyPly).toBe(1);
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    const played = onMove.mock.calls[0]?.[0];
    expect(played).not.toBeNull();
    expect(isNullMove(played)).toBe(false);
  });

  it("clicking every square in turn never yields a pass", async () => {
    renderBoard(model, { onMove });
    const cells = screen.getAllByRole("gridcell");
    for (const cell of cells) {
      fireEvent.click(cell);
    }
    const snap = model.getSnapshot();
    // Whatever the clicks did, the board never reported a pass as a move.
    if (snap.lastMove !== null) expect(isNullMove(snap.lastMove)).toBe(false);
    for (const call of onMove.mock.calls) {
      expect(isNullMove(call[0])).toBe(false);
    }
  });

  it("dragging a piece never yields a pass", async () => {
    renderBoard(model, { onMove });
    const root = container();
    const from = squareCentre("e2");
    const to = squareCentre("e4");
    fireEvent(root, pointerEvent("pointerdown", { x: from.x, y: from.y }));
    fireEvent(root, pointerEvent("pointermove", { x: to.x, y: to.y }));
    fireEvent(root, pointerEvent("pointerup", { x: to.x, y: to.y }));
    await waitFor(() => {
      expect(model.getSnapshot().historyPly).toBe(1);
    });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(isNullMove(onMove.mock.calls[0]?.[0])).toBe(false);
  });

  it("keyboard activation never yields a pass", async () => {
    renderBoard(model, { onMove });
    const cell = screen.getByRole("gridcell", { name: "e2" });
    cell.focus();
    fireEvent.keyDown(cell, { key: "Enter" });
    fireEvent.keyDown(cell, { key: " " });
    for (const call of onMove.mock.calls) {
      expect(isNullMove(call[0])).toBe(false);
    }
    const snap = model.getSnapshot();
    if (snap.lastMove !== null) expect(isNullMove(snap.lastMove)).toBe(false);
  });

  it("a view-only board cannot pass at all", async () => {
    renderBoard(model, { viewOnly: true, onMove });
    fireEvent.click(screen.getByRole("gridcell", { name: "e2" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "e4" }));
    expect(onMove).not.toHaveBeenCalled();
    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("the sentinel is never reachable through undo/redo of a gesture", async () => {
    renderBoard(model, { onMove });
    fireEvent.click(screen.getByRole("gridcell", { name: "e2" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "e4" }));
    await waitFor(() => {
      expect(model.getSnapshot().historyPly).toBe(1);
    });
    // Undoing and redoing walks only real plies; the sentinel stays a
    // tolerance-only entry point.
    expect(model.undo()).not.toBe(NULL_MOVE_WORD);
    expect(model.redo()).not.toBe(NULL_MOVE_WORD);
  });
});
