import { cleanup, render } from "@testing-library/react";
import { makeArrow, type SquareIndex } from "@ultrachess/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Chessboard } from "../src/chessboard.js";
import { makeBoardModel, renderBoard } from "./helpers.js";

const hapticMocks = vi.hoisted(() => ({
  triggerHaptic: vi.fn(),
  warmupHaptics: vi.fn(),
}));

vi.mock("../src/lib/haptics.js", () => ({
  triggerHaptic: hapticMocks.triggerHaptic,
  warmupHaptics: hapticMocks.warmupHaptics,
}));

const E2 = 12 as SquareIndex;
const E4 = 28 as SquareIndex;
const E7 = 52 as SquareIndex;
const E5 = 36 as SquareIndex;
const AFTER_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

class AudioStub {
  static instances: AudioStub[] = [];
  static plays: string[] = [];

  volume = 1;
  currentTime = 0;
  preload = "";

  constructor(readonly src: string) {
    AudioStub.instances.push(this);
  }

  play(): Promise<void> {
    AudioStub.plays.push(this.src);
    return Promise.resolve();
  }

  static reset(): void {
    AudioStub.instances = [];
    AudioStub.plays = [];
  }
}

describe("controlled analysis board", () => {
  beforeEach(() => {
    AudioStub.reset();
    hapticMocks.triggerHaptic.mockClear();
    hapticMocks.warmupHaptics.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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

  it("emits move feedback for controlled position changes after the initial sync", async () => {
    const model = await makeBoardModel();
    vi.stubGlobal("Audio", AudioStub);

    try {
      const { rerender } = render(
        <Chessboard
          game={model}
          haptics={{ enabled: true, mobileOnly: false }}
          positionFen={model.engine.fen()}
          sound
        />,
      );

      expect(AudioStub.instances).toHaveLength(0);
      expect(hapticMocks.triggerHaptic).not.toHaveBeenCalled();

      rerender(
        <Chessboard
          game={model}
          haptics={{ enabled: true, mobileOnly: false }}
          positionFen={AFTER_E4_FEN}
          positionTransition={{ uci: "e2e4", direction: "forward", key: "0:1:e2e4" }}
          sound
        />,
      );

      // 7 keys x 4 pool size, allocated lazily on the first controlled cue.
      expect(AudioStub.instances).toHaveLength(28);
      expect(AudioStub.plays).toHaveLength(1);
      expect(hapticMocks.triggerHaptic).toHaveBeenLastCalledWith("selection", {
        enabled: true,
        intensity: undefined,
        mobileOnly: false,
      });
    } finally {
      model.dispose();
    }
  });
});
