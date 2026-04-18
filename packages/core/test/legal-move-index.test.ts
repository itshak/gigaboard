import { describe, expect, it } from "vitest";
import { createLegalMoveIndex, type SquareIndex } from "../src/index.js";

describe("createLegalMoveIndex", () => {
  it("returns undefined on miss and increments miss counter", () => {
    const idx = createLegalMoveIndex();
    expect(idx.get(1n, 0 as SquareIndex)).toBeUndefined();
    expect(idx.misses).toBe(1);
    expect(idx.hits).toBe(0);
  });

  it("returns the stored bytes on hit and increments hit counter", () => {
    const idx = createLegalMoveIndex();
    const payload = new Uint8Array([4, 12]);
    idx.set(1n, 0 as SquareIndex, payload);
    const got = idx.get(1n, 0 as SquareIndex);
    expect(got).toBe(payload);
    expect(idx.hits).toBe(1);
  });

  it("evicts the least-recently-used entry past capacity", () => {
    const idx = createLegalMoveIndex({ capacity: 2 });
    idx.set(1n, 0 as SquareIndex, new Uint8Array([1]));
    idx.set(2n, 0 as SquareIndex, new Uint8Array([2]));
    // Access #1 → makes #2 the LRU.
    idx.get(1n, 0 as SquareIndex);
    idx.set(3n, 0 as SquareIndex, new Uint8Array([3]));
    expect(idx.get(2n, 0 as SquareIndex)).toBeUndefined();
    expect(idx.get(1n, 0 as SquareIndex)).toBeDefined();
    expect(idx.get(3n, 0 as SquareIndex)).toBeDefined();
    expect(idx.size).toBe(2);
  });

  it("overwriting an existing key does not double-count", () => {
    const idx = createLegalMoveIndex({ capacity: 2 });
    idx.set(1n, 0 as SquareIndex, new Uint8Array([1]));
    idx.set(1n, 0 as SquareIndex, new Uint8Array([9]));
    expect(idx.size).toBe(1);
    const got = idx.get(1n, 0 as SquareIndex);
    expect(got?.[0]).toBe(9);
  });

  it("clear empties the cache without affecting stats", () => {
    const idx = createLegalMoveIndex();
    idx.set(1n, 0 as SquareIndex, new Uint8Array([1]));
    idx.get(1n, 0 as SquareIndex);
    expect(idx.hits).toBe(1);
    idx.clear();
    expect(idx.size).toBe(0);
    expect(idx.hits).toBe(1);
  });

  it("resetStats zeroes hit/miss counters", () => {
    const idx = createLegalMoveIndex();
    idx.set(1n, 0 as SquareIndex, new Uint8Array([1]));
    idx.get(1n, 0 as SquareIndex);
    idx.get(2n, 0 as SquareIndex);
    idx.resetStats();
    expect(idx.hits).toBe(0);
    expect(idx.misses).toBe(0);
  });

  it("rejects non-positive capacity", () => {
    expect(() => createLegalMoveIndex({ capacity: 0 })).toThrow(RangeError);
    expect(() => createLegalMoveIndex({ capacity: -1 })).toThrow(RangeError);
    expect(() => createLegalMoveIndex({ capacity: 1.5 })).toThrow(RangeError);
  });

  it("hit-rate simulation on a 1000-selection workload is high", () => {
    const idx = createLegalMoveIndex({ capacity: 256 });
    // Simulate 1000 selections across only 64 (hash, from) keys — high locality.
    for (let i = 0; i < 1000; i++) {
      const hash = BigInt(i % 32);
      const from = (i % 8) as SquareIndex;
      if (idx.get(hash, from) === undefined) {
        idx.set(hash, from, new Uint8Array([1, 2, 3]));
      }
    }
    const hitRate = idx.hits / (idx.hits + idx.misses);
    // Only 32 × 8 = 256 distinct keys; across 1000 accesses hit rate is high.
    expect(hitRate).toBeGreaterThan(0.74);
  });
});
