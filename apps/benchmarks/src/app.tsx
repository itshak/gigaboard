/**
 * Ultra Chess React bench page.
 *
 * Two jobs:
 *
 * 1. Render a live `<Chessboard/>` for manual Chrome DevTools profiling.
 * 2. Install `window.__ucrBench__` so Playwright can drive identical
 *    scenarios against both our board and `react-chessboard` (`/rcb.html`).
 *
 * Sound and animations are off here — we're measuring the steady-state
 * React + DOM cost, not WAAPI or audio decoding.
 */

import {
  type BoardModel,
  createBoardModel,
  createUltrachessAdapterSync,
  type SquareIndex,
} from "@ultrachess/core";
import { neo } from "@ultrachess/pieces/neo";
import { Chessboard } from "@ultrachess/react";
import { green } from "@ultrachess/themes/green";
import { useEffect, useRef, useState } from "react";
// The bench page runs inside Vite dev, where resolving `ultrachess`'s
// `../assets/ultrachess.wasm` relative URL is fragile (it sometimes
// serves index.html as a fallback instead of the binary). Using
// `ultrachess/inline` embeds the WASM as base64 and exposes a sync
// `Chess.createSync()` path — no fetch, no wasm mime-type dance.
import { Chess } from "ultrachess/inline";
import {
  type BenchMetrics,
  installObservers,
  pointerDrag,
  squareCentreByDataAttr,
  type UcrBench,
} from "./harness/bench-harness.js";

/** Convert algebraic (`"e4"`) to an LERF `SquareIndex`. */
function sqIndex(s: string): SquareIndex {
  return (s.charCodeAt(0) - 97 + (Number(s[1]) - 1) * 8) as SquareIndex;
}

export function App() {
  const [model, setModel] = useState<BoardModel | null>(null);

  // A ready promise that resolves once the board is live + the harness
  // has attached. Playwright awaits this before running a scenario.
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

  // Engine spin-up. `ultrachess/inline` runs an inline-wasm `initSync()`
  // at module load, so `Chess.createSync()` is safe right here in a
  // layout effect — no Promise, no top-level await.
  useEffect(() => {
    const chess = Chess.createSync();
    const adapter = createUltrachessAdapterSync(chess);
    setModel(createBoardModel(adapter));
    return () => {
      adapter.dispose();
    };
  }, []);

  // Install the harness API once the model is live.
  useEffect(() => {
    if (model === null) return;
    const observers = installObservers();
    observers.start();
    const api: UcrBench = {
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
          theme={green}
          pieces={neo}
          sound={false}
          animation={{ durationMs: 0 }}
        />
      </div>
    </main>
  );
}
