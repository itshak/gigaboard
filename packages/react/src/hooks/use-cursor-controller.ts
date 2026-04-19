"use client";

/**
 * `useCursorController` — imperative cursor paint for grabbable pieces.
 *
 * ### Why this exists
 *
 * The board's pointer cursor is a signal: hover a piece you can pick up,
 * see `grab`; drag it, see `grabbing`; hover an empty square or a piece
 * that isn't yours to move, see the normal `pointer`. That's how every
 * native chess UI (lichess / chess.com / chessground) behaves, and it's
 * the single most noticeable "polish" cue the library was missing.
 *
 * We can't scope this to the `<PieceLayer/>` DOM — pieces live on an
 * overlay with `pointer-events: none`, so the effective cursor is the
 * one set on the Square underneath. Instead we mirror the pattern used
 * by {@link useSelectionController}: subscribe to the model, diff the
 * set of grabbable squares across each commit, and write a data-attribute
 * on only the affected squares. A singleton `<style>` rule paints the
 * cursor from the attribute — no React reconciliation per hover / move.
 *
 * ### Grabbable predicate
 *
 * A square is "grabbable" iff it currently holds a piece that the user
 * could plausibly start dragging:
 *
 * - `allowDrag === true` — otherwise no drag initiates and the cursor
 *   should stay `pointer` (click-to-move is still available).
 * - The piece's colour matches the side to move, **or**
 *   `allowPremove === true` and it belongs to the other colour (the
 *   user is queueing a premove during the opponent's turn).
 *
 * The "own piece" rule is the common case; premove pieces are a deliberate
 * extension so the cursor stays accurate when the user is about to queue
 * up moves on their own pieces while it's the opponent's turn.
 *
 * ### Dragging cursor
 *
 * `data-ucr-dragging="true"` on the board container flips every square
 * to `cursor: grabbing` while a drag is in flight. The attribute is
 * toggled by the chessboard component from `useDrag`'s `onDragStart` /
 * `onDragEnd` callbacks — both called exactly once per drag.
 */

import { type BoardModel, colorOf, type SquareIndex } from "@ultrachess/core";
import { type RefObject, useEffect } from "react";

/** Singleton id used to dedupe the injected `<style>` element. */
const STYLE_ID = "ucr-cursor-styles";

/**
 * Inject the cursor CSS once per document. SSR-safe (early-returns).
 *
 * Three rules in precedence order:
 *   1. Every square defaults to `pointer` (overrides the previous inline
 *      style on `<Square/>`, which has been removed).
 *   2. A square with `data-ucr-grabbable="true"` shows `grab`.
 *   3. While any descendant square is under an active drag — signalled
 *      by `data-ucr-dragging="true"` on the board container — every
 *      square is `grabbing`. This wins over the per-square rule because
 *      it's scoped more specifically (container + descendant selector).
 */
function injectCursorStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
[data-ucr-square] {
  cursor: pointer;
}
[data-ucr-square][data-ucr-grabbable="true"] {
  cursor: grab;
}
[data-ucr-dragging="true"] [data-ucr-square] {
  cursor: grabbing;
}
`;
  document.head.appendChild(style);
}

/**
 * Imperatively paint `data-ucr-grabbable="true"` on every square that
 * currently holds a grabbable piece. Mirrors the diff pattern used by
 * {@link useSelectionController}: one attribute write per changed square
 * per commit, no React state, no reconciliation.
 *
 * @param model The board model, or `null` while the engine is loading.
 * @param squareRefs 64-slot refs array (one DOM node per square index).
 * @param allowDrag When `false`, no square is grabbable — the board stays
 *   on `pointer` regardless of what's on it.
 * @param allowPremove When `true`, pieces of the colour that's **not**
 *   to move are also grabbable (the user is queueing a premove).
 */
export function useCursorController(
  model: BoardModel | null,
  squareRefs: RefObject<Array<HTMLElement | null>>,
  allowDrag: boolean,
  allowPremove: boolean,
): void {
  useEffect(() => {
    injectCursorStyles();
  }, []);

  useEffect(() => {
    if (model === null) return;

    // Track which squares we painted as grabbable so we can diff-write.
    let prev = new Set<SquareIndex>();

    const write = (sq: SquareIndex, grabbable: boolean): void => {
      const el = squareRefs.current?.[sq];
      if (el === null || el === undefined) return;
      if (grabbable) {
        el.dataset["ucrGrabbable"] = "true";
      } else {
        delete el.dataset["ucrGrabbable"];
      }
    };

    const clear = (): void => {
      for (const sq of prev) write(sq, false);
      prev = new Set();
    };

    const compute = (): Set<SquareIndex> => {
      const next = new Set<SquareIndex>();
      if (!allowDrag) return next;
      const snap = model.getSnapshot();
      const { board, turn } = snap;
      for (let i = 0; i < 64; i++) {
        const cell = board[i] ?? 0;
        if (cell === 0) continue;
        const cellColor = colorOf(cell as Parameters<typeof colorOf>[0]);
        const isOwn = cellColor === turn;
        if (isOwn || allowPremove) next.add(i as SquareIndex);
      }
      return next;
    };

    const update = (): void => {
      const next = compute();
      // Clear squares that were grabbable but no longer are.
      for (const sq of prev) {
        if (!next.has(sq)) write(sq, false);
      }
      // Paint newly-grabbable squares.
      for (const sq of next) {
        if (!prev.has(sq)) write(sq, true);
      }
      prev = next;
    };

    update();
    const unsubscribe = model.subscribe(update);
    return () => {
      unsubscribe();
      clear();
    };
  }, [model, squareRefs, allowDrag, allowPremove]);
}
