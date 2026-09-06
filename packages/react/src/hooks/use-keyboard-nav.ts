"use client";

/**
 * Keyboard navigation for the 8×8 grid.
 *
 * Implements the WAI-ARIA "Grid" authoring pattern:
 *
 * - Tab brings focus to the board via a roving tabindex — only the
 *   currently-focused square has `tabindex=0`; every other cell has
 *   `tabindex=-1`, so Tab moves straight out of the grid once the user
 *   is done.
 * - Arrow keys move the focus between squares (visual up/down/left/right,
 *   orientation-aware).
 * - Enter / Space activate the focused square (same path as a mouse click).
 * - Escape clears the selection + any drawn arrows.
 * - Home / End jump to the first / last square in the focused rank.
 * - Ctrl+Home / Ctrl+End jump to the first / last square on the board.
 *
 * The hook is controlled: the caller owns `focusedSquare` state. This
 * lets {@link Chessboard} integrate the keyboard focus with other
 * board-level state (selection, drag, promotion dialog).
 */

import type { SquareIndex } from "../core/index.js";
import { type RefObject, useEffect } from "react";
import type { Orientation } from "../types.js";

/**
 * Translate a visual direction into a new square index, honouring
 * orientation so arrow keys always move focus the way the user sees it.
 */
function moveFocus(
  current: SquareIndex,
  direction: "up" | "down" | "left" | "right",
  orientation: Orientation,
): SquareIndex {
  const file = current & 7;
  const rank = current >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;

  let newCol = col;
  let newRow = row;
  switch (direction) {
    case "up":
      newRow = Math.max(0, row - 1);
      break;
    case "down":
      newRow = Math.min(7, row + 1);
      break;
    case "left":
      newCol = Math.max(0, col - 1);
      break;
    case "right":
      newCol = Math.min(7, col + 1);
      break;
  }

  const newFile = orientation === "white" ? newCol : 7 - newCol;
  const newRank = orientation === "white" ? 7 - newRow : newRow;
  return (newRank * 8 + newFile) as SquareIndex;
}

/** Jump to the first / last file in the same rank as `current`, orientation-aware. */
function rankEnd(
  current: SquareIndex,
  which: "home" | "end",
  orientation: Orientation,
): SquareIndex {
  const rank = current >> 3;
  if (orientation === "white") {
    return ((rank << 3) | (which === "home" ? 0 : 7)) as SquareIndex;
  }
  return ((rank << 3) | (which === "home" ? 7 : 0)) as SquareIndex;
}

/** Jump to a board corner. */
function boardCorner(which: "home" | "end", orientation: Orientation): SquareIndex {
  // "home" = visual top-left, "end" = visual bottom-right.
  if (orientation === "white") {
    return (which === "home" ? 56 : 7) as SquareIndex;
  }
  return (which === "home" ? 7 : 56) as SquareIndex;
}

/** Options accepted by {@link useKeyboardNav}. */
export interface UseKeyboardNavOptions {
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly orientation: Orientation;
  readonly focusedSquare: SquareIndex | null;
  readonly setFocusedSquare: (square: SquareIndex) => void;
  readonly onActivate: (square: SquareIndex) => void;
  readonly onEscape: () => void;
  readonly enabled: boolean;
}

/**
 * Attach keyboard navigation listeners to the board container. All motion
 * is expressed via `setFocusedSquare` — the render layer is responsible
 * for applying `tabindex` and programmatic focus based on that state.
 */
export function useKeyboardNav(options: UseKeyboardNavOptions): void {
  const {
    containerRef,
    orientation,
    focusedSquare,
    setFocusedSquare,
    onActivate,
    onEscape,
    enabled,
  } = options;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (container === null) return;

    const onKeyDown = (e: KeyboardEvent): void => {
      // Only consume keys if focus is somewhere inside our container —
      // otherwise a user typing in an unrelated input would have Tab or
      // Arrow keys hijacked.
      if (!container.contains(e.target as Node)) return;
      const current = focusedSquare;
      if (current === null) return;

      switch (e.key) {
        case "ArrowUp":
          e.preventDefault();
          setFocusedSquare(moveFocus(current, "up", orientation));
          return;
        case "ArrowDown":
          e.preventDefault();
          setFocusedSquare(moveFocus(current, "down", orientation));
          return;
        case "ArrowLeft":
          e.preventDefault();
          setFocusedSquare(moveFocus(current, "left", orientation));
          return;
        case "ArrowRight":
          e.preventDefault();
          setFocusedSquare(moveFocus(current, "right", orientation));
          return;
        case "Home":
          e.preventDefault();
          setFocusedSquare(
            e.ctrlKey || e.metaKey
              ? boardCorner("home", orientation)
              : rankEnd(current, "home", orientation),
          );
          return;
        case "End":
          e.preventDefault();
          setFocusedSquare(
            e.ctrlKey || e.metaKey
              ? boardCorner("end", orientation)
              : rankEnd(current, "end", orientation),
          );
          return;
        case "Enter":
        case " ":
          e.preventDefault();
          onActivate(current);
          return;
        case "Escape":
          e.preventDefault();
          onEscape();
          return;
        default:
          return;
      }
    };

    container.addEventListener("keydown", onKeyDown);
    return () => container.removeEventListener("keydown", onKeyDown);
  }, [containerRef, orientation, focusedSquare, setFocusedSquare, onActivate, onEscape, enabled]);
}
