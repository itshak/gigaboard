/**
 * Null-move (pass) tolerance.
 *
 * The canonical contract comes from the Rust reference
 * (`Board::make_null_move_with`): the null word is the `u16` sentinel
 * `0xffff`, spelled `"0000"` in UCI and `"--"` / `"Z0"` in PGN/SAN. A pass
 * clears en passant, advances both clocks, always completes a *full* move
 * (whoever passed), and flips the side to move. It is legal iff the side to
 * move is not in check.
 *
 * gigaboard **tolerates** a pass and never **originates** one.
 */

import { describe, expect, it, vi } from "vitest";
import {
  BOARD_CELL_BP,
  BOARD_CELL_WP,
  type BoardModel,
  Color,
  createBoardModel,
  createDragController,
  createGigachessAdapter,
  decodePackedMove,
  isNullMove,
  isNullMoveSan,
  isNullMoveUci,
  NULL_MOVE_SAN,
  NULL_MOVE_SANS,
  NULL_MOVE_UCI,
  NULL_MOVE_WORD,
  type PieceType,
  packMove,
  planAnimations,
  type SquareIndex,
  unpackMove,
} from "../../src/core/index.js";

const E2 = 12 as SquareIndex;
const E4 = 28 as SquareIndex;
const D5 = 35 as SquareIndex;
const D7 = 51 as SquareIndex;
const E5 = 36 as SquareIndex;
const E7 = 52 as SquareIndex;
const E6 = 44 as SquareIndex;

/** Scholar's mate: the side to move (black) is in check, so it may not pass. */
const BLACK_IN_CHECK = "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

/** Split a FEN's trailing halfmove / fullmove fields out for arithmetic asserts. */
function clocks(fen: string): { halfmove: number; fullmove: number } {
  const fields = fen.split(" ");
  return { halfmove: Number(fields[4]), fullmove: Number(fields[5]) };
}

/** Build a model over a fresh gigachess adapter at `fen` (or the start position). */
function modelAt(fen?: string): BoardModel {
  return createBoardModel(createGigachessAdapter(fen));
}

describe("null-move word vocabulary", () => {
  it("uses the canonical u16 sentinel", () => {
    expect(NULL_MOVE_WORD).toBe(0xffff);
  });

  it("spells a pass as UCI 0000 and PGN/SAN -- (input also Z0)", () => {
    expect(NULL_MOVE_UCI).toBe("0000");
    expect(NULL_MOVE_SAN).toBe("--");
    expect(NULL_MOVE_SANS).toEqual(["--", "Z0"]);
  });

  it("isNullMove recognises the sentinel only", () => {
    expect(isNullMove(NULL_MOVE_WORD)).toBe(true);
    expect(isNullMove(0xffff)).toBe(true);
    expect(isNullMove(0xfffe)).toBe(false);
    expect(isNullMove(0)).toBe(false);
    expect(isNullMove(packMove(E2, E4))).toBe(false);
  });

  it("no legal packed word collides with the sentinel", () => {
    // The sentinel is only reachable via from=to=63 with promo code 15, and
    // Move2 promotion codes are 0..4. Sweep the whole legal space.
    for (let from = 0; from < 64; from++) {
      for (let to = 0; to < 64; to++) {
        for (let promo = 0; promo <= 4; promo++) {
          expect(isNullMove(packMove(from, to, promo))).toBe(false);
        }
      }
    }
  });

  it("isNullMoveUci accepts 0000 and nothing else", () => {
    expect(isNullMoveUci("0000")).toBe(true);
    expect(isNullMoveUci(" 0000 ")).toBe(true);
    expect(isNullMoveUci("e2e4")).toBe(false);
    expect(isNullMoveUci("0001")).toBe(false);
    expect(isNullMoveUci("")).toBe(false);
  });

  it("isNullMoveSan accepts -- and Z0 and nothing else", () => {
    expect(isNullMoveSan("--")).toBe(true);
    expect(isNullMoveSan("Z0")).toBe(true);
    expect(isNullMoveSan(" -- ")).toBe(true);
    expect(isNullMoveSan("0000")).toBe(false);
    expect(isNullMoveSan("e4")).toBe(false);
  });
});

describe("engine adapter — pass transition", () => {
  it("plays a pass, flipping the turn and returning the sentinel", () => {
    const engine = createGigachessAdapter();
    try {
      expect(engine.turn()).toBe(Color.White);
      const m = engine.makeNullMove?.();
      expect(m).toBe(NULL_MOVE_WORD);
      expect(isNullMove(m!)).toBe(true);
      expect(engine.turn()).toBe(Color.Black);
    } finally {
      engine.dispose();
    }
  });

  it("moves no piece — the board is byte-identical across a pass", () => {
    const engine = createGigachessAdapter();
    try {
      const before = new Uint8Array(64);
      engine.readBoard(before);
      engine.makeNullMove?.();
      const after = new Uint8Array(64);
      engine.readBoard(after);
      expect(Array.from(after)).toEqual(Array.from(before));
    } finally {
      engine.dispose();
    }
  });

  it("advances both clocks, incrementing the fullmove whoever passed", () => {
    const engine = createGigachessAdapter();
    try {
      const start = clocks(engine.fen());
      // White passes: a pass is a FULL move, so the number advances too.
      engine.makeNullMove?.();
      const afterWhite = clocks(engine.fen());
      expect(afterWhite.halfmove).toBe(start.halfmove + 1);
      expect(afterWhite.fullmove).toBe(start.fullmove + 1);
      expect(engine.turn()).toBe(Color.Black);

      // Black passes: the same rule applies on the way back.
      engine.makeNullMove?.();
      const afterBlack = clocks(engine.fen());
      expect(afterBlack.halfmove).toBe(start.halfmove + 2);
      expect(afterBlack.fullmove).toBe(start.fullmove + 2);
      expect(engine.turn()).toBe(Color.White);
    } finally {
      engine.dispose();
    }
  });

  it("clears a pending en-passant square", () => {
    // 1. e4 e6 2. e5 d5 leaves ep on d6 with White to move and a pawn on
    // e5 that can legally take it, so the FEN publishes the square.
    const engine = createGigachessAdapter();
    try {
      engine.makeMove(E2, E4);
      engine.makeMove(E7, E6);
      engine.makeMove(E4, E5);
      engine.makeMove(D7, D5);
      expect(engine.fen().split(" ")[3]).toBe("d6");

      engine.makeNullMove?.();
      // White passed, so the pending ep lapses entirely.
      expect(engine.fen().split(" ")[3]).toBe("-");
    } finally {
      engine.dispose();
    }
  });

  it("refuses a pass while the side to move is in check", () => {
    const engine = createGigachessAdapter(BLACK_IN_CHECK);
    try {
      expect(engine.inCheck()).toBe(true);
      const before = engine.fen();
      expect(engine.makeNullMove?.()).toBeNull();
      // Refused means untouched: no turn flip, no clock drift, no throw.
      expect(engine.fen()).toBe(before);
    } finally {
      engine.dispose();
    }
  });

  it("allows a pass that hands the opponent a check", () => {
    // The rule constrains only the side doing the passing. Black is not in
    // check here, so black may pass even though the position is sharp.
    const engine = createGigachessAdapter(
      "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",
    );
    try {
      expect(engine.inCheck()).toBe(false);
      expect(engine.makeNullMove?.()).toBe(NULL_MOVE_WORD);
      expect(engine.turn()).toBe(Color.White);
    } finally {
      engine.dispose();
    }
  });

  it("recomputes the Zobrist key rather than leaving a stale one", () => {
    const engine = createGigachessAdapter();
    try {
      const before = engine.hash();
      engine.makeNullMove?.();
      const after = engine.hash();
      const differs =
        typeof before === "object" && typeof after === "object"
          ? before.lo !== after.lo || before.hi !== after.hi
          : before !== after;
      // The turn flipped, so the key must have moved with it.
      expect(differs).toBe(true);

      // Re-deriving the key from the FEN describing the same post-pass
      // position must agree — proves the cached halves were invalidated
      // rather than left describing the pre-pass position.
      const reference = createGigachessAdapter(engine.fen());
      try {
        const refKey = reference.hash();
        if (typeof after === "object" && typeof refKey === "object") {
          expect(after.lo).toBe(refKey.lo);
          expect(after.hi).toBe(refKey.hi);
        }
      } finally {
        reference.dispose();
      }
    } finally {
      engine.dispose();
    }
  });

  it("undoes a pass back to the exact prior position", () => {
    const engine = createGigachessAdapter();
    try {
      const before = engine.fen();
      engine.makeNullMove?.();
      expect(engine.fen()).not.toBe(before);
      const undone = engine.undo();
      expect(undone).toBe(NULL_MOVE_WORD);
      expect(engine.fen()).toBe(before);
    } finally {
      engine.dispose();
    }
  });

  it("interleaves pass and real-move undos in the right LIFO order", () => {
    const engine = createGigachessAdapter();
    try {
      const start = engine.fen();
      engine.makeMove(E2, E4); // real — black to move
      // A pass flips the turn whoever is to move, so this returns the move
      // to White (e4 stands; the fullmove number still advances).
      engine.makeNullMove?.(); // pass — white to move again
      const d3 = engine.makeMove(11 as SquareIndex, 19 as SquareIndex); // real d2-d3
      expect(d3).not.toBeNull();

      expect(engine.undo()).toBe(d3); // top real move first
      expect(engine.undo()).toBe(NULL_MOVE_WORD); // then the pass
      expect(engine.undo()).toBe(packMove(E2, E4)); // then the first real move
      expect(engine.fen()).toBe(start);
      expect(engine.undo()).toBeNull(); // nothing left
    } finally {
      engine.dispose();
    }
  });

  it("round-trips two consecutive passes", () => {
    const engine = createGigachessAdapter();
    try {
      const start = engine.fen();
      engine.makeNullMove?.();
      engine.makeNullMove?.();
      expect(engine.undo()).toBe(NULL_MOVE_WORD);
      expect(engine.undo()).toBe(NULL_MOVE_WORD);
      expect(engine.fen()).toBe(start);
    } finally {
      engine.dispose();
    }
  });

  it("drops the pass history on load and on reset", () => {
    const engine = createGigachessAdapter();
    try {
      const start = engine.fen();
      engine.makeNullMove?.();
      engine.load(start);
      // No ply survives the load, so undo must refuse rather than reach into
      // a stack entry that no longer corresponds to a live position.
      expect(engine.undo()).toBeNull();

      engine.makeNullMove?.();
      engine.reset();
      expect(engine.undo()).toBeNull();
    } finally {
      engine.dispose();
    }
  });

  it("never lists a pass among legal moves", () => {
    const engine = createGigachessAdapter();
    try {
      for (const m of engine.legalMoves()) {
        expect(isNullMove(m)).toBe(false);
      }
      for (let sq = 0; sq < 64; sq++) {
        for (const m of engine.legalMoves(sq as SquareIndex)) {
          expect(isNullMove(m)).toBe(false);
        }
      }
    } finally {
      engine.dispose();
    }
  });
});

describe("animation planner — a pass schedules nothing", () => {
  it("emits no descriptors for the null word", () => {
    const model = modelAt();
    try {
      model.pass();
      expect(model.lastAnimations).toEqual([]);
    } finally {
      model.dispose();
    }
  });

  it("does not fall through to a phantom h8 animation", () => {
    // Without the sentinel guard the word decodes to from=to=63, promo=15
    // and the fast path would emit a descriptor on h8 for a "move" that
    // never happened. Feed a genuinely different board pair so the silence
    // is proven by the guard rather than by the bytes happening to match.
    const prev = new Uint8Array(64);
    const next = new Uint8Array(64);
    prev[63] = BOARD_CELL_BP;
    next[63] = BOARD_CELL_WP;
    expect(planAnimations(prev, next, NULL_MOVE_WORD)).toEqual([]);
  });

  it("decodePackedMove reports a pass instead of a normal h8 move", () => {
    const decoded = decodePackedMove(NULL_MOVE_WORD);
    expect(decoded.kind).toBe("pass");
    expect(decoded.promotion).toBeNull();
  });
});

describe("board model — coherent state across a pass", () => {
  it("commits one snapshot with the turn flipped and no animation", () => {
    const model = modelAt();
    try {
      let commits = 0;
      model.subscribe(() => {
        commits++;
      });
      expect(model.pass()).toBe(NULL_MOVE_WORD);
      expect(commits).toBe(1);
      const s = model.getSnapshot();
      expect(s.turn).toBe(Color.Black);
      expect(s.lastMove).toBe(NULL_MOVE_WORD);
      expect(s.historyPly).toBe(1);
      expect(s.historyLength).toBe(1);
      expect(model.lastAnimations).toEqual([]);
    } finally {
      model.dispose();
    }
  });

  it("leaves the board bytes untouched and paints no legality ring", () => {
    const model = modelAt();
    try {
      model.selectSquare(E2);
      expect(model.getSnapshot().legalTargets.size).toBeGreaterThan(0);

      const before = Array.from(model.getSnapshot().board);
      model.pass();
      const s = model.getSnapshot();
      expect(Array.from(s.board)).toEqual(before);
      // The selection belonged to the side that just passed, so it is
      // dropped — which is also what keeps the legal-target ring off.
      expect(s.selected).toBeNull();
      expect(s.legalTargets.size).toBe(0);
    } finally {
      model.dispose();
    }
  });

  it("refuses a pass while in check without committing", () => {
    const model = modelAt(BLACK_IN_CHECK);
    try {
      let commits = 0;
      model.subscribe(() => {
        commits++;
      });
      const before = model.getSnapshot();
      expect(model.pass()).toBeNull();
      expect(commits).toBe(0);
      const after = model.getSnapshot();
      expect(after.turn).toBe(before.turn);
      expect(after.historyPly).toBe(0);
    } finally {
      model.dispose();
    }
  });

  it("refuses a pass on an adapter with no pass capability", () => {
    const engine = createGigachessAdapter();
    // The protocol makes the capability optional, so an engine that omits
    // it must degrade to "refused" rather than throw.
    const model = createBoardModel({ ...engine, makeNullMove: undefined });
    try {
      expect(model.pass()).toBeNull();
      expect(model.getSnapshot().historyPly).toBe(0);
    } finally {
      model.dispose();
    }
  });

  it("undoes and redoes a pass through the model", () => {
    const model = modelAt();
    try {
      const start = model.engine.fen();
      model.pass();
      expect(model.getSnapshot().turn).toBe(Color.Black);

      expect(model.undo()).toBe(NULL_MOVE_WORD);
      expect(model.getSnapshot().turn).toBe(Color.White);
      expect(model.getSnapshot().historyPly).toBe(0);
      expect(model.engine.fen()).toBe(start);

      // Redo must re-apply the pass, not decode it as an h8-to-h8 move.
      expect(model.redo()).toBe(NULL_MOVE_WORD);
      expect(model.getSnapshot().turn).toBe(Color.Black);
      expect(model.lastAnimations).toEqual([]);
    } finally {
      model.dispose();
    }
  });

  it("walks goto() across a pass without breaking the history", () => {
    const model = modelAt();
    try {
      const start = model.engine.fen();
      model.pass();
      model.pass();
      expect(model.getSnapshot().historyPly).toBe(2);

      model.goto(0);
      expect(model.getSnapshot().historyPly).toBe(0);
      expect(model.engine.fen()).toBe(start);

      model.goto(2);
      expect(model.getSnapshot().historyPly).toBe(2);
      expect(model.getSnapshot().turn).toBe(Color.White);
    } finally {
      model.dispose();
    }
  });

  it("keeps a pass in the history stack alongside real moves", () => {
    const model = modelAt();
    try {
      model.pass();
      // From the start position White was to move, so the pass hands the
      // move to Black.
      const m = model.tryMove(E7, E6);
      expect(m).not.toBeNull();
      expect(model.getSnapshot().historyPly).toBe(2);

      expect(model.undo()).toEqual(m);
      expect(model.getSnapshot().turn).toBe(Color.Black);
      expect(model.undo()).toBe(NULL_MOVE_WORD);
      expect(model.getSnapshot().historyPly).toBe(0);
    } finally {
      model.dispose();
    }
  });

  it("reports the pass in the FEN the engine publishes", () => {
    const model = modelAt();
    try {
      const placement = model.engine.fen().split(" ")[0];
      model.pass();
      const fields = model.engine.fen().split(" ");
      expect(fields[0]).toBe(placement);
      expect(fields[1]).toBe("b");
      expect(fields[3]).toBe("-");
      expect(fields[4]).toBe("1"); // halfmove + 1
      expect(fields[5]).toBe("2"); // fullmove + 1
    } finally {
      model.dispose();
    }
  });
});

describe("gigaboard never originates a pass", () => {
  it("tryMove cannot return the sentinel for any square pair", () => {
    // The gesture path is a from-to pair, so it has no way to express a
    // pass. Sweep all 4096 pairs from the start position.
    const model = modelAt();
    try {
      for (let from = 0; from < 64; from++) {
        for (let to = 0; to < 64; to++) {
          const m = model.tryMove(from as SquareIndex, to as SquareIndex);
          if (m !== null) expect(isNullMove(m)).toBe(false);
        }
      }
    } finally {
      model.dispose();
    }
  });

  it("tryMove cannot return the sentinel for any promotion code", () => {
    // The sentinel is reachable in `packMove` only via promo 15 with
    // from=to=63. Drive the promotion path with every code, including the
    // out-of-contract ones, to prove none of them yields a pass.
    const model = modelAt("r3k2r/pP6/8/8/8/8/8/R3K2R w KQkq - 0 1");
    try {
      for (let promo = 0; promo < 16; promo++) {
        const m = model.tryMove(49 as SquareIndex, 48 as SquareIndex, promo as PieceType);
        if (m !== null) expect(isNullMove(m)).toBe(false);
      }
      // And the literal sentinel-from/to pair.
      const corner = model.tryMove(63 as SquareIndex, 63 as SquareIndex, 15 as PieceType);
      if (corner !== null) expect(isNullMove(corner)).toBe(false);
    } finally {
      model.dispose();
    }
  });

  it("tryMove is the only gesture entry and never reaches the pass path", () => {
    // A spy adapter proves the gesture surface never calls `makeNullMove`:
    // passes enter through `model.pass()` alone.
    const engine = createGigachessAdapter();
    const spy = { ...engine, makeNullMove: vi.fn(engine.makeNullMove) };
    const model = createBoardModel(spy);
    try {
      model.selectSquare(E2);
      model.tryMove(E2, E4);
      expect(spy.makeNullMove).not.toHaveBeenCalled();
    } finally {
      model.dispose();
    }
  });

  it("selecting any square never paints a pass as a legal target", () => {
    const model = modelAt();
    try {
      for (let sq = 0; sq < 64; sq++) {
        model.selectSquare(sq as SquareIndex);
        const s = model.getSnapshot();
        // A pass has no square, so the ring can only ever hold real squares.
        for (const target of s.legalTargets) {
          expect(target).toBeGreaterThanOrEqual(0);
          expect(target).toBeLessThanOrEqual(63);
        }
        // And the model never spontaneously reports itself mid-pass.
        expect(s.lastMove === null || !isNullMove(s.lastMove)).toBe(true);
      }
    } finally {
      model.dispose();
    }
  });

  it("legalFrom never returns the sentinel's decoded squares", () => {
    const model = modelAt();
    try {
      for (let sq = 0; sq < 64; sq++) {
        for (const t of model.legalFrom(sq as SquareIndex)) {
          expect(t).toBeGreaterThanOrEqual(0);
          expect(t).toBeLessThanOrEqual(63);
        }
      }
    } finally {
      model.dispose();
    }
  });

  it("isLegal agrees with tryMove and never implies a pass", () => {
    const model = modelAt();
    try {
      for (let from = 0; from < 64; from++) {
        for (let to = 0; to < 64; to++) {
          if (!model.isLegal(from as SquareIndex, to as SquareIndex)) continue;
          const m = model.tryMove(from as SquareIndex, to as SquareIndex);
          expect(m).not.toBeNull();
          expect(isNullMove(m!)).toBe(false);
        }
      }
    } finally {
      model.dispose();
    }
  });

  it("a drag-and-drop pair cannot express a pass", () => {
    // The drag controller is square-typed end to end, so there is no
    // drag-to-null affordance to pin: the widest possible drop is a square.
    // Cross the 4px activation threshold so the drag actually engages.
    const drag = createDragController();
    expect(drag.pointerDown(63 as SquareIndex, 1, 0, 0)).toBe(true);
    expect(drag.pointerMove(1, 10, 10)).toEqual({ kind: "drag-start", from: 63 });
    const drop = drag.pointerUp(1, 400, 400);
    expect(drop).toEqual({ kind: "drop", from: 63, x: 400, y: 400, wasDrag: true });
  });

  it("unpackMove on the sentinel is meaningless — the reason to gate first", () => {
    // Pins the hazard callers must avoid: unpacking yields h8 -> h8 promo 15.
    const raw = unpackMove(NULL_MOVE_WORD);
    expect(raw.from).toBe(63);
    expect(raw.to).toBe(63);
    expect(raw.promo).toBe(15);
  });
});
