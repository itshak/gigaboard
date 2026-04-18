/**
 * Animation tests.
 *
 * happy-dom does not implement the Web Animations API. We stub `animate`
 * on HTMLElement.prototype so `useAnimation` can call into it; the stub
 * records its inputs so we can assert duration, keyframes, etc.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { BoardModel } from "@ultrachess/core";
import { type SquareIndex } from "@ultrachess/core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { makeBoardModel, renderBoard } from "./helpers.js";

/**
 * Install a minimal WAAPI stub on `HTMLElement.prototype` and return the
 * array of captured `animate` calls.
 */
function installAnimateStub(): Array<{
  element: HTMLElement;
  keyframes: unknown;
  options: unknown;
}> {
  const calls: Array<{ element: HTMLElement; keyframes: unknown; options: unknown }> =
    [];
  const fakeAnimation = {
    cancel: () => {},
    finish: () => {},
    play: () => {},
    pause: () => {},
    reverse: () => {},
  };
  // biome-ignore lint/suspicious/noExplicitAny: stub
  (HTMLElement.prototype as any).animate = function (kf: unknown, opt: unknown) {
    calls.push({ element: this as HTMLElement, keyframes: kf, options: opt });
    return fakeAnimation;
  };
  // biome-ignore lint/suspicious/noExplicitAny: stub
  (HTMLElement.prototype as any).getAnimations = function () {
    return [];
  };
  return calls;
}

/** Install a deterministic `getBoundingClientRect` returning a 400×400 board.
 *  Stays installed across the whole describe (re-installing per-test would
 *  leave later tests with happy-dom's zero-valued default). */
function installBoardGeometry(): void {
  let original: typeof Element.prototype.getBoundingClientRect;
  beforeAll(() => {
    original = Element.prototype.getBoundingClientRect;
    // biome-ignore lint/suspicious/noExplicitAny: stub
    (Element.prototype.getBoundingClientRect as any) = function () {
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 400,
        bottom: 400,
        width: 400,
        height: 400,
        toJSON: () => ({}),
      };
    };
  });
  afterAll(() => {
    Element.prototype.getBoundingClientRect = original;
  });
}

describe("useAnimation", () => {
  installBoardGeometry();
  let model: BoardModel;
  let calls: ReturnType<typeof installAnimateStub>;

  beforeEach(async () => {
    calls = installAnimateStub();
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("animates the destination piece on a move", async () => {
    renderBoard(model);
    calls.length = 0;
    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
    });
    await waitFor(() => {
      const dst = document.querySelector<HTMLElement>('[data-piece-square="e4"]');
      expect(dst).not.toBeNull();
      const animatedOnDst = calls.find((c) => c.element === dst);
      expect(animatedOnDst).toBeDefined();
    });
  });

  it("honours prefers-reduced-motion", () => {
    // Stub window.matchMedia to return `matches: true`.
    const realMatch = window.matchMedia;
    // biome-ignore lint/suspicious/noExplicitAny: stub
    (window as any).matchMedia = () => ({
      matches: true,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
      media: "",
    });
    try {
      renderBoard(model);
      calls.length = 0;
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
      // No animations should be scheduled.
      expect(calls).toHaveLength(0);
    } finally {
      window.matchMedia = realMatch;
    }
  });

  it("durationMs=0 disables animations", () => {
    renderBoard(model, { animation: { durationMs: 0 } });
    calls.length = 0;
    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
    });
    expect(calls).toHaveLength(0);
  });

  it("skips animation for appear/disappear descriptors (via undo)", () => {
    renderBoard(model);
    act(() => {
      model.tryMove(12 as SquareIndex, 28 as SquareIndex);
    });
    calls.length = 0;
    act(() => {
      model.undo();
    });
    // Undo falls back to byte-diff, producing `appear`/`disappear` — no
    // WAAPI animate calls are expected.
    expect(calls).toHaveLength(0);
  });
});

describe("render budget during drag", () => {
  installBoardGeometry();
  let model: BoardModel;

  beforeEach(async () => {
    installAnimateStub();
    model = await makeBoardModel();
  });

  afterEach(() => {
    model.dispose();
  });

  it("pointermove events during a drag produce zero extra model commits", () => {
    renderBoard(model);
    const spy = vi.fn();
    model.subscribe(spy);
    const grid = screen.getByRole("grid").parentElement as HTMLElement;

    const makeEvent = (type: string, x: number, y: number): Event => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, "clientX", { value: x, configurable: true });
      Object.defineProperty(e, "clientY", { value: y, configurable: true });
      Object.defineProperty(e, "pointerId", { value: 1, configurable: true });
      Object.defineProperty(e, "button", { value: 0, configurable: true });
      return e;
    };
    fireEvent(grid, makeEvent("pointerdown", 250, 300));
    for (let i = 0; i < 10; i++) {
      fireEvent(grid, makeEvent("pointermove", 250 + i * 5, 300));
    }
    // No model commits from pointermoves — drags are pure imperative.
    expect(spy).not.toHaveBeenCalled();
  });
});
