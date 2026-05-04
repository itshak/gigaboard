import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BOARD_CELL_WP,
  type BoardModel,
  Color,
  createBoardModel,
  createUltrachessAdapter,
  makeArrow,
  makePremove,
  PieceType,
  type SquareIndex,
} from "../src/index.js";

const E2 = 12 as SquareIndex;
const E4 = 28 as SquareIndex;
const E7 = 52 as SquareIndex;
const E5 = 36 as SquareIndex;
const G1 = 6 as SquareIndex;
const F3 = 21 as SquareIndex;

describe("createBoardModel — actions", () => {
  let model: BoardModel;

  beforeEach(async () => {
    const engine = await createUltrachessAdapter();
    model = createBoardModel(engine);
  });
  afterEach(() => model.dispose());

  it("initial snapshot reflects the starting position", () => {
    const s = model.getSnapshot();
    expect(s.turn).toBe(Color.White);
    expect(s.board[E2]).toBe(BOARD_CELL_WP);
    expect(s.selected).toBeNull();
    expect(s.legalTargets.size).toBe(0);
    expect(s.historyPly).toBe(0);
  });

  it("selectSquare(e2) populates legalTargets with e3 and e4", () => {
    model.selectSquare(E2);
    const s = model.getSnapshot();
    expect(s.selected).toBe(E2);
    expect(s.legalTargets.size).toBe(2);
    expect(s.legalTargets.has(20 as SquareIndex)).toBe(true); // e3
    expect(s.legalTargets.has(E4)).toBe(true); // e4
  });

  it("selectSquare with same index is a no-op (no commit, no listener fire)", () => {
    model.selectSquare(E2);
    const fn = vi.fn();
    model.subscribe(fn);
    model.selectSquare(E2);
    expect(fn).not.toHaveBeenCalled();
  });

  it("selectSquare(null) clears legalTargets", () => {
    model.selectSquare(E2);
    model.selectSquare(null);
    expect(model.getSnapshot().legalTargets.size).toBe(0);
  });

  it("tryMove(e2, e4) advances the game", () => {
    const m = model.tryMove(E2, E4);
    expect(m).not.toBeNull();
    const s = model.getSnapshot();
    expect(s.turn).toBe(Color.Black);
    expect(s.board[E4]).toBe(BOARD_CELL_WP);
    expect(s.board[E2]).toBe(0);
    expect(s.lastMove).toBe(m);
    expect(s.historyPly).toBe(1);
    expect(s.selected).toBeNull();
  });

  it("tryMove returns null on illegal and does not commit", () => {
    const fn = vi.fn();
    model.subscribe(fn);
    expect(model.tryMove(E2, 36 as SquareIndex)).toBeNull(); // e2→e5 illegal
    expect(fn).not.toHaveBeenCalled();
  });

  it("undo reverses the last move and pushes to redo stack", () => {
    const m = model.tryMove(E2, E4);
    model.undo();
    const s = model.getSnapshot();
    expect(s.board[E2]).toBe(BOARD_CELL_WP);
    expect(s.board[E4]).toBe(0);
    expect(s.historyPly).toBe(0);
    expect(s.historyLength).toBe(1); // redo available
    expect(s.lastMove).toBeNull();

    const redone = model.redo();
    expect(redone).toBe(m);
    expect(model.getSnapshot().historyPly).toBe(1);
  });

  it("new move invalidates the redo line", () => {
    model.tryMove(E2, E4);
    model.undo();
    model.tryMove(12 as SquareIndex, 20 as SquareIndex); // e2 → e3
    expect(model.getSnapshot().historyLength).toBe(1); // redo wiped
  });

  it("goto(n) jumps within history", () => {
    model.tryMove(E2, E4);
    model.tryMove(E7, E5);
    model.tryMove(G1, F3);
    expect(model.getSnapshot().historyPly).toBe(3);
    model.goto(1);
    expect(model.getSnapshot().historyPly).toBe(1);
    expect(model.getSnapshot().turn).toBe(Color.Black);
    model.goto(3);
    expect(model.getSnapshot().historyPly).toBe(3);
  });

  it("load(fen) clears history, arrows, premoves", () => {
    model.addArrow(makeArrow(E2, E4, "green"));
    model.queuePremove(makePremove(E2, E4));
    model.load("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");
    const s = model.getSnapshot();
    expect(s.turn).toBe(Color.Black);
    expect(s.historyPly).toBe(0);
    expect(s.arrows).toHaveLength(0);
    expect(s.premoves).toHaveLength(0);
  });

  it("syncPosition loads FEN and managed arrows in one commit", () => {
    model.addArrow(makeArrow(G1, F3, "blue"));
    model.queuePremove(makePremove(E2, E4));
    const fn = vi.fn();
    model.subscribe(fn);

    model.syncPosition({
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      managedArrows: [makeArrow(E7, E5, "red")],
    });

    const s = model.getSnapshot();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.turn).toBe(Color.Black);
    expect(s.historyPly).toBe(0);
    expect(s.premoves).toHaveLength(0);
    expect(s.arrows).toHaveLength(1);
    expect(s.arrows[0]).toMatchObject({ from: E7, to: E5, color: "red", managed: true });
  });

  it("syncPosition can preserve user arrows while replacing managed arrows", () => {
    model.addArrow(makeArrow(G1, F3, "blue"));

    model.syncPosition({
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      managedArrows: [makeArrow(E7, E5, "red")],
      preserveUserArrows: true,
    });

    const arrows = model.getSnapshot().arrows;
    expect(arrows).toHaveLength(2);
    expect(arrows.some((arrow) => arrow.from === G1 && arrow.managed !== true)).toBe(true);
    expect(arrows.some((arrow) => arrow.from === E7 && arrow.managed === true)).toBe(true);
  });

  it("syncPosition is a no-op when the FEN and managed arrows are unchanged", () => {
    const fen = model.engine.fen();
    const arrows = [makeArrow(E2, E4, "green")];
    model.syncPosition({ fen, managedArrows: arrows });
    const fn = vi.fn();
    model.subscribe(fn);

    model.syncPosition({ fen, managedArrows: arrows });

    expect(fn).not.toHaveBeenCalled();
  });

  it("reset restores startpos", () => {
    model.tryMove(E2, E4);
    model.reset();
    expect(model.getSnapshot().turn).toBe(Color.White);
    expect(model.getSnapshot().historyPly).toBe(0);
  });

  it("isLegal and legalFrom agree with engine", () => {
    expect(model.isLegal(E2, E4)).toBe(true);
    expect(model.isLegal(E2, 36 as SquareIndex)).toBe(false);
    expect(model.legalFrom(E2).has(E4)).toBe(true);
    expect(model.legalFrom(E2).size).toBe(2);
  });

  it("subscribeSquare only fires for squares that changed bytes", async () => {
    const engine = await createUltrachessAdapter();
    const local = createBoardModel(engine);
    try {
      const e2Fn = vi.fn();
      const e4Fn = vi.fn();
      const a1Fn = vi.fn();
      local.subscribeSquare(E2, e2Fn);
      local.subscribeSquare(E4, e4Fn);
      local.subscribeSquare(0 as SquareIndex, a1Fn);
      local.tryMove(E2, E4);
      expect(e2Fn).toHaveBeenCalledTimes(1);
      expect(e4Fn).toHaveBeenCalledTimes(1);
      expect(a1Fn).not.toHaveBeenCalled();
    } finally {
      local.dispose();
    }
  });
});

describe("createBoardModel — arrows and premoves", () => {
  let model: BoardModel;
  beforeEach(async () => {
    const engine = await createUltrachessAdapter();
    model = createBoardModel(engine);
  });
  afterEach(() => model.dispose());

  it("addArrow commits and increments arrows", () => {
    const fn = vi.fn();
    model.subscribe(fn);
    model.addArrow(makeArrow(E2, E4, "green"));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(model.getSnapshot().arrows).toHaveLength(1);
  });

  it("duplicate addArrow does not commit a second time", () => {
    model.addArrow(makeArrow(E2, E4, "green"));
    const fn = vi.fn();
    model.subscribe(fn);
    model.addArrow(makeArrow(E2, E4, "green"));
    expect(fn).not.toHaveBeenCalled();
  });

  it("toggleArrow adds then removes", () => {
    model.toggleArrow(makeArrow(E2, E4, "green"));
    expect(model.getSnapshot().arrows).toHaveLength(1);
    model.toggleArrow(makeArrow(E2, E4, "green"));
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("clearArrows empties the set", () => {
    model.addArrow(makeArrow(E2, E4, "green"));
    model.addArrow(makeArrow(E7, E5, "red"));
    model.clearArrows();
    expect(model.getSnapshot().arrows).toHaveLength(0);
  });

  it("setArrows replaces the whole set with a single commit", () => {
    model.addArrow(makeArrow(E2, E4, "green"));
    const fn = vi.fn();
    model.subscribe(fn);
    model.setArrows([makeArrow(E7, E5, "red"), makeArrow(E2, E4, "green")]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(model.getSnapshot().arrows).toHaveLength(2);
  });

  it("setArrows with the identical set is a no-op (no commit)", () => {
    model.addArrow(makeArrow(E2, E4, "green"));
    model.addArrow(makeArrow(E7, E5, "red"));
    const fn = vi.fn();
    model.subscribe(fn);
    model.setArrows([makeArrow(E2, E4, "green"), makeArrow(E7, E5, "red")]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("queuePremove attaches to the snapshot premove list", () => {
    model.queuePremove(makePremove(E2, E4));
    expect(model.getSnapshot().premoves).toHaveLength(1);
  });

  it("clearPremoves empties the buffer", () => {
    model.queuePremove(makePremove(E2, E4));
    model.clearPremoves();
    expect(model.getSnapshot().premoves).toHaveLength(0);
  });
});

describe("createBoardModel — legal-move cache", () => {
  let model: BoardModel;
  beforeEach(async () => {
    const engine = await createUltrachessAdapter();
    model = createBoardModel(engine);
  });
  afterEach(() => model.dispose());

  it("caches legal targets by (hash, from) so re-selection is free", () => {
    const cache = model.legalMoveCache;
    cache.resetStats();
    model.selectSquare(E2);
    const missesAfterFirst = cache.misses;
    model.selectSquare(null);
    model.selectSquare(E2);
    expect(cache.misses).toBe(missesAfterFirst);
    expect(cache.hits).toBeGreaterThanOrEqual(1);
  });
});

describe("createBoardModel — animation descriptors", () => {
  let model: BoardModel;
  beforeEach(async () => {
    const engine = await createUltrachessAdapter();
    model = createBoardModel(engine);
  });
  afterEach(() => model.dispose());

  it("plays a 1.e4 move and emits a single `move` descriptor", () => {
    model.tryMove(E2, E4);
    expect(model.lastAnimations).toHaveLength(1);
    const d = model.lastAnimations[0]!;
    expect(d.kind).toBe("move");
  });

  it("emits a `capture` descriptor when capturing", () => {
    model.tryMove(E2, E4);
    model.tryMove(51 as SquareIndex, 35 as SquareIndex); // d7 → d5
    model.tryMove(E4, 35 as SquareIndex); // e4xd5
    const d = model.lastAnimations[0]!;
    expect(d.kind).toBe("capture");
  });

  it("emits a `castle` descriptor on kingside castle", () => {
    model.load("r3k2r/pppbqppp/2np1n2/4p3/4P3/2NPBN2/PPPBQPPP/R3K2R w KQkq - 0 1");
    // White O-O — e1 → g1
    const ok = model.tryMove(4 as SquareIndex, 6 as SquareIndex);
    expect(ok).not.toBeNull();
    expect(model.lastAnimations[0]?.kind).toBe("castle");
  });

  it("uses byte-diff fallback on undo (no packed move supplied)", () => {
    model.tryMove(E2, E4);
    model.undo();
    // Byte diff: e4 disappear + e2 appear = 2 descriptors.
    expect(model.lastAnimations.length).toBeGreaterThanOrEqual(1);
    const kinds = new Set(model.lastAnimations.map((d) => d.kind));
    expect(kinds.has("appear") || kinds.has("disappear")).toBe(true);
  });
});

// Prevent unused-enum warning for callers that only need the type.
void PieceType;
