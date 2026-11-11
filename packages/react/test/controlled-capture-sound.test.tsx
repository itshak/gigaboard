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

// Regression: these paths are exercised by BlindBase. Its GigaBoard is
// controlled and ALWAYS passes managedArrows (often []); isolated FEN-only
// rerender tests missed the locally committed pointer move.
function sq(name: string): never {
  return (name.charCodeAt(0) - 97 + (Number(name[1]) - 1) * 8) as never;
}

async function expectLocalConfirmedSound(
  before: string,
  from: string,
  to: string,
  cue: MoveSoundKey,
  arrows: "omitted" | "empty" | "populated",
  promotion?: number,
) {
  const game = await makeBoardModel(before);
  const cues: MoveSoundKey[] = [];
  const sound: MoveSoundOptions = {
    trigger: "position",
    cuePolicy: "san-priority",
    onCue: (key) => cues.push(key),
  };
  const managedArrows =
    arrows === "omitted"
      ? undefined
      : arrows === "empty"
        ? []
        : [{ from: sq("a1"), to: sq("a3"), color: "#ff0000" }];
  const initial = game.engine.fen();
  try {
    const board = render(
      <Chessboard game={game} positionFen={initial} managedArrows={managedArrows} sound={sound} />,
    );
    expect(cues).toEqual([]);
    const played = game.tryMove(sq(from), sq(to), promotion as never);
    expect(played).not.toBeNull();
    expect(cues).toEqual([]); // Before host confirmation, no speculative sound.
    const accepted = game.engine.fen();
    board.rerender(
      <Chessboard game={game} positionFen={accepted} managedArrows={managedArrows} sound={sound} />,
    );
    expect(cues).toEqual([cue]);

    // Re-rendering or changing managed arrows is not a second chess move.
    board.rerender(
      <Chessboard
        game={game}
        positionFen={accepted}
        managedArrows={[{ from: sq("a1"), to: sq("a4"), color: "#00ff00" }]}
        sound={sound}
      />,
    );
    expect(cues).toEqual([cue]);
    board.unmount();
  } finally {
    game.dispose();
  }
}

describe("controlled local-commit acknowledgment with managed arrows", () => {
  for (const arrows of ["omitted", "empty", "populated"] as const) {
    it(`emits one capture cue after local mouse-style confirmation with arrows: ${arrows}`, async () => {
      await expectLocalConfirmedSound(
        "4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1",
        "d4",
        "e5",
        "capture",
        arrows,
      );
    });

    it(`preserves quiet move cue and dedup with arrows: ${arrows}`, async () => {
      await expectLocalConfirmedSound(
        "4k3/8/8/8/3P4/8/8/4K3 w - - 0 1",
        "d4",
        "d5",
        "moveSelf",
        arrows,
      );
    });
  }

  it("preserves an en passant capture from the local model commit", async () => {
    await expectLocalConfirmedSound(
      "4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1",
      "e5",
      "d6",
      "capture",
      "empty",
    );
  });

  it("preserves capture over promotion for local a7xb8=Q", async () => {
    await expectLocalConfirmedSound(
      "1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1",
      "a7",
      "b8",
      "capture",
      "empty",
      4,
    );
  });

  it("never emits an accepted-move sound for a rejected local move", async () => {
    const before = "4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1";
    const game = await makeBoardModel(before);
    const cues: MoveSoundKey[] = [];
    const sound: MoveSoundOptions = {
      trigger: "position",
      cuePolicy: "san-priority",
      onCue: (cue) => cues.push(cue),
    };
    const original = game.engine.fen();
    try {
      const board = render(
        <Chessboard game={game} positionFen={original} managedArrows={[]} sound={sound} />,
      );
      expect(game.tryMove(sq("d4"), sq("e5"))).not.toBeNull();
      game.load(original); // Host rejects and rolls back (BlindBase contract).
      board.rerender(
        <Chessboard game={game} positionFen={original} managedArrows={[]} sound={sound} />,
      );
      expect(cues).toEqual([]);
      board.unmount();
    } finally {
      game.dispose();
    }
  });

  it("classifies controlled external captures with nonempty managed arrows", async () => {
    const before = "4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1";
    const after = "4k3/8/8/4P3/8/8/8/4K3 b - - 0 1";
    const game = await makeBoardModel(before);
    const cues: MoveSoundKey[] = [];
    const sound: MoveSoundOptions = {
      trigger: "position",
      cuePolicy: "san-priority",
      onCue: (cue) => cues.push(cue),
    };
    const arrows = [{ from: sq("a1"), to: sq("a4"), color: "#ff0000" }];
    try {
      const board = render(
        <Chessboard game={game} positionFen={before} managedArrows={arrows} sound={sound} />,
      );
      board.rerender(
        <Chessboard game={game} positionFen={after} managedArrows={arrows} sound={sound} />,
      );
      expect(cues).toEqual(["capture"]);
      board.unmount();
    } finally {
      game.dispose();
    }
  });
});
