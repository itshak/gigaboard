"use client";

/**
 * `useLastMoveController` — imperative last-move tint paint.
 *
 * Mirror of `useSelectionController` for the from/to last-move
 * highlight. Previously rendered as `<LastMoveLayer/>`, a React
 * component that emitted two fresh `<div>` tints on every move
 * commit. Those two divs were real DOM + layout + paint work
 * inside the same commit as the move itself — which in Chromium
 * showed up as part of the "drop frame" peak during drag storms.
 *
 * The new controller:
 *
 * 1. Subscribes to the model via `model.subscribe` inside a
 *    `useEffect`. Never calls `setState`, never triggers React.
 * 2. On each commit, derives `(from, to)` from `s.lastMove` and
 *    diffs against the previously-painted pair.
 * 3. Writes `el.dataset.ucrLastMove = "from" | "to"` on only the
 *    changed squares — removing the attribute for squares that
 *    are no longer either endpoint of the last move.
 * 4. CSS (injected once per document by `injectLastMoveStyles`)
 *    paints a `::after` pseudo-element with the `--ucr-last-move`
 *    theme variable.
 *
 * Uses `::after` rather than `::before` because the selection
 * controller already owns `::before`. Paint order ends up
 * `background → selection tint (::before) → last-move tint
 * (::after)` — for the rare overlap where a square is both
 * selected AND one end of the last move, last-move paints on top.
 * That's a reversal of the old Chessboard JSX order, but the
 * visual difference between "selection on top of last-move" and
 * "last-move on top of selection" is imperceptible when both use
 * semi-transparent rgba tints.
 */

import type { BoardModel, SquareIndex } from "@ultrachess/core";
import { type RefObject, useEffect } from "react";

/** Values written to `data-ucr-last-move`. */
type LastMoveState = "from" | "to";

/** Singleton id used to dedupe the injected `<style>` element. */
const STYLE_ID = "ucr-last-move-styles";

/** Inject the last-move CSS once per document. SSR-safe (early-returns). */
function injectLastMoveStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
[data-ucr-square][data-ucr-last-move]::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--ucr-last-move);
  pointer-events: none;
}
`;
  document.head.appendChild(style);
}

/**
 * Imperatively paint the from/to tints of the most recent move.
 *
 * @param model The board model, or `null` while the engine is loading.
 * @param squareRefs 64-slot refs array from `<BoardGrid/>`. Each slot
 *   is the DOM node of the square at that LERF index, or `null` if
 *   unmounted.
 * @param enabled When `false`, the controller clears any existing
 *   last-move tint and does nothing further. Matches the contract of
 *   the old `highlightLastMove={false}` prop exactly.
 */
export function useLastMoveController(
  model: BoardModel | null,
  squareRefs: RefObject<Array<HTMLElement | null>>,
  enabled: boolean,
): void {
  useEffect(() => {
    injectLastMoveStyles();
  }, []);

  useEffect(() => {
    if (model === null) return;

    // Track what we painted last so we diff-write only changes.
    let prevFrom: SquareIndex | null = null;
    let prevTo: SquareIndex | null = null;

    const write = (i: SquareIndex, val: LastMoveState | null): void => {
      const el = squareRefs.current?.[i];
      if (el === null || el === undefined) return;
      if (val === null) {
        delete el.dataset["ucrLastMove"];
      } else {
        el.dataset["ucrLastMove"] = val;
      }
    };

    const clearAll = (): void => {
      if (prevFrom !== null) write(prevFrom, null);
      if (prevTo !== null) write(prevTo, null);
      prevFrom = null;
      prevTo = null;
    };

    if (!enabled) {
      // Nothing to subscribe to — just make sure no stale tint remains.
      return clearAll;
    }

    const update = (): void => {
      const snap = model.getSnapshot();
      const lastMove = snap.lastMove;

      let from: SquareIndex | null = null;
      let to: SquareIndex | null = null;
      if (lastMove !== null) {
        from = (lastMove & 0x3f) as SquareIndex;
        to = ((lastMove >> 6) & 0x3f) as SquareIndex;
      }

      // Early exit when nothing changed.
      if (from === prevFrom && to === prevTo) return;

      // Clear any previous endpoint that isn't also one of the new
      // endpoints. (Castling / promotion can keep one endpoint and
      // change the other, so we can't wipe unconditionally.)
      if (prevFrom !== null && prevFrom !== from && prevFrom !== to) {
        write(prevFrom, null);
      }
      if (prevTo !== null && prevTo !== from && prevTo !== to) {
        write(prevTo, null);
      }

      // Paint current. If one square is both `from` and `to` (shouldn't
      // happen in normal play, but defensive), `to` wins — it's the
      // landing square.
      if (from !== null && from !== to) write(from, "from");
      if (to !== null) write(to, "to");

      prevFrom = from;
      prevTo = to;
    };

    update();
    const unsubscribe = model.subscribe(update);
    return () => {
      unsubscribe();
      clearAll();
    };
  }, [model, squareRefs, enabled]);
}
