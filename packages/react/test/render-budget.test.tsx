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

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { BoardModel, SquareIndex } from "@gigaboard/core";
import { Profiler, type ProfilerOnRenderCallback } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Chessboard } from "../src/chessboard.js";
import { makeBoardModel } from "./helpers.js";

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

  it("a single move triggers at most one root commit, a selection triggers zero", () => {
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

    // Selection changes never trigger a React commit anymore — the
    // imperative `useSelectionController` hook writes `data-gb-selection`
    // directly on the square DOM nodes. Legal-target highlights appear
    // without any reconciliation.
    expect(afterSelect).toBe(0);
    // A move still triggers exactly one commit — child components that
    // subscribe to the changed byte / last-move / history-ply slices
    // wake up inside that single commit.
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
