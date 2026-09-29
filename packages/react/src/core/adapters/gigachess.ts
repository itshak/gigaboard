/**
 * Synchronous engine adapter wrapping `gigachess`.
 *
 * Provides a zero-WASM, pure JavaScript chess engine adapter with instant
 * synchronous initialization (<0.5 ms), incremental { lo, hi } Zobrist hashing,
 * and canonical King-captures-Rook castling representation (Move2).
 */

import {
  ensureMagicTablesLoaded,
  ensureZobristLoaded,
  isEmpty,
  kingAttackers,
  makeSan,
  opposite,
  type Role,
} from "gigachess";
import { Chess } from "gigachess/chessjs";
import type { EngineAdapter } from "../engine-adapter.js";
import type { PackedMove, PieceType, SquareIndex, ZobristKey } from "../types.js";
import {
  Color,
  encodeBoardCell,
  NULL_MOVE_WORD,
  packMove,
  unpackMove,
} from "../types.js";

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
 * A pass leaves the pieces untouched, so its undo record is only the state
 * a pass actually mutates: the turn, the en-passant square, the two clocks,
 * and the cached checkers / Zobrist halves. Castling rights are never
 * touched by a pass, and no piece is moved, so there is nothing to restore
 * there — the same shape as the Rust `make_null_move_with` undo record.
 */
interface NullUndo {
  readonly turn: number;
  readonly epSquare: number | null;
  readonly halfmoves: number;
  readonly fullmoves: number;
  readonly checkersLo: number;
  readonly checkersHi: number;
  readonly zobristLo: number;
  readonly zobristHi: number;
}

/**
 * Create a gigachess-backed engine adapter synchronously.
 *
 * @param fen Optional starting FEN.
 */
export function createGigachessAdapter(fen?: string): EngineAdapter {
  const chess = fen === undefined ? new Chess() : new Chess(fen);

  // `Chess` owns its move history and has no notion of a pass, so passes
  // are tracked here in a stack that mirrors the ply order. An entry is
  // either a pass (with its undo record) or a marker that a real move owns
  // the corresponding `Chess` history slot. `undo()` walks the stack from
  // the top so a pass and the real move beneath it unmade in the right
  // order — LIFO exactly like `Board::unmake_move` / `unmake_null_move`.
  const plyStack: Array<NullUndo | null> = [];

  const clearPlyStack = (): void => {
    plyStack.length = 0;
  };

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
      plyStack.push(null);

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
    const top = plyStack.pop();
    if (top === undefined) return null;
    // A pass owns the top slot — restore the state it mutated and hand back
    // the sentinel so callers see the same word `makeNullMove` produced.
    if (top !== null) {
      const board = chess.boardInstance;
      board.turn = top.turn;
      board.epSquare = top.epSquare;
      board.halfmoves = top.halfmoves;
      board.fullmoves = top.fullmoves;
      board.checkers = { lo: top.checkersLo, hi: top.checkersHi };
      board._zobristLo = top.zobristLo;
      board._zobristHi = top.zobristHi;
      return NULL_MOVE_WORD;
    }
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
    if (typeof process !== "undefined" && process.env?.["NODE_ENV"] !== "production") {
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

  /**
   * Play a pass. Mirrors the Rust `Board::make_null_move_with`: the pieces
   * stay, the en-passant square lapses, both clocks advance, the fullmove
   * number increments whoever passed (a pass is a *full* move, not a
   * half-move), and the side to move flips.
   *
   * Refused when the side to move is in check — a pass answers no check.
   * The legality test asks the bitboards directly via `kingAttackers`
   * rather than reading `board.checkers`, so a pass can't be waved through
   * on a stale cache.
   */
  const makeNullMove = (): PackedMove | null => {
    const board = chess.boardInstance;
    const us = board.turn;
    if (!isEmpty(kingAttackers(board, us))) return null;

    plyStack.push({
      turn: us,
      epSquare: board.epSquare,
      halfmoves: board.halfmoves,
      fullmoves: board.fullmoves,
      checkersLo: board.checkers.lo,
      checkersHi: board.checkers.hi,
      zobristLo: board._zobristLo,
      zobristHi: board._zobristHi,
    });

    const them = opposite(us);
    board.epSquare = null;
    board.halfmoves = board.halfmoves + 1;
    // A pass is a move, not a half-move: the number advances whoever passed.
    board.fullmoves = board.fullmoves + 1;
    board.turn = them;
    // No piece moved, so the only Zobrist contributions that change are the
    // lapsed en-passant square and the flipped turn. Zeroing the cached
    // halves makes the next `zobrist()` read recompute from the bitboards.
    board._zobristLo = 0;
    board._zobristHi = 0;
    // Refresh the checkers cache for the new side to move so `inCheck()`
    // stays branch-free and correct after the flip.
    board.checkers = kingAttackers(board, them);
    return NULL_MOVE_WORD;
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
    makeNullMove,
    legalMoves,
    readBoard,
    fen: () => chess.fen(),
    turn: () => (chess.turn() === "w" ? Color.White : Color.Black),
    hash: (): ZobristKey => chess.zobrist(),
    inCheck: () => chess.inCheck(),
    san,
    isGameOver: () => chess.isGameOver(),
    // Loading or resetting replaces the position and drops the engine's
    // history, so the mirrored ply stack has to go with it — otherwise a
    // later `undo()` would unmake a ply that no longer exists.
    load: (f: string): void => {
      chess.load(f);
      clearPlyStack();
    },
    reset: (): void => {
      chess.reset();
      clearPlyStack();
    },
    dispose: (): void => {
      clearPlyStack();
    },
  };
}
