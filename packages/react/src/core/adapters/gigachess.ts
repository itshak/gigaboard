/**
 * Synchronous engine adapter wrapping `gigachess`.
 *
 * Provides a zero-WASM, pure JavaScript chess engine adapter with instant
 * synchronous initialization (<0.5 ms), incremental { lo, hi } Zobrist hashing,
 * and canonical King-captures-Rook castling representation (Move2).
 */

import { ensureMagicTablesLoaded, ensureZobristLoaded, makeSan, type Role } from "gigachess";
import { Chess } from "gigachess/chessjs";
import type { EngineAdapter } from "../engine-adapter.js";
import type { PackedMove, PieceType, SquareIndex, ZobristKey } from "../types.js";
import { Color, encodeBoardCell, packMove, unpackMove } from "../types.js";

// Eagerly trigger background loading of magic and zobrist tables
void ensureMagicTablesLoaded().catch(() => {});
void ensureZobristLoaded().catch(() => {});

/**
 * Preload gigachess sliding-attack magic tables and Polyglot Zobrist tables ahead of time.
 */
export function preloadGigachessAdapter(): Promise<void> {
  return Promise.all([ensureMagicTablesLoaded(), ensureZobristLoaded()]).then(() => undefined);
}

function algebraicOf(sq: SquareIndex): string {
  const file = sq & 7;
  const rank = sq >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

function squareIndexOf(alg: string): SquareIndex {
  const file = alg.charCodeAt(0) - 0x61;
  const rank = alg.charCodeAt(1) - 0x31;
  return (rank * 8 + file) as SquareIndex;
}

function promoRole(code: number): Role | undefined {
  switch (code) {
    case 1:
      return 1 as Role; // Knight
    case 2:
      return 2 as Role; // Bishop
    case 3:
      return 3 as Role; // Rook
    case 4:
      return 4 as Role; // Queen
    default:
      return undefined;
  }
}

function promoChar(piece?: PieceType): string | undefined {
  switch (piece) {
    case 1:
      return "n";
    case 2:
      return "b";
    case 3:
      return "r";
    case 4:
      return "q";
    default:
      return undefined;
  }
}

/**
 * Create a gigachess-backed engine adapter synchronously.
 *
 * @param fen Optional starting FEN.
 */
export function createGigachessAdapter(fen?: string): EngineAdapter {
  const chess = fen === undefined ? new Chess() : new Chess(fen);

  const makeMove = (
    from: SquareIndex,
    to: SquareIndex,
    promotion?: PieceType,
  ): PackedMove | null => {
    try {
      const fromAlg = algebraicOf(from);
      const toAlg = algebraicOf(to);
      const promo = promoChar(promotion);
      const res = chess.move({
        from: fromAlg,
        to: toAlg,
        ...(promo ? { promotion: promo } : {}),
      });
      if (res === null) return null;

      // Canonical King-captures-Rook encoding for castling
      if (res.flags.includes("k")) {
        return res.color === "w" ? packMove(4, 7, 0) : packMove(60, 63, 0);
      }
      if (res.flags.includes("q")) {
        return res.color === "w" ? packMove(4, 0, 0) : packMove(60, 56, 0);
      }

      const pCode = res.promotion
        ? res.promotion === "n"
          ? 1
          : res.promotion === "b"
            ? 2
            : res.promotion === "r"
              ? 3
              : 4
        : 0;
      return packMove(from, to, pCode);
    } catch {
      return null;
    }
  };

  const undo = (): PackedMove | null => {
    const res = chess.undo();
    if (res === null) return null;
    if (res.flags.includes("k")) {
      return res.color === "w" ? packMove(4, 7, 0) : packMove(60, 63, 0);
    }
    if (res.flags.includes("q")) {
      return res.color === "w" ? packMove(4, 0, 0) : packMove(60, 56, 0);
    }
    const from = squareIndexOf(res.from);
    const to = squareIndexOf(res.to);
    const pCode = res.promotion
      ? res.promotion === "n"
        ? 1
        : res.promotion === "b"
          ? 2
          : res.promotion === "r"
            ? 3
            : 4
      : 0;
    return packMove(from, to, pCode);
  };

  const legalMoves = (from?: SquareIndex): readonly PackedMove[] => {
    const moves =
      from === undefined
        ? chess.moves({ verbose: true })
        : chess.moves({ verbose: true, square: algebraicOf(from) });

    const out: PackedMove[] = [];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      if (m === undefined) continue;
      if (m.flags.includes("k")) {
        out.push(m.color === "w" ? packMove(4, 7, 0) : packMove(60, 63, 0));
      } else if (m.flags.includes("q")) {
        out.push(m.color === "w" ? packMove(4, 0, 0) : packMove(60, 56, 0));
      } else {
        const f = squareIndexOf(m.from);
        const t = squareIndexOf(m.to);
        const pCode = m.promotion
          ? m.promotion === "n"
            ? 1
            : m.promotion === "b"
              ? 2
              : m.promotion === "r"
                ? 3
                : 4
          : 0;
        out.push(packMove(f, t, pCode));
      }
    }
    return out;
  };

  const readBoard = (out: Uint8Array): void => {
    if (process.env["NODE_ENV"] !== "production") {
      if (out.length !== 64) {
        throw new RangeError("readBoard: out.length must be 64");
      }
    }
    out.fill(0);
    const b = chess.boardInstance;
    for (let sq = 0; sq < 64; sq++) {
      const p = b.pieceAt(sq);
      if (p !== undefined) {
        out[sq] = encodeBoardCell(p.color as unknown as Color, p.role as unknown as PieceType);
      }
    }
  };

  const san = (move: PackedMove): string => {
    const { from, to, promo } = unpackMove(move);
    const role = promoRole(promo);
    return makeSan(
      {
        from,
        to,
        ...(role !== undefined ? { promotion: role } : {}),
      },
      chess.pos,
    );
  };

  return {
    makeMove,
    undo,
    legalMoves,
    readBoard,
    fen: () => chess.fen(),
    turn: () => (chess.turn() === "w" ? Color.White : Color.Black),
    hash: (): ZobristKey => chess.zobrist(),
    inCheck: () => chess.inCheck(),
    san,
    isGameOver: () => chess.isGameOver(),
    load: (f: string): void => chess.load(f),
    reset: (): void => chess.reset(),
    dispose: (): void => {},
  };
}
