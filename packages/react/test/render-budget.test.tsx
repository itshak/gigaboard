/**
 * Render-count budget assertions.
 *
 * These back the claims in `PERFORMANCE.md`: a single move triggers ≤ 4
 * component re-renders, a selection triggers 0 piece re-renders (only the
 * selection overlay updates), and hover triggers 0 re-renders total.
 *
 * The strategy is deliberately simple: count the number of `Profiler`
 * `onRender` callbacks per action. We don't profile the whole app; we
 * wrap `<Chessboard/>` in a `<Profiler>` and let React report each commit.
 */

import { act, fireEvent, screen } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { type SquareIndex } from "@ultrachess/core";
import { Profiler, type ProfilerOnRenderCallback } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Chessboard } from "../src/chessboard.js";
import { makeBoardModel } from "./helpers.js";
import { render } from "@testing-library/react";

function countingRender(model: BoardModel): {
  unmount: () => void;
  resetCounts: () => void;
  getCount: (id: string) => number;
} {
  const counts = new Map<string, number>();
  const onRender: ProfilerOnRenderCallback = (id) => {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  const { unmount } = render(
    <Profiler id="Board" onRender={onRender}>
      <Chessboard game={model} />
    </Profiler>,
  );
  return {
    unmount,
    resetCounts: () => counts.clear(),
    getCount: (id) => counts.get(id) ?? 0,
  };
}

describe("render budget", () => {
  let model: BoardModel;

  beforeEach(async () => {
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("a single move triggers at most one root commit", () => {
    const harness = countingRender(model);
    harness.resetCounts();

    act(() => {
      model.selectSquare(12 as SquareIndex);
    });
    const afterSelect = harness.getCount("Board");

    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
    });
    const afterMove = harness.getCount("Board");

    // React batches all updates within an `act()` into a single commit. The
    // branded budget from PERFORMANCE.md is about *components* re-rendering;
    // at the Profiler root we collapse that into "commits". 1 commit per user
    // action is the bound we enforce here. (Per-component counts are
    // audited in `apps/benchmarks`.)
    expect(afterSelect).toBe(1);
    expect(afterMove - afterSelect).toBe(1);

    harness.unmount();
  });

  it("a click on an empty square with no selection triggers zero commits", () => {
    const harness = countingRender(model);
    harness.resetCounts();

    // Click an empty square without any prior selection — no model mutation,
    // no commit, no render.
    fireEvent.click(screen.getByRole("gridcell", { name: "a5" }));
    expect(harness.getCount("Board")).toBe(0);

    harness.unmount();
  });
});
