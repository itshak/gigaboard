/**
 * Arrow set with stable identity by `(from, to, color)`.
 *
 * The model is intentionally tiny: it owns nothing the UI cares about (colors,
 * hit-tests, rendering) beyond the three identifying fields. The renderer is
 * responsible for drawing; the model is responsible for *which arrows exist*.
 */

import type { Arrow, SquareIndex } from "./types.js";

/** The arrow-set API. */
export interface ArrowModel {
  /** Current set of arrows, oldest first, as a frozen snapshot. */
  readonly arrows: readonly Arrow[];
  /** `true` if an arrow with the same `(from, to, color)` is present. */
  has(arrow: Arrow): boolean;
  /** Add an arrow. No-op if an identical one already exists. */
  add(arrow: Arrow): void;
  /** Remove an arrow. No-op if it isn't present. */
  remove(arrow: Arrow): void;
  /**
   * Convenience: remove if present, add if not. Returns the new presence
   * (`true` if the arrow is in the set after the call).
   */
  toggle(arrow: Arrow): boolean;
  /** Drop every arrow. */
  clear(): void;
  /** Whether the last call actually changed the state. */
  readonly lastChanged: boolean;
}

function arrowKey(arrow: Arrow): string {
  return `${arrow.from}|${arrow.to}|${arrow.color}`;
}

function freezeArrow(a: Arrow): Arrow {
  return Object.freeze({ from: a.from, to: a.to, color: a.color });
}

const EMPTY_ARROWS: readonly Arrow[] = Object.freeze([]);

/** Create an empty arrow model. */
export function createArrowModel(): ArrowModel {
  const byKey = new Map<string, Arrow>();
  let changed = false;
  // Cached materialisation of `arrows`. Invalidated on any mutation so reads
  // return a stable reference while nothing changes — critical for the React
  // layer's `useSyncExternalStore` slice equality.
  let cached: readonly Arrow[] | null = EMPTY_ARROWS;
  const invalidate = (): void => {
    cached = null;
  };

  const has = (arrow: Arrow): boolean => byKey.has(arrowKey(arrow));

  const add = (arrow: Arrow): void => {
    const key = arrowKey(arrow);
    if (byKey.has(key)) {
      changed = false;
      return;
    }
    byKey.set(key, freezeArrow(arrow));
    changed = true;
    invalidate();
  };

  const remove = (arrow: Arrow): void => {
    changed = byKey.delete(arrowKey(arrow));
    if (changed) invalidate();
  };

  const toggle = (arrow: Arrow): boolean => {
    const key = arrowKey(arrow);
    if (byKey.has(key)) {
      byKey.delete(key);
      changed = true;
      invalidate();
      return false;
    }
    byKey.set(key, freezeArrow(arrow));
    changed = true;
    invalidate();
    return true;
  };

  const clear = (): void => {
    changed = byKey.size > 0;
    byKey.clear();
    if (changed) invalidate();
  };

  return {
    get arrows() {
      if (cached === null) {
        cached = Object.freeze([...byKey.values()]);
      }
      return cached;
    },
    has,
    add,
    remove,
    toggle,
    clear,
    get lastChanged() {
      return changed;
    },
  };
}

/** Helper: build a frozen `Arrow` literal. Validates branded types in dev. */
export function makeArrow(from: SquareIndex, to: SquareIndex, color: string): Arrow {
  return Object.freeze({ from, to, color });
}
