/**
 * Lichess `chessground` bench page — the vanilla-TS reference implementation.
 *
 * `chessground` is the actual board lichess.org ships. It's not a React
 * component; we wrap its imperative `Chessground(container, config)`
 * factory inside a tiny React shell so the harness plumbing is identical
 * across all three bench pages.
 *
 * The harness API is the same `window.__ucrBench__` shape — same
 * `playMove`, `dragFromTo`, `metrics`, etc. — so Playwright can drive
 * each library through the same scenario script without per-library
 * branching.
 */

import { Chess } from "chess.js";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Config } from "chessground/config";
import type { Key } from "chessground/types";
import { useEffect, useRef } from "react";
import {
  type BenchMetrics,
  installObservers,
  pointerDrag,
  squareCentreByGrid,
  type UcrBench,
} from "./harness/bench-harness.js";

// Lichess ships chessground's styles as CSS files; Vite picks these up
// and injects them into the page. Without these, the board renders as
// an 8×8 grid of blank divs.
import "chessground/assets/chessground.base.css";
import "chessground/assets/chessground.brown.css";
import "chessground/assets/chessground.cburnett.css";

export function CgApp() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cgRef = useRef<Api | null>(null);
  const chessRef = useRef(new Chess());
  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (readyRef.current === null) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  // Mount chessground once. We give it a move-dispatch callback that
  // drives a local `chess.js` instance — the library itself has no chess
  // rules baked in, so we supply legality via `dests()` and commit moves
  // on the callback.
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;

    const computeDests = (): Map<Key, Key[]> => {
      const dests = new Map<Key, Key[]>();
      const c = chessRef.current;
      for (const square of c.moves({ verbose: true })) {
        const list = dests.get(square.from as Key) ?? [];
        list.push(square.to as Key);
        dests.set(square.from as Key, list);
      }
      return dests;
    };

    const config: Config = {
      fen: chessRef.current.fen(),
      turnColor: "white",
      movable: {
        color: "both",
        free: false,
        dests: computeDests(),
        events: {
          after(orig, dest) {
            try {
              chessRef.current.move({
                from: orig,
                to: dest,
                promotion: "q",
              });
            } catch {
              // Illegal — revert chessground's optimistic move.
              cgRef.current?.set({ fen: chessRef.current.fen() });
              return;
            }
            cgRef.current?.set({
              turnColor: chessRef.current.turn() === "w" ? "white" : "black",
              movable: { dests: computeDests() },
            });
          },
        },
      },
      animation: { enabled: false },
    };

    const cg = Chessground(root, config);
    cgRef.current = cg;

    const observers = installObservers();
    observers.start();

    // Chessground uses a single `<cg-board>` element as the 8×8 layout —
    // the inner `cg-container` is the actual square grid we want to
    // index into. Fall back to `root` if the inner element hasn't
    // rendered yet (should be rare since we're past `Chessground(...)`).
    const boardEl = root.querySelector<HTMLElement>("cg-board") ?? root;
    const getCentre = squareCentreByGrid(boardEl, "white");

    const api: UcrBench = {
      library: "cg",
      ready: readyRef.current?.promise ?? Promise.resolve(),
      async playMove(from, to) {
        // Chessground's `.move(orig, dest)` triggers its `movable.events.after`
        // callback which updates the chess.js model. We drive moves
        // through that path for parity with a real user click-to-move.
        cgRef.current?.move(from as Key, to as Key);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      },
      async dragFromTo(from, to, steps = 32) {
        const src = getCentre(from);
        const dst = getCentre(to);
        if (src === null || dst === null) return;
        await pointerDrag(src, dst, steps);
      },
      async reset() {
        chessRef.current = new Chess();
        cgRef.current?.set({
          fen: chessRef.current.fen(),
          turnColor: "white",
          movable: { dests: computeDests() },
        });
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      },
      metrics(): BenchMetrics {
        return observers.snapshot();
      },
      resetMetrics(): void {
        observers.reset();
      },
      squareCentre: getCentre,
    };
    window.__ucrBench__ = api;
    readyRef.current?.resolve();

    return () => {
      cg.destroy();
      cgRef.current = null;
    };
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
      <h1 style={{ marginBottom: 4 }}>chessground (lichess) — Benchmarks</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        lichess.org's board, vanilla TS. Reference implementation for the Playwright head-to-head.
      </p>
      <div ref={rootRef} id="bench-board" style={{ width: 400, height: 400 }} />
    </main>
  );
}
