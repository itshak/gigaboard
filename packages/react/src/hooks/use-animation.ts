"use client";

/**
 * WAAPI-driven FLIP animations for piece glides.
 *
 * ### Strategy
 *
 * After every model commit we know, via `model.lastAnimations`, what
 * visually changed: a set of {@link AnimDescriptor}s describing `move`,
 * `capture`, `en-passant`, `castle`, `promotion`, `appear`, or `disappear`.
 *
 * For each descriptor that has a source and a destination, we:
 *
 * 1. Compute the pixel displacement between the `from` and `to` squares.
 * 2. Locate the destination `PieceSlot` DOM node (by `data-piece-square`).
 * 3. Cancel any in-flight animation on that node.
 * 4. Kick off a WAAPI animation whose first keyframe translates it back
 *    to the source and whose last keyframe returns to identity.
 *
 * The animation runs entirely on the compositor — React never re-renders
 * during the glide.
 *
 * ### FLIP invariants
 *
 * - Run inside `useLayoutEffect` so the transform is applied **before**
 *   the browser paints, preventing a one-frame flash at the destination.
 * - Skip animation when `prefers-reduced-motion: reduce` is set, or when
 *   the caller's duration is zero.
 * - Fall back silently if the destination DOM node is missing (e.g. the
 *   piece-layer was reparented mid-animation) — never throw.
 */

import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";
import type { AnimDescriptor, BoardModel, SquareIndex } from "../core/index.js";
import type { AnimationOptions, Orientation } from "../types.js";
import { useBoardSlice } from "./use-board-subscription.js";

const DEFAULT_DURATION_MS = 60;
const DEFAULT_EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";

/** Algebraic name `"e2"` from a square index. */
function algebraicOf(index: SquareIndex): string {
  const file = index & 7;
  const rank = index >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

/**
 * Compute the pixel delta from `to` back to `from` in board coordinates.
 * In an orientation-flipped board, the sign of both axes flips together so
 * the helper just needs to know the square size and the two raw indices.
 */
function deltaFromTo(
  from: SquareIndex,
  to: SquareIndex,
  squareSize: number,
  orientation: Orientation,
): { dx: number; dy: number } {
  const fromFile = from & 7;
  const fromRank = from >> 3;
  const toFile = to & 7;
  const toRank = to >> 3;
  const fromCol = orientation === "white" ? fromFile : 7 - fromFile;
  const fromRow = orientation === "white" ? 7 - fromRank : fromRank;
  const toCol = orientation === "white" ? toFile : 7 - toFile;
  const toRow = orientation === "white" ? 7 - toRank : toRank;
  return {
    dx: (fromCol - toCol) * squareSize,
    dy: (fromRow - toRow) * squareSize,
  };
}

/** Cancel any running WAAPI animation on `element`. */
function cancelAnimations(element: Element): void {
  // `getAnimations` is standard but may be absent in reduced test envs.
  if (typeof element.getAnimations !== "function") return;
  for (const anim of element.getAnimations()) anim.cancel();
}

/**
 * Read `prefers-reduced-motion: reduce`. Returns `false` in non-browser
 * environments (e.g. during SSR).
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Animate one piece glide from the source square back to identity at the
 * destination. `element` is the destination `PieceSlot` wrapper — the same
 * one the `PieceLayer` renders.
 */
function animateGlide(
  element: HTMLElement,
  dx: number,
  dy: number,
  duration: number,
  easing: string,
): void {
  cancelAnimations(element);
  if (duration <= 0 || typeof element.animate !== "function") return;
  element.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
    { duration, easing, fill: "none" },
  );
}

/** Runtime hooks exposed to {@link useAnimation}'s caller. */
export interface UseAnimationRuntime {
  /**
   * Ref to a boolean flag. If `true` at commit time the next animation is
   * skipped and the flag is reset to `false` automatically. Used by the
   * drag handler to suppress the FLIP glide — for a drag-initiated move,
   * the user has already placed the piece at the target, so animating
   * from source → target reverses their action and looks jarring.
   */
  readonly skipNextRef?: RefObject<boolean>;
}

/**
 * Subscribe to the model's commit stream and play a WAAPI animation for
 * every descriptor in `model.lastAnimations`.
 *
 * @param model The board model (or `null` during async init).
 * @param containerRef Ref to the outer board container — used for pixel
 *   geometry.
 * @param orientation Current board orientation.
 * @param options Duration / easing overrides.
 * @param runtime Optional runtime hooks (e.g. a `skipNextRef` to bypass
 *   the animation on the next commit).
 */
/**
 * Drive FLIP animations off a cheap scalar slice subscription.
 *
 * Previously this hook ran a `setState` inside `<Chessboard/>` on every
 * model commit to make its `useLayoutEffect` re-fire. That worked, but it
 * forced `<Chessboard/>` (and the entire layer tree below it) to re-run
 * its function body every single move — the per-byte subscriptions saved
 * `<Square/>` / `<PieceSlot/>` from re-rendering, but the 11 layer
 * wrappers above them paid full price. See the M7 render-budget diagnosis
 * in BENCH.md's "What's not measured yet" section.
 *
 * The fix: expose `<AnimationRunner/>` as a sibling component that
 * subscribes to `historyPly` via `useBoardSlice`. When a move lands,
 * only `<AnimationRunner/>` re-renders (it produces `null`), its layout
 * effect fires, and it reads `model.lastAnimations` to run the WAAPI
 * glides. `<Chessboard/>` never re-renders on a move.
 */
function runAnimations(
  descriptors: readonly AnimDescriptor[],
  container: HTMLElement,
  orientation: Orientation,
  duration: number,
  easing: string,
): void {
  const rect = container.getBoundingClientRect();
  const sqSize = rect.width / 8;
  if (sqSize <= 0) return;

  for (const d of descriptors) {
    switch (d.kind) {
      case "move":
      case "capture":
      case "en-passant":
      case "promotion": {
        const toEl = container.querySelector<HTMLElement>(
          `[data-piece-square="${algebraicOf(d.to)}"]`,
        );
        if (toEl === null) break;
        const { dx, dy } = deltaFromTo(d.from, d.to, sqSize, orientation);
        animateGlide(toEl, dx, dy, duration, easing);
        break;
      }
      case "castle": {
        const kingEl = container.querySelector<HTMLElement>(
          `[data-piece-square="${algebraicOf(d.kingTo)}"]`,
        );
        const rookEl = container.querySelector<HTMLElement>(
          `[data-piece-square="${algebraicOf(d.rookTo)}"]`,
        );
        if (kingEl !== null) {
          const { dx, dy } = deltaFromTo(d.kingFrom, d.kingTo, sqSize, orientation);
          animateGlide(kingEl, dx, dy, duration, easing);
        }
        if (rookEl !== null) {
          const { dx, dy } = deltaFromTo(d.rookFrom, d.rookTo, sqSize, orientation);
          animateGlide(rookEl, dx, dy, duration, easing);
        }
        break;
      }
      // `appear` / `disappear` deliberately not animated — they cover
      // edge cases like `load(fen)` where no "glide" is meaningful.
      case "appear":
      case "disappear":
        break;
    }
  }
}

/** Props for {@link AnimationRunner}. */
export interface AnimationRunnerProps {
  readonly model: BoardModel;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly orientation: Orientation;
  readonly options?: AnimationOptions;
  readonly runtime?: UseAnimationRuntime;
}

/**
 * Sibling component that owns the animation subscription. Renders `null`;
 * its only job is to translate a scalar slice change (`historyPly`) into
 * a `useLayoutEffect` firing with the descriptors from the just-committed
 * move. Because the subscription lives here — not in `<Chessboard/>` —
 * the root board component no longer re-renders once per move.
 */
export function AnimationRunner({
  model,
  containerRef,
  orientation,
  options,
  runtime,
}: AnimationRunnerProps): ReactNode {
  const duration = options?.durationMs ?? DEFAULT_DURATION_MS;
  const easing = options?.easing ?? DEFAULT_EASING;
  const skipNextRef = runtime?.skipNextRef;

  // `historyPly` advances exactly once per committed move (including
  // undo / redo / goto). Subscribing to this single number — via React's
  // default `Object.is` bailout — wakes us exactly when we need to run
  // the post-commit glide. We include `historyPly` in the layout-effect
  // deps below so the effect re-fires on every move; without it, the
  // effect would run once on mount and sit there forever.
  const historyPly = useBoardSlice(model, (s) => s.historyPly);
  const lastAnimatedPlyRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (lastAnimatedPlyRef.current === historyPly) return;
    lastAnimatedPlyRef.current = historyPly;
    const container = containerRef.current;
    if (container === null) return;
    const descriptors = model.lastAnimations;
    if (descriptors.length === 0) return;

    // Drag-initiated commits: consume the skip flag and bail out. The
    // user has already placed the piece at the target; replaying a glide
    // from the source looks like the move is being undone and redone.
    if (skipNextRef?.current) {
      skipNextRef.current = false;
      return;
    }

    const effectiveDuration = prefersReducedMotion() ? 0 : duration;
    if (effectiveDuration <= 0) return;

    runAnimations(descriptors, container, orientation, effectiveDuration, easing);
  }, [historyPly, model, containerRef, orientation, duration, easing, skipNextRef]);

  return null;
}
