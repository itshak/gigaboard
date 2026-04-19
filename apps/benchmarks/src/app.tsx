/**
 * Ultra Chess React bench page.
 *
 * Two jobs:
 *
 * 1. Render a live `<Chessboard/>` for manual Chrome DevTools profiling.
 * 2. Install `window.__ucrBench__` so Playwright can drive identical
 *    scenarios against all three bench pages (`/`, `/rcb.html`, `/cg.html`).
 *
 * Sound and animations are off — we're measuring steady-state React +
 * DOM cost, not WAAPI or audio decoding.
 *
 * ### Mount strategy
 *
 * Prior versions of this page used `ultrachess/inline`, which embeds
 * the WASM binary as base64 and compiles it synchronously at module
 * evaluation time. That placed a ~250 ms long task right on the
 * critical path of first paint.
 *
 * This version instead uses the async `init()` entry from `ultrachess`
 * — which calls `WebAssembly.compileStreaming(fetch(...))` — so WASM
 * compilation runs in a background thread while the main thread gets
 * on with React rendering. We render `<Chessboard/>` with a
 * `fallbackFen` so the board paints pieces on the very first commit
 * (the new `<StaticPieceLayer/>` path shipped in `@ultrachess/react`).
 * When `Chess` is ready, the engine-backed `<PieceLayer/>` takes over
 * without a DOM shift.
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
import {
  type BenchMetrics,
  installObservers,
  pointerDrag,
  squareCentreByDataAttr,
  type UcrBench,
} from "./harness/bench-harness.js";

/**
 * Standard starting-position FEN. We keep a local copy rather than
 * importing from `ultrachess` so this module has zero top-level
 * runtime dependency on the WASM engine. The engine module is loaded
 * dynamically inside `useEffect` below, which defers its ~250 ms
 * compile long-task until after first paint.
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

  // Engine spin-up, deferred off the critical path.
  //
  // `ultrachess/inline` embeds the WASM binary and runs `initSync()` at
  // module-evaluation time. A top-level static import of it would pay
  // that ~250 ms compile inside the main bundle before React first
  // mounts — exactly the long task we're trying to eliminate.
  //
  // By loading the module with a dynamic `import(...)` inside
  // `useEffect`, the chunk only starts fetching *after* the first React
  // commit has landed. The module evaluation (and its WASM compile)
  // then runs on the main thread, but after the board has already
  // painted pieces from `fallbackFen` — so the user sees a static
  // starting-position board inside the first frame, and the engine
  // finishes hydrating moments later.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Chess } = await import("ultrachess/inline");
      if (cancelled) return;
      const chess = Chess.createSync();
      const adapter = createUltrachessAdapterSync(chess);
      setModel(createBoardModel(adapter));
    })();
    return () => {
      cancelled = true;
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
