"use client";

import type { BoardModel } from "../core/index.js";
import { useCallback, useEffect, useRef } from "react";
import {
  type HapticFeedbackOptions,
  type HapticInput,
  triggerHaptic,
  warmupHaptics,
} from "../lib/haptics.js";
import {
  classifyMoveFeedback,
  DEFAULT_MOVE_HAPTIC_PATTERNS,
  type MoveFeedbackKey,
} from "../lib/move-feedback.js";

export type MoveHapticKey = MoveFeedbackKey;
export type MoveHapticPatterns = Partial<Readonly<Record<MoveHapticKey, HapticInput>>>;
export type TriggerMoveHaptic = (key: MoveHapticKey) => void;

export interface MoveHapticOptions {
  /** Master switch. Default `true`. */
  readonly enabled?: boolean;
  /** Per-key haptic overrides. Missing keys fall back to the built-in pattern map. */
  readonly patterns?: MoveHapticPatterns;
  /**
   * Viewer perspective. When set, moves played by this colour use `moveSelf`
   * and moves played by the opponent use `moveOpponent`.
   */
  readonly perspective?: 0 | 1;
  /** Restrict haptics to coarse-pointer/mobile-like devices. Default `true`. */
  readonly mobileOnly?: boolean;
  /** Minimum gap between emitted haptic events. Default `14ms`. */
  readonly minIntervalMs?: number;
  /** Warm the haptic backend on the first user gesture. Default `true`. */
  readonly warmupOnFirstInteraction?: boolean;
  /** Forwarded to `web-haptics` trigger intensity. */
  readonly intensity?: HapticFeedbackOptions["intensity"];
}

const DEFAULT_MIN_INTERVAL_MS = 14;

export function triggerMoveHaptic(
  key: MoveHapticKey,
  {
    enabled = true,
    patterns,
    mobileOnly = true,
    intensity,
  }: Pick<MoveHapticOptions, "enabled" | "patterns" | "mobileOnly" | "intensity"> = {},
): void {
  if (!enabled) {
    return;
  }
  const input = patterns?.[key] ?? DEFAULT_MOVE_HAPTIC_PATTERNS[key];
  triggerHaptic(input, {
    enabled,
    mobileOnly,
    ...(intensity !== undefined ? { intensity } : {}),
  });
}

export function useMoveHaptics(
  model: BoardModel | null,
  options: MoveHapticOptions = {},
): TriggerMoveHaptic {
  const {
    enabled = true,
    patterns,
    perspective,
    mobileOnly = true,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
    warmupOnFirstInteraction = true,
    intensity,
  } = options;

  const patternsRef = useRef(patterns);
  useEffect(() => {
    patternsRef.current = patterns;
  });

  const perspectiveRef = useRef(perspective);
  useEffect(() => {
    perspectiveRef.current = perspective;
  });

  const mobileOnlyRef = useRef(mobileOnly);
  useEffect(() => {
    mobileOnlyRef.current = mobileOnly;
  });

  const intensityRef = useRef(intensity);
  useEffect(() => {
    intensityRef.current = intensity;
  });

  const lastTriggerAtRef = useRef(0);

  const trigger = useCallback<TriggerMoveHaptic>(
    (key) => {
      triggerMoveHaptic(key, {
        enabled,
        ...(patternsRef.current !== undefined ? { patterns: patternsRef.current } : {}),
        mobileOnly: mobileOnlyRef.current,
        ...(intensityRef.current !== undefined ? { intensity: intensityRef.current } : {}),
      });
    },
    [enabled],
  );

  useEffect(() => {
    if (!enabled || !warmupOnFirstInteraction) {
      return;
    }

    let warmed = false;
    const warmup = () => {
      if (warmed) {
        return;
      }
      warmed = true;
      warmupHaptics({ mobileOnly: mobileOnlyRef.current });
      window.removeEventListener("pointerdown", warmup, true);
      window.removeEventListener("touchstart", warmup, true);
      window.removeEventListener("keydown", warmup, true);
    };

    window.addEventListener("pointerdown", warmup, { capture: true, passive: true });
    window.addEventListener("touchstart", warmup, { capture: true, passive: true });
    window.addEventListener("keydown", warmup, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", warmup, true);
      window.removeEventListener("touchstart", warmup, true);
      window.removeEventListener("keydown", warmup, true);
    };
  }, [enabled, warmupOnFirstInteraction]);

  useEffect(() => {
    if (!enabled || model === null) return;

    let prevPly = model.getSnapshot().historyPly;

    return model.subscribe(() => {
      const snap = model.getSnapshot();
      if (snap.historyPly <= prevPly) {
        prevPly = snap.historyPly;
        return;
      }
      prevPly = snap.historyPly;

      const nowMs = performance.now();
      if (nowMs - lastTriggerAtRef.current < minIntervalMs) {
        return;
      }
      lastTriggerAtRef.current = nowMs;

      const key = classifyMoveFeedback(model.lastAnimations, snap, perspectiveRef.current);
      trigger(key);
    });
  }, [enabled, minIntervalMs, model, trigger]);

  return trigger;
}
