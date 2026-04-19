/**
 * Default engine adapter, wrapping `ultrachess` (WASM).
 *
 * Two construction paths:
 *
 * - {@link createUltrachessAdapter} — async. Imports `ultrachess`, waits for
 *   WASM init, constructs a `Chess`, and returns the adapter. Use this in
 *   any environment where async boot is acceptable (browser client, Node).
 *
 * - {@link createUltrachessAdapterSync} — sync. Takes an already-initialised
 *   `Chess` instance (typically produced by `Chess.createSync()` after
 *   importing `ultrachess/inline`). Use this in environments that can't
 *   tolerate top-level await (some Next.js configurations, edge runtimes).
 *
 * The adapter is zero-allocation on the hot paths. `makeMove`, `undo`,
 * `legalMoves` each call through the thin `ultrachess` TypeScript layer in
 * single-digit nanoseconds. `readBoard` is the one heavier method — it
 * decodes the engine's 8×8 array into our LERF byte buffer; we measure it
 * only once per commit, not per listener, so the cost amortises.
 */

import {
  Chess,
  IllegalMoveError,
  init,
  type Move as UltraMove,
  type PieceType as UltraPieceType,
} from "ultrachess";
import type { EngineAdapter } from "../engine-adapter.js";
import type { PackedMove, PieceType, SquareIndex } from "../types.js";
import { type Color, encodeBoardCell } from "../types.js";

/**
 * Build an adapter from a live `Chess` instance. The adapter takes ownership
 * of the instance: its `dispose()` will dispose the underlying `Chess`.
 */
export function createUltrachessAdapterSync(chess: Chess): EngineAdapter {
  // We perform string conversion exactly once per call, so stash the converter
  // locally; no shared state, safe for multiple adapters in the same process.
  const toAlgebraic = (sq: SquareIndex): string => algebraicOf(sq);

  const makeMove = (
    from: SquareIndex,
    to: SquareIndex,
    promotion?: PieceType,
  ): PackedMove | null => {
    try {
      const input =
        promotion === undefined
          ? { from: toAlgebraic(from), to: toAlgebraic(to) }
          : {
              from: toAlgebraic(from),
              to: toAlgebraic(to),
              promotion: promotion as unknown as UltraPieceType,
            };
      const move = chess.move(input);
      return move as unknown as PackedMove;
    } catch (err) {
      if (err instanceof IllegalMoveError) return null;
      throw err;
    }
  };

  const undo = (): PackedMove | null => {
    const m = chess.undo();
    return m === null ? null : (m as unknown as PackedMove);
  };

  const legalMoves = (from?: SquareIndex): readonly PackedMove[] => {
    const moves: UltraMove[] =
      from === undefined
        ? chess.moves({ raw: true })
        : chess.moves({ raw: true, square: toAlgebraic(from) });
    // The packed `Move` brand from `ultrachess` is structurally compatible
    // with ours (both are branded u16 numbers); a single assertion suffices.
    return moves as unknown as readonly PackedMove[];
  };

  const readBoard = (out: Uint8Array): void => {
    if (process.env["NODE_ENV"] !== "production") {
      if (out.length !== 64) {
        throw new RangeError("readBoard: out.length must be 64");
      }
    }
    // Start from empty — the engine only reports occupied squares.
    out.fill(0);
    const board = chess.board();
    for (let row = 0; row < 8; row++) {
      const rank = board[row];
      if (!rank) continue;
      for (let col = 0; col < 8; col++) {
        const sq = rank[col];
        if (sq == null) continue;
        out[sq.index] = encodeBoardCell(
          sq.color as unknown as Color,
          sq.type as unknown as PieceType,
        );
      }
    }
  };

  return {
    makeMove,
    undo,
    legalMoves,
    readBoard,
    fen: () => chess.fen(),
    turn: () => chess.turn() as unknown as Color,
    hash: () => chess.hash(),
    inCheck: () => chess.inCheck(),
    san: (move) => chess.san(move as unknown as UltraMove),
    isGameOver: () => chess.isGameOver(),
    load: (fen: string): void => chess.load(fen),
    reset: (): void => chess.reset(),
    dispose: (): void => chess.dispose(),
  };
}

/**
 * Construct an adapter asynchronously. Fetches / instantiates the WASM module
 * on first call (subsequent calls reuse the cached init).
 *
 * @param fen Optional starting FEN. Defaults to `ultrachess`'s standard
 *   starting position.
 */
export async function createUltrachessAdapter(fen?: string): Promise<EngineAdapter> {
  const chess = fen === undefined ? await Chess.create() : await Chess.create(fen);
  return createUltrachessAdapterSync(chess);
}

/**
 * Cached warm-up promise. `ultrachess`'s own `init()` is idempotent, but
 * caching our reference lets us guarantee a single `Promise<void>` shape
 * across the library regardless of the engine's internal caching strategy.
 */
let preloadPromise: Promise<void> | null = null;

/**
 * Warm the `ultrachess` WASM module ahead of time.
 *
 * Starts the `fetch → compile → instantiate` pipeline on the engine's `.wasm`
 * so that the first `createUltrachessAdapter()` call (and, by extension, the
 * first `useChessGame()` in `@ultrachess/react`) resolves without paying the
 * one-time ~250 ms cold cost on the critical path.
 *
 * Call this once, as high up the module graph as you can — the app's root
 * layout / entry module is ideal. The returned Promise is safe to ignore;
 * awaiting only matters in tests or when you need to block on readiness.
 *
 * Idempotent. Multiple invocations resolve to the same underlying init.
 *
 * @example
 * ```tsx
 * // app/layout.tsx (Next.js App Router)
 * import { preloadUltrachessAdapter } from "@ultrachess/core";
 * preloadUltrachessAdapter();  // fire-and-forget
 * ```
 *
 * @remarks
 * Pair with a `<link rel="preload" as="fetch" href="…ultrachess.wasm"
 * crossorigin>` in the HTML head to overlap the WASM fetch with HTML parse
 * and JS download.
 */
export function preloadUltrachessAdapter(): Promise<void> {
  if (preloadPromise === null) {
    // Discard the low-level ABI handle — consumers don't need it, and hiding
    // it keeps our public type surface unchanged if the engine evolves.
    preloadPromise = init().then(() => undefined);
  }
  return preloadPromise;
}

/**
 * Convert a `SquareIndex` (LERF, 0 = a1 .. 63 = h8) to algebraic notation
 * without importing `ultrachess`'s `squareName`. Keeps the adapter dependency
 * surface down to the `Chess` class and error classes only.
 */
function algebraicOf(sq: SquareIndex): string {
  const file = sq & 7;
  const rank = sq >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}
