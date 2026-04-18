/**
 * Premove queue.
 *
 * When it isn't our turn and we drag a piece to a target, the intended move
 * is queued as a `Premove`. After the opponent replies, the board model
 * attempts to apply queued premoves in order; each one that is now legal
 * plays, and on the first illegal premove the queue is cleared (standard
 * lichess/chess.com behaviour — a busted premove discards everything after
 * it too).
 */

import type { Premove, SquareIndex } from "./types.js";
import { type PieceType } from "./types.js";

/** Premove queue API. */
export interface PremoveBuffer {
  /** FIFO snapshot of the current queue. */
  readonly all: readonly Premove[];
  /** The premove at the head of the queue, or `undefined` if empty. */
  peek(): Premove | undefined;
  /** Append a premove. */
  push(premove: Premove): void;
  /** Remove and return the head premove, or `undefined` if empty. */
  shift(): Premove | undefined;
  /** Drop every premove. */
  clear(): void;
  /** Current queue length. */
  readonly length: number;
}

function freezePremove(p: Premove): Premove {
  // Copy to guarantee immutability regardless of what the caller passes in.
  // Preserve the "no `promotion` field vs `promotion: undefined`" distinction
  // required by `exactOptionalPropertyTypes`.
  if (p.promotion === undefined) {
    return Object.freeze({ from: p.from, to: p.to });
  }
  return Object.freeze({ from: p.from, to: p.to, promotion: p.promotion });
}

/** Create an empty premove buffer. */
export function createPremoveBuffer(): PremoveBuffer {
  const queue: Premove[] = [];

  const peek = (): Premove | undefined => queue[0];

  const push = (premove: Premove): void => {
    queue.push(freezePremove(premove));
  };

  const shift = (): Premove | undefined => queue.shift();

  const clear = (): void => {
    queue.length = 0;
  };

  return {
    get all() {
      return Object.freeze([...queue]);
    },
    peek,
    push,
    shift,
    clear,
    get length() {
      return queue.length;
    },
  };
}

/** Helper: build a frozen `Premove` literal with safe optional handling. */
export function makePremove(
  from: SquareIndex,
  to: SquareIndex,
  promotion?: PieceType,
): Premove {
  return promotion === undefined
    ? Object.freeze({ from, to })
    : Object.freeze({ from, to, promotion });
}
