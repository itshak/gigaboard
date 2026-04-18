/**
 * Premove integration tests.
 *
 * Covers: detecting an out-of-turn drop and queuing it; auto-playing
 * premoves once the opponent moves; suppression via `allowPremove={false}`;
 * visual layer mounting.
 */

import { fireEvent, screen } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { Color, type SquareIndex } from "@ultrachess/core";
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

/**
 * Helper: drag a white piece while it's black's turn.
 *
 * The setup FEN below was reached after `1.e4` — so e2 is empty and we use
 * d2 (still unmoved) as the premove source.
 */
function dragWhiteD2toD3(root: HTMLElement): void {
  const d2 = squareCentre("d2");
  const d3 = squareCentre("d3");
  fireEvent(root, pointerEvent("pointerdown", { x: d2.x, y: d2.y }));
  fireEvent(root, pointerEvent("pointermove", { x: d3.x, y: d3.y }));
  fireEvent(root, pointerEvent("pointerup", { x: d3.x, y: d3.y }));
}

describe("premove", () => {
  installBoardGeometry(400);
  let model: BoardModel;

  beforeEach(async () => {
    // Position after `1.e4` — black to move, white pieces otherwise intact.
    model = await makeBoardModel("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
  });

  afterEach(() => {
    model.dispose();
  });

  it("with `allowPremove={true}`, an out-of-turn piece queues a premove", () => {
    renderBoard(model, { allowPremove: true });
    dragWhiteD2toD3(container());
    const pre = model.getSnapshot().premoves;
    expect(pre).toHaveLength(1);
    expect(pre[0]?.from).toBe(11); // d2
    expect(pre[0]?.to).toBe(19); // d3
    // The actual board didn't advance.
    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("allowPremove defaults to false — out-of-turn drag is rejected", () => {
    renderBoard(model); // no allowPremove prop → default
    dragWhiteD2toD3(container());
    expect(model.getSnapshot().premoves).toHaveLength(0);
  });

  it("allowPremove={false} fires the illegal-flash (consistent with any other rejected move)", async () => {
    renderBoard(model); // default false
    dragWhiteD2toD3(container());
    // The illegal-flash layer mounts on the origin square.
    expect(document.querySelector('[data-layer="illegal-flash"]')).not.toBeNull();
  });

  it("queued premove plays when the opponent moves", () => {
    renderBoard(model, { allowPremove: true });
    dragWhiteD2toD3(container());
    expect(model.getSnapshot().premoves).toHaveLength(1);

    // Black plays e7 → e6 (e7 = 52, e6 = 44).
    model.tryMove(52 as SquareIndex, 44 as SquareIndex);

    // Premove auto-applied; queue drained; history shows 2 plies.
    expect(model.getSnapshot().premoves).toHaveLength(0);
    expect(model.getSnapshot().historyPly).toBe(2);
    expect(model.getSnapshot().turn).toBe(Color.Black);
  });

  it("auto-queens a premove pawn reaching the last rank", async () => {
    const localModel = await makeBoardModel(
      // Black to move; white pawn on a7 ready to promote.
      "4k3/P7/8/8/8/8/8/4K3 b - - 0 1",
    );
    try {
      renderBoard(localModel, { allowPremove: true });
      const root = container();
      const a7 = squareCentre("a7");
      const a8 = squareCentre("a8");
      fireEvent(root, pointerEvent("pointerdown", { x: a7.x, y: a7.y }));
      fireEvent(root, pointerEvent("pointermove", { x: a8.x, y: a8.y }));
      fireEvent(root, pointerEvent("pointerup", { x: a8.x, y: a8.y }));
      const pre = localModel.getSnapshot().premoves;
      expect(pre).toHaveLength(1);
      // Promotion piece is Queen (PieceType.Queen = 4).
      expect(pre[0]?.promotion).toBe(4);
    } finally {
      localModel.dispose();
    }
  });

  it("renders a PremoveLayer ghost when a premove is queued", () => {
    renderBoard(model, { allowPremove: true });
    dragWhiteD2toD3(container());
    expect(document.querySelector('[data-layer="premove"]')).not.toBeNull();
    expect(document.querySelector('[data-premove-ghost="true"]')).not.toBeNull();
  });
});
