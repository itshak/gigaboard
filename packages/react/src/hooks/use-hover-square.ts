"use client";

/**
 * Per-square pointer-hover tracker.
 *
 * One `pointermove` + `pointerleave` listener on the container diffs the
 * current square against the previous, firing `onEnter`/`onLeave` once
 * per transition. Attaching handlers per-square would cost 64 React
 * listeners and break the "0 re-renders per hover" budget
 * (STANDARDS.md §4.2).
 *
 * Callbacks read through latest-refs so a fresh arrow function each
 * render doesn't re-install the effect.
 */

import type { BoardCell, BoardModel, SquareIndex } from "@gigaboard/core";
import { type RefObject, useEffect, useRef } from "react";
import { getSquareAtPoint } from "../lib/geometry.js";
import type { Orientation } from "../types.js";

/** Context passed to hover callbacks. */
export interface HoverSquareContext {
  readonly square: SquareIndex;
  readonly cell: BoardCell;
}

/** Options for {@link useHoverSquare}. */
export interface UseHoverSquareOptions {
  readonly game: BoardModel | null;
  readonly orientation: Orientation;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly enabled: boolean;
  readonly onEnter?: (ctx: HoverSquareContext) => void;
  readonly onLeave?: (ctx: HoverSquareContext) => void;
}

export function useHoverSquare(options: UseHoverSquareOptions): void {
  const { game, orientation, containerRef, enabled, onEnter, onLeave } = options;

  const onEnterRef = useRef(onEnter);
  const onLeaveRef = useRef(onLeave);
  useEffect(() => {
    onEnterRef.current = onEnter;
    onLeaveRef.current = onLeave;
  });

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (container === null) return;

    let current: SquareIndex | null = null;

    const cellAt = (sq: SquareIndex): BoardCell =>
      game === null ? (0 as BoardCell) : ((game.getSnapshot().board[sq] ?? 0) as BoardCell);

    const onPointerMove = (e: PointerEvent): void => {
      const sq = getSquareAtPoint(container, e.clientX, e.clientY, orientation);
      if (sq === current) return;
      if (current !== null) onLeaveRef.current?.({ square: current, cell: cellAt(current) });
      if (sq !== null) onEnterRef.current?.({ square: sq, cell: cellAt(sq) });
      current = sq;
    };

    const onPointerLeave = (): void => {
      if (current === null) return;
      onLeaveRef.current?.({ square: current, cell: cellAt(current) });
      current = null;
    };

    container.addEventListener("pointermove", onPointerMove, { passive: true });
    container.addEventListener("pointerleave", onPointerLeave);

    return () => {
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      if (current !== null) {
        onLeaveRef.current?.({ square: current, cell: cellAt(current) });
        current = null;
      }
    };
  }, [game, orientation, containerRef, enabled]);
}
