/**
 * Differential fuzz test: our animation planner's classification of every
 * packed move matches actual game events across thousands of random games
 * played with gigachess.
 *
 * Strategy: play random legal moves from the starting position until either
 * the game ends or we hit a depth cap. At every ply, capture (prevBoard,
 * nextBoard, packedMove) and feed them to `planAnimations`. Compare the
 * resulting descriptor against the move flags.
 */

import { Chess } from "gigachess/chessjs";
import { describe, expect, it } from "vitest";
import {
  Color,
  encodeBoardCell,
  PieceType,
  packMove,
  planAnimations,
  type SquareIndex,
} from "../../../src/core/index.js";

const DEFAULT_GAMES = Number(process.env.DIFFERENTIAL_GAMES ?? 1000);
const DEFAULT_DEPTH = Number(process.env.DIFFERENTIAL_DEPTH ?? 120);
/** Deterministic PRNG keeps failures reproducible. */
const SEED = Number(process.env.DIFFERENTIAL_SEED ?? 0xdeadbeef);

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function squareIndexOf(alg: string): SquareIndex {
  const file = alg.charCodeAt(0) - 0x61;
  const rank = alg.charCodeAt(1) - 0x31;
  return (rank * 8 + file) as SquareIndex;
}

function roleOfChar(char: string): PieceType {
  switch (char.toLowerCase()) {
    case "p":
      return PieceType.Pawn;
    case "n":
      return PieceType.Knight;
    case "b":
      return PieceType.Bishop;
    case "r":
      return PieceType.Rook;
    case "q":
      return PieceType.Queen;
    case "k":
      return PieceType.King;
    default:
      return PieceType.Pawn;
  }
}

function readBoardBytes(chess: Chess, out: Uint8Array): void {
  out.fill(0);
  const b = chess.board();
  for (let r = 0; r < 8; r++) {
    const row = b[r];
    if (!row) continue;
    for (let f = 0; f < 8; f++) {
      const sq = row[f];
      if (sq == null) continue;
      const rank = 7 - r; // chess.js 0th row is 8th rank
      const index = rank * 8 + f;
      const color = sq.color === "w" ? Color.White : Color.Black;
      const type = roleOfChar(sq.type);
      out[index] = encodeBoardCell(color, type);
    }
  }
}

describe("differential: @gigaboard/core planAnimations vs gigachess", () => {
  it(`${DEFAULT_GAMES} random games agree on every ply`, { timeout: 120_000 }, () => {
    const rng = makeRng(SEED);
    const chess = new Chess();
    const prev = new Uint8Array(64);
    const next = new Uint8Array(64);

    let plyCount = 0;

    for (let game = 0; game < DEFAULT_GAMES; game++) {
      chess.reset();
      for (let ply = 0; ply < DEFAULT_DEPTH; ply++) {
        if (chess.isGameOver()) break;
        const moves = chess.moves({ verbose: true });
        if (moves.length === 0) break;
        const pick = Math.floor(rng() * moves.length);
        const move = moves[pick];
        if (move === undefined) break;

        readBoardBytes(chess, prev);

        const from = squareIndexOf(move.from);
        const to = squareIndexOf(move.to);
        const promoCode = move.promotion
          ? move.promotion === "n"
            ? 1
            : move.promotion === "b"
              ? 2
              : move.promotion === "r"
                ? 3
                : 4
          : 0;

        let packed = packMove(from, to, promoCode);
        if (move.flags.includes("k")) {
          packed = move.color === "w" ? packMove(4, 7, 0) : packMove(60, 63, 0);
        } else if (move.flags.includes("q")) {
          packed = move.color === "w" ? packMove(4, 0, 0) : packMove(60, 56, 0);
        }

        chess.move(move);
        readBoardBytes(chess, next);

        const descriptors = planAnimations(prev, next, packed);
        expect(descriptors.length).toBeGreaterThanOrEqual(1);
        const d = descriptors[0]!;

        if (move.flags.includes("k") || move.flags.includes("q")) {
          expect(d.kind).toBe("castle");
        } else if (move.flags.includes("e")) {
          expect(d.kind).toBe("en-passant");
        } else if (move.promotion) {
          expect(d.kind).toBe("promotion");
        } else if (move.captured) {
          expect(d.kind).toBe("capture");
        } else {
          expect(d.kind).toBe("move");
        }

        plyCount++;
      }
    }

    expect(plyCount).toBeGreaterThan(DEFAULT_GAMES);
  });
});
