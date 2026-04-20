/**
 * Shared move sequences used by the Playwright head-to-head specs.
 *
 * Keeping these in one place means `drag.spec.ts` (user-path bench via
 * pointer gestures) and `move.spec.ts` (commit-path bench via direct
 * state pokes) replay the *same* game, so their numbers are directly
 * comparable: the delta between the two is exactly what a user pays for
 * the interaction layer (drag frames, pointer capture, drop animation)
 * over and above the engine + re-render work.
 */

/**
 * Sicilian Najdorf, 40 legal plies ending at 20...gxf5 — the same
 * opening we cite for the React Profiler bench. Chosen for:
 *
 *   - quiet opening (pure position changes, tests the byte-level diff path),
 *   - castling (move 17 `e1-c1`: a 4-square byte diff — exactly the
 *     invariant Ultra's subscription model is optimised for),
 *   - captures (e.g. `c5xd4`, `f3xd4`, `f6xh5`, `g7xh6` capture-of-bishop,
 *     `f5xg6` en-passant-adjacent etc.) — each exercises the
 *     piece→empty byte transition,
 *   - sharp middle-game play so the move cost curve isn't just quiet
 *     pawn moves.
 */
export const GAME_40: ReadonlyArray<readonly [string, string]> = [
  ["e2", "e4"],
  ["c7", "c5"],
  ["g1", "f3"],
  ["d7", "d6"],
  ["d2", "d4"],
  ["c5", "d4"],
  ["f3", "d4"],
  ["g8", "f6"],
  ["b1", "c3"],
  ["g7", "g6"],
  ["c1", "e3"],
  ["f8", "g7"],
  ["f2", "f3"],
  ["e8", "g8"],
  ["d1", "d2"],
  ["b8", "c6"],
  ["e1", "c1"],
  ["d8", "a5"],
  ["c1", "b1"],
  ["f8", "d8"],
  ["h2", "h4"],
  ["c8", "e6"],
  ["h4", "h5"],
  ["f6", "h5"],
  ["g2", "g4"],
  ["h5", "f6"],
  ["e3", "h6"],
  ["g7", "h8"],
  ["h6", "e3"],
  ["f6", "g4"],
  ["d2", "h2"],
  ["g4", "f6"],
  ["h2", "h7"],
  ["g8", "f8"],
  ["f3", "f4"],
  ["d8", "c8"],
  ["f4", "f5"],
  ["e6", "d7"],
  ["f5", "g6"],
  ["f7", "g6"],
];
