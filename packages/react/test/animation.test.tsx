/**
 * Animation tests.
 *
 * happy-dom does not implement the Web Animations API. We stub `animate`
 * on HTMLElement.prototype so `useAnimation` can call into it; the stub
 * records its inputs so we can assert duration, keyframes, etc.
 */

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { BoardModel, SquareIndex } from "@ultrachess/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installBoardGeometry, makeBoardModel, renderBoard } from "./helpers.js";

/**
 * Install a minimal WAAPI stub on `HTMLElement.prototype` and return the
 * array of captured `animate` calls.
 */
function installAnimateStub(): Array<{
  element: HTMLElement;
  keyframes: unknown;
  options: unknown;
}> {
  const calls: Array<{ element: HTMLElement; keyframes: unknown; options: unknown }> = [];
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
  (HTMLElement.prototype as any).getAnimations = () => [];
  return calls;
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

  it("drag-initiated moves skip the FLIP animation (the user already placed the piece)", async () => {
    renderBoard(model);
    const root = screen.getByRole("grid").parentElement as HTMLElement;
    calls.length = 0;
    const pd = (t: string, x: number, y: number) => {
      const e = new Event(t, { bubbles: true, cancelable: true });
      Object.defineProperty(e, "clientX", { value: x, configurable: true });
      Object.defineProperty(e, "clientY", { value: y, configurable: true });
      Object.defineProperty(e, "pointerId", { value: 1, configurable: true });
      Object.defineProperty(e, "button", { value: 0, configurable: true });
      return e;
    };
    // Drag e2 → e4. Viewport centres on a 400-px board: e2=(225,325), e4=(225,225).
    fireEvent(root, pd("pointerdown", 225, 325));
    fireEvent(root, pd("pointermove", 225, 225));
    fireEvent(root, pd("pointerup", 225, 225));
    await waitFor(() => {
      expect(model.getSnapshot().historyPly).toBe(1);
    });
    // No WAAPI animation was scheduled.
    expect(calls).toHaveLength(0);
  });

  it("click-to-move still animates (not a drag)", async () => {
    renderBoard(model);
    calls.length = 0;
    fireEvent.click(screen.getByRole("gridcell", { name: "e2" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "e4" }));
    await waitFor(() => {
      expect(model.getSnapshot().historyPly).toBe(1);
    });
    // FLIP animation fires on the destination piece slot.
    const dst = document.querySelector<HTMLElement>('[data-piece-square="e4"]');
    expect(calls.find((c) => c.element === dst)).toBeDefined();
  });

  it("illegal drag does not leak the skip flag into the next move", async () => {
    renderBoard(model);
    const root = screen.getByRole("grid").parentElement as HTMLElement;
    calls.length = 0;
    const pd = (t: string, x: number, y: number) => {
      const e = new Event(t, { bubbles: true, cancelable: true });
      Object.defineProperty(e, "clientX", { value: x, configurable: true });
      Object.defineProperty(e, "clientY", { value: y, configurable: true });
      Object.defineProperty(e, "pointerId", { value: 1, configurable: true });
      Object.defineProperty(e, "button", { value: 0, configurable: true });
      return e;
    };
    // e2 → e6 is illegal for the starting pawn.
    fireEvent(root, pd("pointerdown", 225, 325));
    fireEvent(root, pd("pointermove", 225, 125));
    fireEvent(root, pd("pointerup", 225, 125));
    // Now click-to-move e2 → e4 — should animate.
    calls.length = 0;
    fireEvent.click(screen.getByRole("gridcell", { name: "e2" }));
    fireEvent.click(screen.getByRole("gridcell", { name: "e4" }));
    await waitFor(() => {
      expect(model.getSnapshot().historyPly).toBe(1);
    });
    const dst = document.querySelector<HTMLElement>('[data-piece-square="e4"]');
    expect(calls.find((c) => c.element === dst)).toBeDefined();
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
    const grid = screen.getByRole("grid").parentElement as HTMLElement;

    const makeEvent = (type: string, x: number, y: number): Event => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(e, "clientX", { value: x, configurable: true });
      Object.defineProperty(e, "clientY", { value: y, configurable: true });
      Object.defineProperty(e, "pointerId", { value: 1, configurable: true });
      Object.defineProperty(e, "button", { value: 0, configurable: true });
      return e;
    };

    // Cross the activation threshold first. Drag-start legitimately commits
    // once (to populate legal targets) — we measure what happens *after*.
    fireEvent(grid, makeEvent("pointerdown", 250, 300));
    fireEvent(grid, makeEvent("pointermove", 270, 300));

    const spy = vi.fn();
    model.subscribe(spy);
    for (let i = 0; i < 10; i++) {
      fireEvent(grid, makeEvent("pointermove", 270 + i * 5, 300));
    }
    // No further model commits from pointermoves — drags are pure imperative.
    expect(spy).not.toHaveBeenCalled();
  });
});
