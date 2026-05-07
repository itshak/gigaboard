"use client";

import type { HapticInput } from "web-haptics";

/** The shared move-feedback cue categories. */
export type MoveFeedbackKey =
  | "moveSelf"
  | "moveOpponent"
  | "capture"
  | "castle"
  | "moveCheck"
  | "promote"
  | "gameEnd";

/** Default haptic pattern per move-feedback cue. */
export const DEFAULT_MOVE_HAPTIC_PATTERNS: Readonly<Record<MoveFeedbackKey, HapticInput>> =
  Object.freeze({
    moveSelf: "selection",
    moveOpponent: "selection",
    capture: "medium",
    castle: "medium",
    moveCheck: "success",
    promote: "success",
    gameEnd: "success",
  });

/**
 * Classify the feedback cue that should fire for the given committed move.
 *
 * Priority (highest wins):
 *   1. `gameEnd` if the engine reports `isGameOver`.
 *   2. `promote` / `castle` because structural moves get their own cue.
 *   3. `moveCheck` if the side-to-move is now in check.
 *   4. `capture` if any descriptor is a capture.
 *   5. `moveSelf` / `moveOpponent` otherwise.
 */
export function classifyMoveFeedback(
  animations: ReadonlyArray<{ readonly kind: string }>,
  snapshot: { readonly isGameOver: boolean; readonly inCheck: boolean; readonly turn: 0 | 1 },
  perspective: 0 | 1 | undefined,
): MoveFeedbackKey {
  if (snapshot.isGameOver) return "gameEnd";

  let sawPromotion = false;
  let sawCastle = false;
  let sawCapture = false;
  for (const d of animations) {
    if (d.kind === "promotion") sawPromotion = true;
    else if (d.kind === "castle") sawCastle = true;
    else if (d.kind === "capture" || d.kind === "en-passant") sawCapture = true;
  }

  if (sawPromotion) return "promote";
  if (sawCastle) return "castle";
  if (snapshot.inCheck) return "moveCheck";
  if (sawCapture) return "capture";

  // The side that just moved is the opposite of the new side-to-move.
  if (perspective !== undefined) {
    const moverWasMe = snapshot.turn !== perspective;
    return moverWasMe ? "moveSelf" : "moveOpponent";
  }
  return "moveSelf";
}
