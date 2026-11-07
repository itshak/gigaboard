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
 * Default priority: gameEnd, promote/castle, check, capture, normal move.
 * When `cuePolicy` is `"san-priority"`, use BlindBase's historical SAN
 * sound precedence: capture (even capture+promotion or capture+check),
 * castle, promotion, check/mate, normal move. A stalemate is a normal move,
 * not a misleading "check" / game-end cue.
 */
export function classifyMoveFeedback(
  animations: ReadonlyArray<{ readonly kind: string }>,
  snapshot: { readonly isGameOver: boolean; readonly inCheck: boolean; readonly turn: 0 | 1 },
  perspective: 0 | 1 | undefined,
  cuePolicy: "default" | "san-priority" = "default",
): MoveFeedbackKey {
  if (cuePolicy === "default" && snapshot.isGameOver) return "gameEnd";

  let sawPromotion = false;
  let sawCastle = false;
  let sawCapture = false;
  for (const d of animations) {
    if (d.kind === "promotion") sawPromotion = true;
    else if (d.kind === "castle") sawCastle = true;
    else if (d.kind === "capture" || d.kind === "en-passant") sawCapture = true;
  }

  if (cuePolicy === "san-priority" && sawCapture) return "capture";
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
