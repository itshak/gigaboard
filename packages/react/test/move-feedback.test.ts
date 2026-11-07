import { describe, expect, it } from "vitest";
import { classifyMoveFeedback } from "../src/lib/move-feedback.js";

const snapshot = {
  turn: 1 as const,
  inCheck: true,
  isGameOver: false,
};

describe("move-sound cue ordering policies", () => {
  it("keeps default classification for other board users", () => {
    const checkCapture = classifyMoveFeedback([{ kind: "capture" }], snapshot, undefined);
    const endedCapture = classifyMoveFeedback(
      [{ kind: "capture" }],
      { ...snapshot, isGameOver: true },
      undefined,
    );
    expect(checkCapture).toBe("moveCheck");
    expect(endedCapture).toBe("gameEnd");
  });

  it("preserves SAN capture priority on capture-checkmate and promotions", () => {
    for (const kinds of [
      [{ kind: "capture" }],
      [{ kind: "capture" }, { kind: "promotion" }],
      [{ kind: "en-passant" }],
    ]) {
      const cue = classifyMoveFeedback(
        kinds,
        { ...snapshot, isGameOver: true },
        undefined,
        "san-priority",
      );
      expect(cue).toBe("capture");
    }
  });

  it("preserves castle, promotion and check cues on mate", () => {
    const castle = classifyMoveFeedback(
      [{ kind: "castle" }], snapshot, undefined, "san-priority",
    );
    const promote = classifyMoveFeedback(
      [{ kind: "promotion" }], snapshot, undefined, "san-priority",
    );
    const mate = classifyMoveFeedback(
      [], { ...snapshot, isGameOver: true }, undefined, "san-priority",
    );
    expect(castle).toBe("castle");
    expect(promote).toBe("promote");
    expect(mate).toBe("moveCheck");
  });

  it("does not mislabel stalemate as check or game-end cue", () => {
    const terminal = { ...snapshot, inCheck: false, isGameOver: true };
    const cue = classifyMoveFeedback([], terminal, undefined, "san-priority");
    expect(cue).toBe("moveSelf");
  });
});
