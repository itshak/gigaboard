/**
 * `hash()`-keyed LRU cache for `(position, from-square) → to-squares`.
 *
 * Every time the user picks up a piece we need the list of legal target squares
 * to paint rings on the board. The engine's `legalMoves(from)` call is cheap
 * but crosses the WASM boundary; caching on `engine.hash()` makes every repeat
 * selection free.
 *
 * Keyed as `(hash << 6n) | BigInt(from)` — 70 bits total, carried as a single
 * `bigint` key. LRU order is preserved by `Map` iteration order: on hit we
 * `delete` + `set` to bump the entry to the most-recently-used end; on write
 * past capacity we evict the oldest (the first key in iteration order).
 */

import type { SquareIndex, ZobristKey } from "./types.js";

/** Lookup outcome from {@link LegalMoveIndex.get}. */
export type LegalMoveEntry = Readonly<Uint8Array>;

/** Position hash representation: zero-BigInt { lo, hi } pair or bigint. */
export type PositionHash = bigint | ZobristKey;

/** The cache API. */
export interface LegalMoveIndex {
  /** Return cached target squares for `(hash, from)`, or `undefined` on miss. */
  get(hash: PositionHash, from: SquareIndex): LegalMoveEntry | undefined;
  /** Store target squares for `(hash, from)`. */
  set(hash: PositionHash, from: SquareIndex, tos: Uint8Array): void;
  /** Drop every entry. */
  clear(): void;
  /** Current number of entries. */
  readonly size: number;
  /** Configured maximum entry count. */
  readonly capacity: number;
  /** Cumulative hit count since construction (or last `resetStats`). */
  readonly hits: number;
  /** Cumulative miss count since construction (or last `resetStats`). */
  readonly misses: number;
  /** Reset `hits` / `misses` to zero. Does not affect stored entries. */
  resetStats(): void;
}

/** Options for {@link createLegalMoveIndex}. */
export interface LegalMoveIndexOptions {
  /** Maximum number of entries retained. Must be ≥ 1. Defaults to `1024`. */
  readonly capacity?: number;
}

/** Pack `(hash, from)` into a key without BigInt heap allocation on { lo, hi }. */
function makeKey(hash: PositionHash, from: SquareIndex): string {
  if (typeof hash === "bigint") {
    return `${hash}_${from}`;
  }
  return `${hash.lo}_${hash.hi}_${from}`;
}

/** Create an LRU cache. */
export function createLegalMoveIndex(options: LegalMoveIndexOptions = {}): LegalMoveIndex {
  const capacity = options.capacity ?? 1024;
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`LegalMoveIndex: capacity must be a positive integer, got ${capacity}`);
  }

  const entries = new Map<string, Uint8Array>();
  let hits = 0;
  let misses = 0;

  const get = (hash: bigint, from: SquareIndex): LegalMoveEntry | undefined => {
    const key = makeKey(hash, from);
    const hit = entries.get(key);
    if (hit === undefined) {
      misses++;
      return undefined;
    }
    // Bump to MRU end: re-insert.
    entries.delete(key);
    entries.set(key, hit);
    hits++;
    return hit;
  };

  const set = (hash: bigint, from: SquareIndex, tos: Uint8Array): void => {
    const key = makeKey(hash, from);
    if (entries.has(key)) {
      entries.delete(key);
    } else if (entries.size >= capacity) {
      // Evict LRU (first iteration entry).
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(key, tos);
  };

  const clear = (): void => {
    entries.clear();
  };

  const resetStats = (): void => {
    hits = 0;
    misses = 0;
  };

  return {
    get,
    set,
    clear,
    resetStats,
    get size() {
      return entries.size;
    },
    capacity,
    get hits() {
      return hits;
    },
    get misses() {
      return misses;
    },
  };
}
