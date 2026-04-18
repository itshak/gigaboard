"use client";

/**
 * `useSelectionController` — imperative selection + legal-target paint.
 *
 * ### Why this exists
 *
 * The prior `<SelectionLayer/>` React component rendered fresh DOM
 * nodes (one tint + N legal-target markers) every time `selected` or
 * `legalTargets` changed. That's cheap in isolation, but during the
 * drag-start frame — where the pointermove handler also calls
 * `game.selectSquare(from)` — it compounds with React reconciliation
 * and the browser's layout/paint for the new nodes. In real Chromium
 * under 4× CPU throttle, that frame was a 25 ms spike (vs chessground's
 * 9 ms).
 *
 * This controller replaces that entirely. It:
 *
 * 1. Subscribes to the model via `model.subscribe(...)` inside a
 *    `useEffect` — never calls `setState`, never triggers React.
 * 2. On each commit, computes the diff between
 *    `(prev.selected, prev.legalTargets)` and
 *    `(next.selected, next.legalTargets)`.
 * 3. Writes `el.dataset.ucrSelection = "selected" | "legal-quiet" |
 *    "legal-capture" | "none"` on only the squares whose state
 *    changed, using the 64-slot ref array from `<BoardGrid/>`.
 * 4. CSS (injected by `injectSelectionStyles` below) paints the
 *    overlay on each square via a `::before` pseudo-element.
 *
 * Result: selection changes cost one or two data-attribute writes per
 * affected square — pure browser-level work, no React, no new DOM,
 * no layout. Matches chessground's class-toggle strategy.
 */

import type { BoardModel, SquareIndex } from "@ultrachess/core";
import { type RefObject, useEffect } from "react";
import type { LegalTargetStyle } from "../types.js";

/**
 * Values written to `data-ucr-selection`.
 *
 * - `selected` — the from-square of a pending move.
 * - `legal-quiet` — a legal target with no capture.
 * - `legal-capture` — a legal target on an occupied square.
 * - `none` — no highlight.
 */
type SelectionState = "none" | "selected" | "legal-quiet" | "legal-capture";

/** Singleton id used to dedupe the injected `<style>` element. */
const STYLE_ID = "ucr-selection-styles";

/** Inject the selection CSS once per document. SSR-safe (early-returns). */
function injectSelectionStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
[data-ucr-square][data-ucr-selection="selected"]::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--ucr-selected);
  pointer-events: none;
}
[data-ucr-square][data-ucr-selection="legal-quiet"]::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(var(--ucr-legal-target) 22%, transparent 24%);
  pointer-events: none;
}
[data-ucr-square][data-ucr-selection="legal-capture"]::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(transparent 0 75%, var(--ucr-legal-target-capture) 77% 83%, transparent 85%);
  pointer-events: none;
}
[data-ucr-target-style="dots"] [data-ucr-square][data-ucr-selection="legal-quiet"]::before {
  background-image: radial-gradient(var(--ucr-legal-target) 14%, transparent 16%);
}
[data-ucr-target-style="dots"] [data-ucr-square][data-ucr-selection="legal-capture"]::before {
  background-image: radial-gradient(var(--ucr-legal-target-capture) 20%, transparent 22%);
}
`;
  document.head.appendChild(style);
}

/**
 * Imperatively paint selection + legal-target highlights.
 *
 * @param model The board model, or `null` while the engine is loading.
 * @param squareRefs 64-slot refs array. Each slot is the DOM node of
 *   the square at that LERF index, or `null` if unmounted.
 * @param style Rendering style for legal targets. `false` suppresses
 *   the overlay entirely; `"rings"` (default) and `"dots"` are picked
 *   up by the board container's `data-ucr-target-style` attribute.
 */
export function useSelectionController(
  model: BoardModel | null,
  squareRefs: RefObject<Array<HTMLElement | null>>,
  style: LegalTargetStyle,
): void {
  useEffect(() => {
    injectSelectionStyles();
  }, []);

  useEffect(() => {
    if (model === null) return;

    // Track what we painted last so we can diff-write only changes.
    let prevSelected: SquareIndex | null = null;
    let prevTargets: ReadonlySet<SquareIndex> = new Set();

    const write = (i: SquareIndex, val: SelectionState): void => {
      const el = squareRefs.current?.[i];
      if (el === null || el === undefined) return;
      if (val === "none") {
        delete el.dataset["ucrSelection"];
      } else {
        el.dataset["ucrSelection"] = val;
      }
    };

    const clear = (): void => {
      if (prevSelected !== null) write(prevSelected, "none");
      for (const sq of prevTargets) write(sq, "none");
      prevSelected = null;
      prevTargets = new Set();
    };

    const update = (): void => {
      const snap = model.getSnapshot();
      const { selected, legalTargets, board } = snap;

      // When the caller disables target rendering, keep the selected
      // tint but hide legal targets — same contract the old component
      // had with `style === false`.
      if (style === false) {
        // Clear any old targets.
        for (const sq of prevTargets) {
          if (sq !== selected) write(sq, "none");
        }
        // Adjust selected highlight.
        if (prevSelected !== null && prevSelected !== selected) {
          write(prevSelected, "none");
        }
        if (selected !== null) write(selected, "selected");
        prevSelected = selected;
        prevTargets = new Set();
        return;
      }

      // Identity-compare: the store guarantees stable `selected` and
      // `legalTargets` refs when nothing changed, so most commits land
      // here and return instantly.
      if (selected === prevSelected && legalTargets === prevTargets) return;

      // Clear squares that were previously highlighted but no longer are.
      if (prevSelected !== null && prevSelected !== selected && !legalTargets.has(prevSelected)) {
        write(prevSelected, "none");
      }
      for (const sq of prevTargets) {
        if (sq !== selected && !legalTargets.has(sq)) write(sq, "none");
      }

      // Paint current highlights.
      if (selected !== null) write(selected, "selected");
      for (const sq of legalTargets) {
        if (sq === selected) continue;
        const targetCell = board[sq] ?? 0;
        write(sq, targetCell === 0 ? "legal-quiet" : "legal-capture");
      }

      prevSelected = selected;
      prevTargets = legalTargets;
    };

    update();
    const unsubscribe = model.subscribe(update);
    return () => {
      unsubscribe();
      clear();
    };
  }, [model, squareRefs, style]);
}
