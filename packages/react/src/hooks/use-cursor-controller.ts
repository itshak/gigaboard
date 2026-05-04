"use client";

/**
 * `useCursorController` — cursor paint for grabbable pieces via a
 * single container-level attribute plus CSS matching.
 *
 * ### Why this exists
 *
 * The board's pointer cursor is a signal: hover a piece you can pick up,
 * see `grab`; drag it, see `grabbing`; hover an empty square or a piece
 * that isn't yours to move, see the normal `pointer`. That's how every
 * native chess UI (lichess / chess.com / chessground) behaves.
 *
 * ### Design — why not per-square data-attributes
 *
 * An earlier version of this controller imperatively wrote
 * `data-ucr-grabbable="true"` on every square that currently held a
 * pickup-eligible piece. The diff logic was correct, but every turn
 * flip changes grabbable status for 16 white + 16 black piece squares,
 * so a single move dispatched **32 DOM attribute mutations**. For a
 * 40-ply game that's 1 280 attribute writes — the library's largest
 * source of DOM churn per move, visible in the mutation-audit bench.
 *
 * The new design writes **one** container-level attribute per turn
 * flip and lets CSS express which pieces are grabbable based on data
 * already present on each piece slot:
 *
 *   - `data-ucr-turn="white" | "black"` on the board container
 *     — one attribute write per commit in which `turn` changes.
 *   - `data-ucr-premove="true"` on the container when `allowPremove`
 *     is on — one attribute write when premove availability changes.
 *   - `[data-piece-cell]` is already set on every `PieceSlot`
 *     (1..6 white, 7..12 black); see `piece-layer.tsx`.
 *
 * The injected CSS rules target piece slots directly, flipping
 * `pointer-events: auto` + `cursor: grab` on them. Because piece slots
 * render inside an overlay that normally has `pointer-events: none`,
 * this has the side-benefit of making ONLY grabbable pieces intercept
 * pointer events — click-to-move / drag initiation still fire via the
 * board's bubbling listener.
 *
 * Net effect:
 *   Before: 32 attribute writes per turn flip (per-square)
 *   After:   0-1 attribute write per turn flip (per-container)
 *   ≈ 98 % reduction in cursor-system DOM mutations per move.
 */

import type { BoardModel } from "@ultrachess/core";
import { type RefObject, useEffect } from "react";

/** Singleton id used to dedupe the injected `<style>` element. */
const STYLE_ID = "ucr-cursor-styles";

/**
 * Inject the cursor CSS once per document. SSR-safe (early-returns).
 *
 * Rule precedence (later rules win on ties):
 *   1. Every square defaults to `pointer`.
 *   2. Piece slots whose cell code belongs to the side-to-move get
 *      `cursor: grab` and `pointer-events: auto` so the cursor on the
 *      piece reads correctly and the piece intercepts the pointerdown.
 *   3. Same for `data-ucr-premove="true"` + opposite-colour pieces.
 *   4. While any descendant square is under an active drag (the board
 *      container carries `data-ucr-dragging="true"`), every square
 *      reads `grabbing`.
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
[data-ucr-turn="white"] [data-piece-cell="1"],
[data-ucr-turn="white"] [data-piece-cell="2"],
[data-ucr-turn="white"] [data-piece-cell="3"],
[data-ucr-turn="white"] [data-piece-cell="4"],
[data-ucr-turn="white"] [data-piece-cell="5"],
[data-ucr-turn="white"] [data-piece-cell="6"],
[data-ucr-turn="black"] [data-piece-cell="7"],
[data-ucr-turn="black"] [data-piece-cell="8"],
[data-ucr-turn="black"] [data-piece-cell="9"],
[data-ucr-turn="black"] [data-piece-cell="10"],
[data-ucr-turn="black"] [data-piece-cell="11"],
[data-ucr-turn="black"] [data-piece-cell="12"] {
  pointer-events: auto;
  cursor: grab;
}
[data-ucr-premove="true"][data-ucr-turn="white"] [data-piece-cell="7"],
[data-ucr-premove="true"][data-ucr-turn="white"] [data-piece-cell="8"],
[data-ucr-premove="true"][data-ucr-turn="white"] [data-piece-cell="9"],
[data-ucr-premove="true"][data-ucr-turn="white"] [data-piece-cell="10"],
[data-ucr-premove="true"][data-ucr-turn="white"] [data-piece-cell="11"],
[data-ucr-premove="true"][data-ucr-turn="white"] [data-piece-cell="12"],
[data-ucr-premove="true"][data-ucr-turn="black"] [data-piece-cell="1"],
[data-ucr-premove="true"][data-ucr-turn="black"] [data-piece-cell="2"],
[data-ucr-premove="true"][data-ucr-turn="black"] [data-piece-cell="3"],
[data-ucr-premove="true"][data-ucr-turn="black"] [data-piece-cell="4"],
[data-ucr-premove="true"][data-ucr-turn="black"] [data-piece-cell="5"],
[data-ucr-premove="true"][data-ucr-turn="black"] [data-piece-cell="6"] {
  pointer-events: auto;
  cursor: grab;
}
[data-ucr-dragging="true"] [data-ucr-square],
[data-ucr-dragging="true"] [data-piece-cell] {
  cursor: grabbing;
}
`;
  document.head.appendChild(style);
}

/**
 * Paint `data-ucr-turn` (and, when applicable, `data-ucr-premove`) on
 * the board container. One attribute write per turn flip, independent
 * of how many pieces are on the board.
 *
 * @param model The board model, or `null` while the engine is loading.
 * @param containerRef Ref to the board container — the root of the
 *   ARIA grid and the element that carries every container-level
 *   interaction attribute (dragging, turn, premove).
 * @param allowDrag When `false`, no piece is grabbable — the container
 *   drops the `data-ucr-turn` attribute entirely so the CSS rules no
 *   longer match.
 * @param allowPremove When `true`, pieces of the colour that's **not**
 *   to move are also grabbable (premove queueing).
 */
export function useCursorController(
  model: BoardModel | null,
  containerRef: RefObject<HTMLElement | null>,
  allowDrag: boolean,
  allowPremove: boolean,
): void {
  useEffect(() => {
    injectCursorStyles();
  }, []);

  useEffect(() => {
    if (model === null) return;

    // Track the last value we wrote so we only touch the DOM on change.
    // DOMStringMap deletion on an already-absent key is a no-op, but the
    // browser still serialises the call — this guard keeps the observer
    // clean in test environments.
    let lastTurn: "white" | "black" | null = null;
    let lastPremove: boolean | null = null;

    const write = (): void => {
      const el = containerRef.current;
      if (el === null) return;
      if (!allowDrag) {
        // Drag is off — CSS rules won't match anything without the
        // attribute, so pull it cleanly if it was set.
        if (lastTurn !== null) {
          delete el.dataset["ucrTurn"];
          lastTurn = null;
        }
        if (lastPremove !== null) {
          delete el.dataset["ucrPremove"];
          lastPremove = null;
        }
        return;
      }
      const turn = model.getSnapshot().turn === 0 ? "white" : "black";
      if (turn !== lastTurn) {
        el.dataset["ucrTurn"] = turn;
        lastTurn = turn;
      }
      if (allowPremove !== lastPremove) {
        if (allowPremove) {
          el.dataset["ucrPremove"] = "true";
        } else {
          delete el.dataset["ucrPremove"];
        }
        lastPremove = allowPremove;
      }
    };

    write();
    const unsubscribe = model.subscribe(write);
    return () => {
      unsubscribe();
      const el = containerRef.current;
      if (el !== null) {
        delete el.dataset["ucrTurn"];
        delete el.dataset["ucrPremove"];
      }
    };
  }, [model, containerRef, allowDrag, allowPremove]);
}
