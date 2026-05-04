import { cleanup, render } from "@testing-library/react";
import { makeArrow, type SquareIndex } from "@ultrachess/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chessboard } from "../src/chessboard.js";
import { makeBoardModel, renderBoard } from "./helpers.js";

const E2 = 12 as SquareIndex;
const E4 = 28 as SquareIndex;
const E7 = 52 as SquareIndex;
const E5 = 36 as SquareIndex;
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

describe("controlled analysis board", () => {
  afterEach(() => {
    cleanup();
  });

  it("applies positionFen and managedArrows through one BoardModel action", async () => {
    const model = await makeBoardModel();
    const syncPosition = vi.spyOn(model, "syncPosition");
    try {
      renderBoard(model, {
        positionFen: AFTER_E4_FEN,
        managedArrows: [makeArrow(E7, E5, "red")],
      });

      expect(syncPosition).toHaveBeenCalledTimes(1);
      expect(model.getSnapshot().turn).toBe(1);
      expect(model.getSnapshot().arrows).toHaveLength(1);
      expect(model.getSnapshot().arrows[0]).toMatchObject({
        from: E7,
        to: E5,
        managed: true,
      });
    } finally {
      model.dispose();
    }
  });

  it("does not re-run the controlled sync for stable props during parent churn", async () => {
    const model = await makeBoardModel();
    const managedArrows = [makeArrow(E2, E4, "green")];
    const syncPosition = vi.spyOn(model, "syncPosition");

    function Harness({ tick }: { tick: number }) {
      void tick;
      return (
        <Chessboard game={model} positionFen={model.engine.fen()} managedArrows={managedArrows} />
      );
    }

    try {
      const { rerender } = render(<Harness tick={0} />);
      expect(syncPosition).toHaveBeenCalledTimes(1);

      rerender(<Harness tick={1} />);

      expect(syncPosition).toHaveBeenCalledTimes(1);
    } finally {
      model.dispose();
    }
  });
});
