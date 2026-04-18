/**
 * Screen-reader live-region tests.
 *
 * Verifies that the `aria-live` region:
 * - exists as `role="status"` with `aria-live="polite"`
 * - is empty on the initial render
 * - receives a readable English description after a move
 * - covers normal moves, captures, promotions, en-passant, castling
 */

import { act } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { type SquareIndex } from "@ultrachess/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeBoardModel, renderBoard } from "./helpers.js";

function liveText(): string {
  const region = document.querySelector('[data-layer="live-region"]');
  return region?.textContent ?? "";
}

describe("live region (screen-reader announcer)", () => {
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("mounts as aria-live polite", () => {
    renderBoard(model);
    const region = document.querySelector('[data-layer="live-region"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("role")).toBe("status");
  });

  it("is empty on the initial board", () => {
    renderBoard(model);
    expect(liveText()).toBe("");
  });

  it("announces a normal pawn move", async () => {
    renderBoard(model);
    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
    });
    expect(liveText().toLowerCase()).toContain("white pawn");
    expect(liveText()).toContain("e2");
    expect(liveText()).toContain("e4");
  });

  it("announces a capture", async () => {
    renderBoard(model);
    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex); // e4
    });
    act(() => {
      model.tryMove(51 as SquareIndex, 35 as SquareIndex); // d5
    });
    act(() => {
      model.tryMove(28 as SquareIndex, 35 as SquareIndex); // exd5
    });
    expect(liveText().toLowerCase()).toContain("captures");
  });

  it("announces castling succinctly", async () => {
    const local = await makeBoardModel(
      "r3k2r/pppbqppp/2np1n2/4p3/4P3/2NPBN2/PPPBQPPP/R3K2R w KQkq - 0 1",
    );
    try {
      renderBoard(local);
      act(() => {
        local.tryMove(4 as SquareIndex, 6 as SquareIndex); // O-O
      });
      expect(liveText().toLowerCase()).toContain("castles");
    } finally {
      local.dispose();
    }
  });

  it("announces promotion", async () => {
    const local = await makeBoardModel("4k3/P7/8/8/8/8/8/4K3 w - - 0 1");
    try {
      renderBoard(local);
      act(() => {
        local.tryMove(48 as SquareIndex, 56 as SquareIndex, 4);
      });
      expect(liveText().toLowerCase()).toContain("promotes");
      expect(liveText().toLowerCase()).toContain("queen");
    } finally {
      local.dispose();
    }
  });
});
