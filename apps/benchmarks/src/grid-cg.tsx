/**
 * Lichess `chessground` grid-mount page.
 *
 * Mounts N copies of chessground inside tiny React shells. Each
 * `<CgCell/>` owns its own `chess.js` instance (chessground has no
 * rules), its own DOM root, and calls `Chessground(root, cfg)` once.
 * Same `window.__ucrGrid__` contract as the other grid pages.
 */

import { Chess } from "chess.js";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Key } from "chessground/types";
import { useEffect, useRef } from "react";
import { GridShell } from "./grid-ours.js";
import { type BenchMetrics, installObservers, type UcrGrid } from "./harness/bench-harness.js";

// Chessground styles — mounted once, shared across all cells.
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

interface Props {
  readonly n: number;
}

function CgCell() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<Api | null>(null);
  const chessRef = useRef<Chess | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    chessRef.current = new Chess();

    const computeDests = (): Map<Key, Key[]> => {
      const dests = new Map<Key, Key[]>();
      const c = chessRef.current;
      if (c === null) return dests;
      for (const square of c.moves({ verbose: true })) {
        const list = dests.get(square.from as Key) ?? [];
        list.push(square.to as Key);
        dests.set(square.from as Key, list);
      }
      return dests;
    };

    cgRef.current = Chessground(root, {
      fen: chessRef.current.fen(),
      turnColor: "white",
      movable: { color: "both", free: false, dests: computeDests() },
      animation: { enabled: false },
    });

    return () => {
      cgRef.current?.destroy();
      cgRef.current = null;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="grid-cell"
      data-grid-board="1"
      style={{ width: 120, height: 120 }}
    />
  );
}

export function CgGridApp({ n }: Props) {
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
      library: "cg",
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
    <GridShell title={`chessground (lichess) — Grid ×${n}`} n={n}>
      {Array.from({ length: n }, (_, i) => (
        <CgCell key={i} />
      ))}
    </GridShell>
  );
}
