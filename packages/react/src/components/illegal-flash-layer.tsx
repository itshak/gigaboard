"use client";

/**
 * One-shot red flash on an origin square to announce a rejected move.
 *
 * Driven by a `flashAt` prop owned by `Chessboard`. When the prop changes
 * from `null` to a `SquareIndex`, a WAAPI animation fades a red tint in
 * and out once; the parent's timer nulls the prop afterwards.
 *
 * Honours `prefers-reduced-motion`: the flash renders briefly but the
 * opacity timeline collapses to zero so motion-sensitive users don't see
 * a pulse.
 */

import type { SquareIndex } from "@ultrachess/core";
import { useLayoutEffect, useRef } from "react";
import { DEFAULT_ILLEGAL_FLASH_TINT } from "../default-theme.js";
import type { Orientation } from "../types.js";

/** CSS-percentage position of the square inside the board. */
function positionOf(
  index: SquareIndex,
  orientation: Orientation,
): {
  x: number;
  y: number;
} {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { x: col * 12.5, y: row * 12.5 };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Flash duration, in ms. Kept short so it doesn't interfere with UX. */
const FLASH_DURATION_MS = 280;

/** Props for {@link IllegalFlashLayer}. */
export interface IllegalFlashLayerProps {
  readonly at: SquareIndex | null;
  readonly orientation: Orientation;
}

/**
 * Renders `null` when `at` is `null`. When `at` is a `SquareIndex`,
 * renders a tinted div and kicks off a one-shot opacity animation via
 * WAAPI. No setState / re-render during the fade.
 */
export function IllegalFlashLayer({ at, orientation }: IllegalFlashLayerProps) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (at === null) return;
    const el = elRef.current;
    if (el === null || typeof el.animate !== "function") return;
    const duration = prefersReducedMotion() ? 0 : FLASH_DURATION_MS;
    el.animate(
      [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: 0.15 },
        { opacity: 0, offset: 1 },
      ],
      { duration, easing: "ease-out", fill: "forwards" },
    );
  }, [at]);

  if (at === null) return null;
  const { x, y } = positionOf(at, orientation);
  return (
    <div
      ref={elRef}
      data-layer="illegal-flash"
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: "12.5%",
        height: "12.5%",
        background: DEFAULT_ILLEGAL_FLASH_TINT,
        opacity: 0,
        pointerEvents: "none",
        zIndex: 5,
      }}
    />
  );
}
