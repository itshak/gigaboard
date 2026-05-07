"use client";

import type { HapticInput, TriggerOptions, WebHaptics } from "web-haptics";

export type { HapticInput, TriggerOptions };

const COARSE_POINTER_QUERY = "(hover: none), (pointer: coarse)";

let cached: WebHaptics | null | undefined;
let pending: Promise<WebHaptics | null> | null = null;

function isCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(COARSE_POINTER_QUERY).matches;
}

function shouldRunHaptics(options: {
  readonly enabled?: boolean;
  readonly mobileOnly?: boolean;
}): boolean {
  if (options.enabled === false) return false;
  if (options.mobileOnly === false) return true;
  return isCoarsePointer();
}

async function getInstance(): Promise<WebHaptics | null> {
  if (cached !== undefined) {
    return cached;
  }
  if (pending !== null) {
    return pending;
  }
  if (typeof window === "undefined") {
    cached = null;
    return cached;
  }

  pending = import("web-haptics")
    .then(({ WebHaptics }) => {
      try {
        cached = new WebHaptics();
      } catch {
        cached = null;
      }
      return cached;
    })
    .catch(() => {
      cached = null;
      return cached;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

export interface HapticFeedbackOptions extends TriggerOptions {
  /** Master switch. Default `true`. */
  readonly enabled?: boolean;
  /** Restrict haptics to coarse-pointer/mobile-like devices. Default `true`. */
  readonly mobileOnly?: boolean;
}

export function triggerHaptic(input?: HapticInput, options: HapticFeedbackOptions = {}): void {
  if (!shouldRunHaptics(options)) {
    return;
  }
  const { enabled: _enabled, mobileOnly: _mobileOnly, ...triggerOptions } = options;
  void getInstance().then((instance) => {
    void instance?.trigger(input, triggerOptions);
  });
}

export function warmupHaptics(options: HapticFeedbackOptions = {}): void {
  if (!shouldRunHaptics(options)) {
    return;
  }
  void getInstance();
}
