import { act, render } from "@testing-library/react";
import type { BoardModel } from "../src/core/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMoveHaptics } from "../src/hooks/use-move-haptics.js";
import { triggerHaptic, warmupHaptics } from "../src/lib/haptics.js";
import { makeBoardModel } from "./helpers.js";

vi.mock("../src/lib/haptics.js", () => ({
  triggerHaptic: vi.fn(),
  warmupHaptics: vi.fn(),
}));

function HapticsProbe({
  model,
  options,
}: {
  model: BoardModel | null;
  options?: Parameters<typeof useMoveHaptics>[1];
}) {
  useMoveHaptics(model, options);
  return null;
}

describe("useMoveHaptics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("triggers the default selection pattern for a plain move", async () => {
    const model = await makeBoardModel();
    try {
      render(<HapticsProbe model={model} />);
      act(() => {
        model.tryMove(12 as never, 28 as never); // e2 → e4
      });
      expect(triggerHaptic).toHaveBeenLastCalledWith("selection", {
        enabled: true,
        intensity: undefined,
        mobileOnly: true,
      });
    } finally {
      model.dispose();
    }
  });

  it("does nothing when disabled", async () => {
    const model = await makeBoardModel();
    try {
      render(<HapticsProbe model={model} options={{ enabled: false }} />);
      act(() => {
        model.tryMove(12 as never, 28 as never);
      });
      expect(triggerHaptic).not.toHaveBeenCalled();
    } finally {
      model.dispose();
    }
  });

  it("respects per-cue pattern overrides", async () => {
    const model = await makeBoardModel(
      "rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 1",
    );
    try {
      render(
        <HapticsProbe
          model={model}
          options={{ patterns: { capture: "heavy" }, mobileOnly: false, intensity: 0.7 }}
        />,
      );
      act(() => {
        model.tryMove(27 as never, 36 as never); // d4 × e5
      });
      expect(triggerHaptic).toHaveBeenLastCalledWith("heavy", {
        enabled: true,
        intensity: 0.7,
        mobileOnly: false,
      });
    } finally {
      model.dispose();
    }
  });

  it("warms the haptic backend on the first user interaction", async () => {
    const model = await makeBoardModel();
    try {
      render(<HapticsProbe model={model} />);
      act(() => {
        window.dispatchEvent(new Event("pointerdown"));
      });
      expect(warmupHaptics).toHaveBeenCalledWith({ mobileOnly: true });
    } finally {
      model.dispose();
    }
  });
});
