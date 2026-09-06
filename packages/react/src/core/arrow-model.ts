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
  /** Drop every arrow, managed or not. */
  clear(): void;
  /**
   * Drop only **user-drawn** arrows (anything without `managed: true`).
   *
   * Used by the board's reflex-clearing hooks (`clearArrowsOnClick`,
   * `clearArrowsOnMove`) so engine / app-owned annotations survive the
   * user's click-to-dismiss gesture. Reports `lastChanged` like every
   * other mutator.
   */
  clearUser(): void;
  /** Drop only **managed** arrows (those with `managed: true`). */
  clearManaged(): void;
  /**
   * Atomic replace of the **managed** subset. User-drawn arrows are
   * untouched. Every incoming arrow is stamped `managed: true` — callers
   * don't have to set the flag explicitly, and the method's name carries
   * the intent. Identity preservation works the same way as
   * {@link setAll}: arrows whose identity key already exists are reused
   * from the stored frozen instances so consumer `Object.is` checks stay
   * cheap across commits.
   */
  setManaged(arrows: readonly Arrow[]): void;
  /**
   * Replace the entire arrow set in one atomic step. Preserves identity
   * for arrows whose `(from, to, color)` tuple was already present —
   * freshly-provided arrows are frozen and keyed; removed ones are
   * dropped. Single `lastChanged` flag covers the whole batch.
   */
  setAll(arrows: readonly Arrow[]): void;
  /** Whether the last call actually changed the state. */
  readonly lastChanged: boolean;
}

function arrowKey(arrow: Arrow): string {
  // Required fields first; optional decorations fold in only when
  // present. Preserves the three-field key for plain arrows so any
  // caller persisting keys survives the M2 upgrade unchanged.
  //
  // `managed` is **not** part of the identity. An app that re-submits
  // the same (from, to, color) pair should not create a duplicate just
  // because ownership flipped — ownership is metadata, not identity.
  let key = `${arrow.from}|${arrow.to}|${arrow.color}`;
  if (arrow.brush !== undefined) key += `|b:${arrow.brush}`;
  if (arrow.label !== undefined) key += `|l:${arrow.label.text}`;
  if (arrow.customSvg !== undefined) key += `|s:${arrow.customSvg.html}`;
  if (arrow.below === true) key += "|below";
  return key;
}

function freezeArrow(a: Arrow): Arrow {
  // Build the frozen shape conditionally so plain arrows still have
  // exactly three own properties (consumers that iterate `Object.keys`
  // shouldn't suddenly see `undefined` entries for the optional fields).
  // Nested records are deep-frozen.
  const out: {
    from: Arrow["from"];
    to: Arrow["to"];
    color: Arrow["color"];
    brush?: string;
    label?: Arrow["label"];
    customSvg?: Arrow["customSvg"];
    below?: boolean;
    managed?: boolean;
  } = { from: a.from, to: a.to, color: a.color };
  if (a.brush !== undefined) out.brush = a.brush;
  if (a.label !== undefined) out.label = Object.freeze({ ...a.label });
  if (a.customSvg !== undefined) out.customSvg = Object.freeze({ ...a.customSvg });
  if (a.below === true) out.below = true;
  if (a.managed === true) out.managed = true;
  return Object.freeze(out) as Arrow;
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

  /**
   * Drop every entry that fails `keep`. One Map pass; zero allocations
   * when nothing changes. The predicate is inlined at each call-site
   * via closure.
   */
  const dropWhere = (remove: (arrow: Arrow) => boolean): void => {
    let mutated = false;
    for (const [key, arrow] of byKey) {
      if (remove(arrow)) {
        byKey.delete(key);
        mutated = true;
      }
    }
    changed = mutated;
    if (mutated) invalidate();
  };

  const clearUser = (): void => dropWhere((a) => a.managed !== true);
  const clearManaged = (): void => dropWhere((a) => a.managed === true);

  const setManaged = (arrows: readonly Arrow[]): void => {
    // Build the next managed-key set. Existing managed entries not in
    // the incoming list are dropped; user-drawn entries are never
    // touched. Identity of re-appearing managed entries is preserved —
    // we reuse the stored frozen instance instead of re-freezing.
    const nextKeys = new Set<string>();
    let mutated = false;
    for (let i = 0; i < arrows.length; i++) {
      const raw = arrows[i];
      if (raw === undefined) continue;
      // Stamp managed on the way in so callers don't have to.
      const marked: Arrow = raw.managed === true ? raw : { ...raw, managed: true };
      const key = arrowKey(marked);
      if (nextKeys.has(key)) continue;
      nextKeys.add(key);
      if (!byKey.has(key)) {
        byKey.set(key, freezeArrow(marked));
        mutated = true;
      }
    }
    // Sweep: remove any previously-managed entry whose key isn't in the
    // next set. User-drawn arrows (managed !== true) are skipped.
    for (const [key, arrow] of byKey) {
      if (arrow.managed === true && !nextKeys.has(key)) {
        byKey.delete(key);
        mutated = true;
      }
    }
    changed = mutated;
    if (mutated) invalidate();
  };

  const setAll = (arrows: readonly Arrow[]): void => {
    // Build the next key set so we can detect adds / removes / churn
    // without re-walking the incoming list twice. Identity of existing
    // entries is preserved: if the incoming arrow already matches a
    // stored one, we reuse the stored frozen instance — keeps consumer
    // `Object.is` checks cheap across commits.
    const nextKeys = new Set<string>();
    let mutated = false;
    for (let i = 0; i < arrows.length; i++) {
      const a = arrows[i];
      if (a === undefined) continue;
      const key = arrowKey(a);
      if (nextKeys.has(key)) continue;
      nextKeys.add(key);
      if (!byKey.has(key)) {
        byKey.set(key, freezeArrow(a));
        mutated = true;
      }
    }
    if (byKey.size !== nextKeys.size) {
      for (const key of byKey.keys()) {
        if (!nextKeys.has(key)) {
          byKey.delete(key);
          mutated = true;
        }
      }
    }
    changed = mutated;
    if (mutated) invalidate();
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
    clearUser,
    clearManaged,
    setAll,
    setManaged,
    get lastChanged() {
      return changed;
    },
  };
}

/** Helper: build a frozen `Arrow` literal. Validates branded types in dev. */
export function makeArrow(from: SquareIndex, to: SquareIndex, color: string): Arrow {
  return Object.freeze({ from, to, color });
}
