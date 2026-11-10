import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Chessboard } from "../src/chessboard.js";
import type { MoveSoundKey, MoveSoundOptions } from "../src/hooks/use-move-sound.js";
import type { PositionTransition } from "../src/types.js";
import { makeBoardModel } from "./helpers.js";

async function expectConfirmedSound(
  before: string,
  after: string,
  key: MoveSoundKey,
  positionTransition?: PositionTransition,
) {
  const game = await makeBoardModel(before);
  const cues: MoveSoundKey[] = [];
  const sound: MoveSoundOptions = {
    trigger: "position",
    cuePolicy: "san-priority",
    onCue: (cue) => cues.push(cue),
  };
  try {
    const view = render(<Chessboard game={game} positionFen={before} sound={sound} />);
    expect(cues).toEqual([]); // Initial hydration must be silent.
    view.rerender(
      <Chessboard
        game={game}
        positionFen={after}
        positionTransition={positionTransition}
        sound={sound}
      />,
    );
    expect(cues).toEqual([key]); // Exactly one host-owned cue.
    view.unmount();
  } finally {
    game.dispose();
  }
}

describe("host-owned controlled-position sound feedback", () => {
  it("emits capture for a confirmed FEN-only capture", async () => {
    await expectConfirmedSound(
      "4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1",
      "4k3/8/8/4P3/8/8/8/4K3 b - - 0 1",
      "capture",
    );
  });

  it("emits capture for a FEN-only en passant", async () => {
    await expectConfirmedSound(
      "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
      "4k3/8/3P4/8/8/8/8/4K3 b - - 0 1",
      "capture",
    );
  });

  it("emits capture for a FEN-only promotion capture even if it checks the king", async () => {
    await expectConfirmedSound(
      "1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1",
      "1Q2k3/8/8/8/8/8/8/4K3 b - - 0 1",
      "capture",
    );
  });

  it("prioritizes capture over promotion when a UCI transition is provided", async () => {
    await expectConfirmedSound(
      "1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1",
      "1Q2k3/8/8/8/8/8/8/4K3 b - - 0 1",
      "capture",
      { uci: "a7b8q", direction: "forward" },
    );
  });

  it("still produces a distinct ordinary move cue", async () => {
    await expectConfirmedSound(
      "4k3/8/8/8/3P4/8/8/4K3 w - - 0 1",
      "4k3/8/8/3P4/8/8/8/4K3 b - - 0 1",
      "moveSelf",
    );
  });
});
