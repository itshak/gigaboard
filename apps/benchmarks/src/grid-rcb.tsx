/**
 * `react-chessboard` grid-mount page.
 *
 * Mounts N copies of `<Chessboard/>` with a dedicated `chess.js`
 * instance per board — the realistic shape for a puzzle grid or
 * analysis tree where each board needs independent state. Same
 * `window.__ucrGrid__` contract as the other grid pages.
 */

import { Chess } from "chess.js";
import { useEffect, useMemo, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { type BenchMetrics, installObservers, type UcrGrid } from "./harness/bench-harness.js";
import { GridShell } from "./grid-ours.js";

interface Props {
  readonly n: number;
}

export function RcbGridApp({ n }: Props) {
  const games = useMemo(() => Array.from({ length: n }, () => new Chess()), [n]);

  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (readyRef.current === null) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  useEffect(() => {
    const observers = installObservers();
    observers.start();
    const api: UcrGrid = {
      library: "rcb",
      boardCount: n,
      ready: readyRef.current?.promise ?? Promise.resolve(),
      metrics(): BenchMetrics {
        return observers.snapshot();
      },
    };
    window.__ucrGrid__ = api;
    requestAnimationFrame(() => readyRef.current?.resolve());
  }, [n]);

  return (
    <GridShell title={`react-chessboard — Grid ×${n}`} n={n}>
      {games.map((g, i) => (
        <div key={i} className="grid-cell" data-grid-board="1">
          <Chessboard options={{ position: g.fen(), showAnimations: false }} />
        </div>
      ))}
    </GridShell>
  );
}
