/**
 * Test helpers shared across the React-layer test suite.
 *
 * The engine needs a few milliseconds to initialise (WASM load). Helpers
 * here provide a single promise-based `renderBoard` that mounts the
 * component and awaits the async model — keeps tests concise.
 */

import { createBoardModel, createUltrachessAdapter, type BoardModel } from "@ultrachess/core";
import { render, type RenderResult } from "@testing-library/react";
import type { ChessboardProps } from "../src/types.js";
import { Chessboard } from "../src/chessboard.js";

/** Build a live board model synchronously (for tests that need deterministic timing). */
export async function makeBoardModel(fen?: string): Promise<BoardModel> {
  const adapter = await createUltrachessAdapter(fen);
  return createBoardModel(adapter);
}

/** Render `<Chessboard/>` with a pre-initialised model. */
export function renderBoard(
  model: BoardModel,
  overrides: Partial<ChessboardProps> = {},
): RenderResult {
  return render(<Chessboard game={model} {...overrides} />);
}
