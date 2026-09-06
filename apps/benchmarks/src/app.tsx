/**
 * Gigaboard bench page.
 *
 * Two jobs:
 *
 * 1. Render a live `<Chessboard/>` for manual Chrome DevTools profiling.
 * 2. Install `window.__gbBench__` / `window.__ucrBench__` so Playwright can drive identical
 *    scenarios against all three bench pages (`/`, `/rcb.html`, `/cg.html`).
 *
 * Sound and animations are off — we're measuring steady-state React +
 * DOM cost, not WAAPI or audio decoding.
 *
 * ### Mount strategy
 *
 * Powered by `gigachess` and synchronous `createGigachessAdapter`.
 * The board paints pieces on the very first commit with zero WASM compile latency.
 */

import {
  type BoardModel,
  createBoardModel,
  createGigachessAdapter,
  type SquareIndex,
} from "gigaboard/core";
import { neo } from "gigaboard/pieces/neo";
import { Chessboard } from "gigaboard";
import { green } from "gigaboard/themes/green";
import { useEffect, useRef, useState } from "react";
import {
  type BenchMetrics,
  type GbBench,
  installMutationFlash,
  installObservers,
  pointerDrag,
  pointerDragPath,
  squareCentreByDataAttr,
} from "./harness/bench-harness.js";

/**
 * Standard starting-position FEN.
 */
const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** Convert algebraic (`"e4"`) to an LERF `SquareIndex`. */
function sqIndex(s: string): SquareIndex {
  return (s.charCodeAt(0) - 97 + (Number(s[1]) - 1) * 8) as SquareIndex;
}

export function App() {
  const [model, setModel] = useState<BoardModel | null>(null);

  // Ready promise for Playwright. Resolves once the interactive model is
  // live and the harness API is attached. Scenarios that need a real
  // engine (move/drag storms) should await this.
  const readyRef = useRef<{
    promise: Promise<void>;
    resolve: () => void;
  } | null>(null);
  if (readyRef.current === null) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  useEffect(() => {
    const adapter = createGigachessAdapter();
    setModel(createBoardModel(adapter));
  }, []);

  // Install the harness API once the model is live.
  useEffect(() => {
    if (model === null) return;
    const observers = installObservers();
    observers.start();
    // Install the mutation-flash observer on the board root. Counter
    // runs always; the visual overlay is off until a spec toggles it on
    // (commit-trace scenario). Library-agnostic — the same mechanism
    // runs on all three bench pages.
    const boardRoot = document.getElementById("bench-board");
    if (boardRoot !== null) {
      const flash = installMutationFlash(boardRoot);
      window.__gbFlash__ = flash;
      window.__ucrFlash__ = flash;
    }
    const api: GbBench = {
      library: "ultra",
      ready: readyRef.current?.promise ?? Promise.resolve(),
      async playMove(from, to) {
        model.tryMove(sqIndex(from), sqIndex(to));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      },
      async dragFromTo(from, to, steps = 32) {
        const src = squareCentreByDataAttr(from);
        const dst = squareCentreByDataAttr(to);
        if (src === null || dst === null) return;
        await pointerDrag(src, dst, steps);
      },
      async dragPath(squares, stepsPerLeg = 32) {
        const pts = squares.map((s) => squareCentreByDataAttr(s)).filter((p) => p !== null);
        if (pts.length < 2) return;
        await pointerDragPath(pts, stepsPerLeg);
      },
      async reset() {
        model.reset();
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      },
      metrics(): BenchMetrics {
        return observers.snapshot();
      },
      resetMetrics(): void {
        observers.reset();
      },
      squareCentre: squareCentreByDataAttr,
    };
    window.__gbBench__ = api;
    window.__ucrBench__ = api;
    readyRef.current?.resolve();
  }, [model]);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 4 }}>Ultra Chess React — Benchmarks</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Mount a board, record a Chrome Performance trace, inspect commits. For automated numbers see{" "}
        <code>BENCH.md</code>.
      </p>
      <div id="bench-board" style={{ width: 400, height: 400 }}>
        <Chessboard
          game={model}
          fallbackFen={STARTING_FEN}
          theme={green}
          pieces={neo}
          sound={false}
          animation={{ durationMs: 0 }}
        />
      </div>
    </main>
  );
}
