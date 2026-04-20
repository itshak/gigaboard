/**
 * `react-chessboard` bench page — the "reference" side of the
 * Playwright head-to-head. Mounts their `<Chessboard/>` with
 * `chess.js` as the engine, exposes the SAME `window.__ucrBench__`
 * imperative API the Ultra Chess React page does.
 *
 * Parity notes:
 *
 * - Animations disabled on both boards — we're comparing library
 *   steady-state cost, not WAAPI.
 * - Both boards get the same viewport-width container (400 px) so the
 *   rendered DOM is similarly sized.
 * - Drag is fired via the same shared pointer helper; only the
 *   library's own handlers differ.
 */

import { Chess } from "chess.js";
import { useEffect, useRef, useState } from "react";
import { Chessboard } from "react-chessboard";
import {
  type BenchMetrics,
  installMutationFlash,
  installObservers,
  pointerDrag,
  pointerDragPath,
  squareCentreByDataAttr,
  type UcrBench,
} from "./harness/bench-harness.js";

export function RcbApp() {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());

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

  // Install the harness API on first render. `chess.js` is synchronous
  // so we're "ready" immediately.
  useEffect(() => {
    const observers = installObservers();
    observers.start();
    const boardRoot = document.getElementById("bench-board");
    if (boardRoot !== null) {
      window.__ucrFlash__ = installMutationFlash(boardRoot);
    }
    const api: UcrBench = {
      library: "rcb",
      ready: readyRef.current?.promise ?? Promise.resolve(),
      async playMove(from, to) {
        try {
          chessRef.current.move({ from, to, promotion: "q" });
        } catch {
          /* illegal move — silently ignore so scenarios that share a
             script between boards don't abort early */
        }
        setFen(chessRef.current.fen());
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
        chessRef.current = new Chess();
        setFen(chessRef.current.fen());
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
  }, []);

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 4 }}>react-chessboard — Benchmarks</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Reference implementation for the Playwright head-to-head.
      </p>
      <div id="bench-board" style={{ width: 400, height: 400 }}>
        <Chessboard
          options={{
            position: fen,
            showAnimations: false,
            // Commit drags back into the chess.js model — without this,
            // dragging a piece updates rcb's internal state but never
            // round-trips through React, which silently under-measures
            // rcb's per-move cost.
            onPieceDrop: ({ sourceSquare, targetSquare }): boolean => {
              if (targetSquare === null) return false;
              try {
                chessRef.current.move({
                  from: sourceSquare,
                  to: targetSquare,
                  promotion: "q",
                });
              } catch {
                return false;
              }
              setFen(chessRef.current.fen());
              return true;
            },
          }}
        />
      </div>
    </main>
  );
}
