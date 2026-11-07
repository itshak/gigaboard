import { describe, expect, it } from "vitest";
import { classifyMoveFeedback } from "../src/lib/move-feedback.js";

const snapshot = {
  turn: 1 as const,
  inCheck: true,
  isGameOver: false,
};

describe("move-sound cue ordering policies", () => {
  it("keeps the existing default classification for all board users", () => {
    expect(classifyMoveFeedback([{ kind: "capture" }], snapshot, undefined))
      .toBe("moveCheck");
    expect(classifyMoveFeedback([{ kind: "capture" }], {
      ...snapshot, isGameOver: true,
    }, undefined)).toBe("gameEnd");
  });

  it("preserves BlindBase SAN capture priority, including capture-checkmate", () => {
    for (const kinds of [
      [{ kind: "capture" }],
      [{ kind: "capture" }, { kind: "promotion" }],
      [{ kind: "en-passant" }],
    ]) {
      expect(classifyMoveFeedback(kinds, {
        ...snapshot, isGameOver: true,
      }, undefined, "san-priority")).toBe("capture");
    }
  });

  it("preserves castle, promotion and check cues without duplicating endings", () => {
    expect(classifyMoveFeedback([{ kind: "castle" }], snapshot, undefined, "san-priority"))
      .toBe("castle");
    expect(classifyMoveFeedback([{ kind: "promotion" }], snapshot, undefined, "san-priority"))
      .toBe("promote");
    expect(classifyMoveFeedback([], {
      ...snapshot, isGameOver: true,
    }, undefined, "san-priority")).toBe("moveCheck");
  });

  it("does not mislabel stalemate as a check or force a game-end cue", () => {
    const terminal = { ...snapshot, inCheck: false, isGameOver: true };
    expect(classifyMoveFeedback([], terminal, undefined, "san-priority")).toBe("moveSelf");
  });
});
