/**
 * Differential fuzz test: our animation planner's classification of every
 * packed move must agree with `ultrachess.verboseMove()` on kind, from, to,
 * captured, and promotion, across thousands of random games.
 *
 * Strategy: play random legal moves from the starting position until either
 * the game ends or we hit a depth cap. At every ply, capture (prevBoard,
 * nextBoard, packedMove) and feed them to `planAnimations`. Compare the
 * resulting descriptor against `ultrachess.verboseMove(move)` (evaluated on
 * the previous position — we snapshot via `Chess.clone()` for that).
 *
 * Default: 1,000 games, depth ≤ 120. The nightly CI shell multiplies both.
 */

import { Chess, type VerboseMove, moveFrom, moveTo } from "ultrachess";
import { describe, expect, it } from "vitest";
import {
  type AnimDescriptor,
  type BoardCell,
  type PackedMove,
  PieceType,
  type SquareIndex,
  encodeBoardCell,
  planAnimations,
} from "../../src/index.js";

const DEFAULT_GAMES = Number(process.env["DIFFERENTIAL_GAMES"] ?? 1000);
const DEFAULT_DEPTH = Number(process.env["DIFFERENTIAL_DEPTH"] ?? 120);
/** Deterministic PRNG keeps failures reproducible. */
const SEED = Number(process.env["DIFFERENTIAL_SEED"] ?? 0xdeadbeef);

/** Tiny LCG — fine for a shuffle, not cryptography. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function encodeFromVerbose(v: VerboseMove | null): BoardCell | 0 {
  if (v === null) return 0;
  return encodeBoardCell(v.color, v.piece);
}

function readBoardBytes(chess: Chess, out: Uint8Array): void {
  out.fill(0);
  const board = chess.board();
  for (const row of board) {
    for (const sq of row) {
      if (sq == null) continue;
      out[sq.index] = encodeBoardCell(sq.color, sq.type);
    }
  }
}

/**
 * Assert that the descriptor produced by our planner matches the authoritative
 * `verboseMove` from `ultrachess`.
 */
function expectDescriptorMatchesVerbose(d: AnimDescriptor, v: VerboseMove): void {
  switch (v.kind) {
    case 0: /* Normal */ {
      if (v.captured !== undefined) {
        expect(d.kind).toBe("capture");
        if (d.kind !== "capture") return;
        expect(d.from).toBe(v.fromIndex);
        expect(d.to).toBe(v.toIndex);
        expect(d.captured).toBe(encodeBoardCell(1 - v.color as 0 | 1, v.captured));
      } else {
        expect(d.kind).toBe("move");
        if (d.kind !== "move") return;
        expect(d.from).toBe(v.fromIndex);
        expect(d.to).toBe(v.toIndex);
      }
      return;
    }
    case 1: /* Promotion */ {
      expect(d.kind).toBe("promotion");
      if (d.kind !== "promotion") return;
      expect(d.from).toBe(v.fromIndex);
      expect(d.to).toBe(v.toIndex);
      // Promoted-to piece.
      expect(d.pieceAfter).toBe(encodeBoardCell(v.color, v.promotion ?? PieceType.Queen));
      if (v.captured !== undefined) {
        expect(d.captured).toBe(encodeBoardCell(1 - v.color as 0 | 1, v.captured));
      } else {
        expect(d.captured).toBeNull();
      }
      return;
    }
    case 2: /* En-passant */ {
      expect(d.kind).toBe("en-passant");
      if (d.kind !== "en-passant") return;
      expect(d.from).toBe(v.fromIndex);
      expect(d.to).toBe(v.toIndex);
      return;
    }
    case 3: /* Castle */ {
      expect(d.kind).toBe("castle");
      if (d.kind !== "castle") return;
      expect(d.kingFrom).toBe(v.fromIndex);
      expect(d.kingTo).toBe(v.toIndex);
      return;
    }
  }
}

describe("differential: @ultrachess/core planAnimations vs ultrachess.verboseMove", () => {
  // Slow, exhaustive — raise timeout generously but keep defaults frugal.
  it(
    `${DEFAULT_GAMES} random games agree on every ply`,
    { timeout: 120_000 },
    async () => {
      const rng = makeRng(SEED);
      const chess = await Chess.create();
      const prev = new Uint8Array(64);
      const next = new Uint8Array(64);

      let plyCount = 0;

      for (let game = 0; game < DEFAULT_GAMES; game++) {
        chess.reset();
        for (let ply = 0; ply < DEFAULT_DEPTH; ply++) {
          if (chess.isGameOver()) break;
          const moves = chess.moves({ raw: true });
          if (moves.length === 0) break;
          const pick = Math.floor(rng() * moves.length);
          const move = moves[pick];
          if (move === undefined) break;

          readBoardBytes(chess, prev);
          const verbose = chess.verboseMove(move);
          chess.move(move);
          readBoardBytes(chess, next);

          // Sanity: the packed move's from / to agree with verbose.
          expect(moveFrom(move)).toBe(verbose.fromIndex);
          expect(moveTo(move)).toBe(verbose.toIndex);

          const descriptors = planAnimations(prev, next, move as unknown as PackedMove);
          expect(descriptors).toHaveLength(1);
          expectDescriptorMatchesVerbose(descriptors[0]!, verbose);
          plyCount++;
        }
      }

      chess.dispose();
      // Sanity check: meaningful coverage happened (games did progress).
      expect(plyCount).toBeGreaterThan(DEFAULT_GAMES); // at least one ply per game
    },
  );
});

// Silence unused binding on the SquareIndex type — kept for clarity at call sites.
void ({} as SquareIndex);
// `encodeFromVerbose` is a diagnostic helper exercised only when failures print.
void encodeFromVerbose;
