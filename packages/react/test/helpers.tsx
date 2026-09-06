/**
 * Test helpers shared across the React-layer test suite.
 *
 * The engine needs a few milliseconds to initialise (WASM load). Helpers
 * here provide a single promise-based `renderBoard` that mounts the
 * component and awaits the async model — keeps tests concise.
 */

import { type RenderResult, render } from "@testing-library/react";
import { type BoardModel, createBoardModel, createGigachessAdapter } from "../src/core/index.js";
import { afterAll, beforeAll } from "vitest";
import { Chessboard } from "../src/chessboard.js";
import type { ChessboardProps } from "../src/types.js";

/** Build a live board model synchronously (for tests that need deterministic timing). */
export async function makeBoardModel(fen?: string): Promise<BoardModel> {
  const adapter = createGigachessAdapter(fen);
  return createBoardModel(adapter);
}

/** Render `<Chessboard/>` with a pre-initialised model. */
export function renderBoard(
  model: BoardModel,
  overrides: Partial<ChessboardProps> = {},
): RenderResult {
  return render(<Chessboard game={model} {...overrides} />);
}

/**
 * Install a deterministic `getBoundingClientRect` returning a fixed-size
 * board across every element. happy-dom returns zero-valued rects by
 * default, which breaks coordinate-based hit testing.
 *
 * Stays installed across the whole describe scope (re-installing
 * per-test would leave later tests with the zero-valued default again).
 */
export function installBoardGeometry(size = 400): void {
  let original: typeof Element.prototype.getBoundingClientRect;
  beforeAll(() => {
    original = Element.prototype.getBoundingClientRect;
    // biome-ignore lint/suspicious/noExplicitAny: stub
    (Element.prototype.getBoundingClientRect as any) = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: size,
      bottom: size,
      width: size,
      height: size,
      toJSON: () => ({}),
    });
  });
  afterAll(() => {
    Element.prototype.getBoundingClientRect = original;
  });
}

/**
 * Factory for synthetic pointer events. happy-dom doesn't reliably carry
 * `PointerEvent` init-dict values through to the constructed event, so we
 * build a plain `Event` and attach the props we read in production via
 * `defineProperty`.
 */
export interface PointerEventOptions {
  readonly x: number;
  readonly y: number;
  /** Pointer identifier (defaults to 1). */
  readonly id?: number;
  /** Mouse button (0 = primary, 2 = secondary). Defaults to 0. */
  readonly button?: number;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
}

export function pointerEvent(type: string, options: PointerEventOptions): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: options.x, configurable: true });
  Object.defineProperty(event, "clientY", { value: options.y, configurable: true });
  Object.defineProperty(event, "pointerId", {
    value: options.id ?? 1,
    configurable: true,
  });
  Object.defineProperty(event, "button", {
    value: options.button ?? 0,
    configurable: true,
  });
  Object.defineProperty(event, "isPrimary", { value: true, configurable: true });
  Object.defineProperty(event, "shiftKey", {
    value: options.shiftKey ?? false,
    configurable: true,
  });
  Object.defineProperty(event, "altKey", {
    value: options.altKey ?? false,
    configurable: true,
  });
  Object.defineProperty(event, "ctrlKey", {
    value: options.ctrlKey ?? false,
    configurable: true,
  });
  Object.defineProperty(event, "metaKey", {
    value: options.metaKey ?? false,
    configurable: true,
  });
  return event;
}

/** Viewport-pixel centre of a square in white orientation on a 400-px board. */
export function squareCentre(label: string, boardSize = 400): { x: number; y: number } {
  const file = label.charCodeAt(0) - 0x61;
  const rank = Number(label[1]) - 1;
  const sq = boardSize / 8;
  return {
    x: sq * file + sq / 2,
    y: sq * (7 - rank) + sq / 2,
  };
}
