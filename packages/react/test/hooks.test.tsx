/**
 * Tests for the React-layer hooks (`useBoardSlice`, `useSquareCell`,
 * `useChessGame`, `useClickToMove`, `useThemeVars`).
 *
 * These exercise the plumbing between `@gigaboard/core` and React's
 * concurrent rendering primitives. The focus is correctness of subscription
 * behaviour rather than visual output.
 */

import { act, render, screen } from "@testing-library/react";
import type { BoardModel } from "@gigaboard/core";
import { Color, type SquareIndex } from "@gigaboard/core";
import { describe, expect, it, vi } from "vitest";
import { useBoardSlice, useSquareCell } from "../src/hooks/use-board-subscription.js";
import { useChessGame } from "../src/hooks/use-chess-game.js";
import { useClickToMove } from "../src/hooks/use-click-to-move.js";
import { makeBoardModel } from "./helpers.js";

describe("useBoardSlice", () => {
  it("re-renders only when the selected slice changes", async () => {
    const model = await makeBoardModel();
    const renders = vi.fn();

    function Turn() {
      const turn = useBoardSlice(model, (s) => s.turn);
      renders();
      return <span>{turn}</span>;
    }

    render(<Turn />);
    expect(renders).toHaveBeenCalledTimes(1);

    // Add an arrow — commits but doesn't change `turn`. No re-render.
    act(() => {
      model.addArrow({ from: 0 as SquareIndex, to: 1 as SquareIndex, color: "red" });
    });
    expect(renders).toHaveBeenCalledTimes(1);

    // Move — changes turn to Black.
    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
    });
    expect(renders).toHaveBeenCalledTimes(2);
    expect(screen.getByText(String(Color.Black))).toBeDefined();
    model.dispose();
  });
});

describe("useSquareCell", () => {
  it("re-renders only on byte changes for its square", async () => {
    const model = await makeBoardModel();
    const e2Renders = vi.fn();
    const a1Renders = vi.fn();

    function Cell({ index, onRender }: { index: SquareIndex; onRender: () => void }) {
      const cell = useSquareCell(model, index);
      onRender();
      return <span>{cell}</span>;
    }

    render(
      <>
        <Cell index={12 as SquareIndex} onRender={e2Renders} />
        <Cell index={0 as SquareIndex} onRender={a1Renders} />
      </>,
    );
    expect(e2Renders).toHaveBeenCalledTimes(1);
    expect(a1Renders).toHaveBeenCalledTimes(1);

    // Move e2 → e4. e2 changes, a1 does not.
    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
    });
    expect(e2Renders).toHaveBeenCalledTimes(2);
    expect(a1Renders).toHaveBeenCalledTimes(1);
    model.dispose();
  });
});

describe("useClickToMove", () => {
  function Harness({ model }: { model: BoardModel | null }) {
    const handler = useClickToMove(model);
    return (
      <button type="button" onClick={() => handler(12 as SquareIndex)}>
        click
      </button>
    );
  }

  it("selects an own piece when nothing is selected", async () => {
    const model = await makeBoardModel();
    render(<Harness model={model} />);
    act(() => {
      screen.getByRole("button").click();
    });
    expect(model.getSnapshot().selected).toBe(12);
    model.dispose();
  });

  it("is a no-op when the model is null", () => {
    render(<Harness model={null} />);
    act(() => {
      screen.getByRole("button").click();
    });
    // Nothing to assert beyond "no crash" — render / click completed.
    expect(true).toBe(true);
  });
});

describe("useChessGame", () => {
  it("initializes synchronously on frame 0 without an async gap", () => {
    let capturedModel: BoardModel | null = null;
    let initialRenderModel: BoardModel | null = null;

    function GameComponent({ fen }: { fen?: string }) {
      const game = useChessGame({ fen });
      if (initialRenderModel === null) {
        initialRenderModel = game;
      }
      capturedModel = game;
      return <div data-turn={game.getSnapshot().turn}>game</div>;
    }

    render(<GameComponent />);

    // Must be non-null on the very first commit / render
    expect(initialRenderModel).not.toBeNull();
    expect(capturedModel).not.toBeNull();
    const model = capturedModel as unknown as BoardModel;
    expect(model.getSnapshot().turn).toBe(Color.White);
    expect(model.getSnapshot().board[12]).toBe(1); // white pawn on e2

    // Move plays immediately on frame 0
    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
    });
    expect(model.getSnapshot().historyPly).toBe(1);
    expect(model.getSnapshot().turn).toBe(Color.Black);
  });

  it("recreates model synchronously when fen changes", () => {
    let currentModel: BoardModel | null = null;

    function GameComponent({ fen }: { fen?: string }) {
      const game = useChessGame({ fen });
      currentModel = game;
      return <div>game</div>;
    }

    const { rerender } = render(<GameComponent />);
    const firstModel = currentModel;
    expect(firstModel).not.toBeNull();

    // Rerender with a new FEN
    rerender(<GameComponent fen="4k3/8/8/8/8/8/8/4K3 w - - 0 1" />);
    expect(currentModel).not.toBe(firstModel);
    expect((currentModel as unknown as BoardModel).engine.fen()).toContain("4k3/8/8/8/8/8/8/4K3");
  });
});
