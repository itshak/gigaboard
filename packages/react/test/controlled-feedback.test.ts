import { describe, expect, it } from "vitest";
import { parseFenPlacement } from "../src/fen.js";
import { inferControlledFeedbackDescriptors } from "../src/lib/controlled-feedback.js";

function infer(before: string, after: string) {
  return inferControlledFeedbackDescriptors(parseFenPlacement(before), parseFenPlacement(after));
}

describe("controlled FEN sound classification without positionTransition", () => {
  it("identifies an ordinary capture instead of an ordinary move", () => {
    expect(infer(
      "4k3/8/8/4p3/3P4/8/8/4K3",
      "4k3/8/8/4P3/8/8/8/4K3",
    )).toEqual([{ kind: "capture" }]);
  });

  it("distinguishes a quiet pawn move", () => {
    expect(infer(
      "4k3/8/8/8/3P4/8/8/4K3",
      "4k3/8/8/3P4/8/8/8/4K3",
    )).toEqual([{ kind: "move" }]);
  });

  it("identifies en passant, whose capture square differs from its landing square", () => {
    expect(infer(
      "4k3/8/8/3pP3/8/8/8/4K3",
      "4k3/8/3P4/8/8/8/8/4K3",
    )).toEqual([{ kind: "en-passant" }]);
  });

  it("classifies a capture-promotion as a capture, preserving SAN-priority", () => {
    expect(infer(
      "1r2k3/P7/8/8/8/8/8/4K3",
      "1Q2k3/8/8/8/8/8/8/4K3",
    )).toEqual([{ kind: "capture" }]);
  });

  it("classifies a quiet promotion separately", () => {
    expect(infer(
      "4k3/P7/8/8/8/8/8/4K3",
      "Q3k3/8/8/8/8/8/8/4K3",
    )).toEqual([{ kind: "promotion" }]);
  });

  it("preserves the castling sound for a two-piece position sync", () => {
    expect(infer(
      "4k3/8/8/8/8/8/8/4K2R",
      "4k3/8/8/8/8/8/8/5RK1",
    )).toEqual([{ kind: "castle" }]);
  });

  it("rejects ambiguous multi-ply board replacements", () => {
    expect(infer(
      "4k3/8/8/4p3/3P4/8/8/4K3",
      "4k3/8/8/4P3/8/8/8/3K4",
    )).toBeNull();
  });

  it("does not reinterpret a rewind of a capture as a new capture", () => {
    expect(infer(
      "4k3/8/8/4P3/8/8/8/4K3",
      "4k3/8/8/4p3/3P4/8/8/4K3",
    )).toBeNull();
  });

  it("does not infer a sound from identical boards", () => {
    expect(infer(
      "4k3/8/8/8/8/8/8/4K3",
      "4k3/8/8/8/8/8/8/4K3",
    )).toBeNull();
  });
});
