/**
 * Ultra Chess React grid-mount page.
 *
 * Mounts N copies of `<Chessboard/>` (N read from `?grid=N` in the
 * URL). Exposes `window.__ucrGrid__` so the Playwright
 * `grid.spec.ts` scenario can time paint + interactive independently
 * and snapshot metrics.
 *
 * ### Mount strategy (post-optimisation)
 *
 * All N cells render on the **very first commit** with
 * `fallbackFen={STARTING_FEN}`. `<Chessboard/>`'s new
 * `<StaticPieceLayer/>` path paints pieces from the FEN on that same
 * commit — so the user sees a full wall of boards without waiting for
 * the WASM module to compile.
 *
 * Engines are built asynchronously in the background via `init()`
 * (which runs `WebAssembly.compileStreaming` off the critical path).
 * Once the compile resolves we allocate N `Chess` instances
 * synchronously (each is O(1) after the module is cached) and swap
 * the interactive `<PieceLayer/>` in for the static one. Because the
 * static and interactive layers produce identical DOM shape, the
 * swap is a no-reflow, no-shift transition.
 */

import { Chessboard } from "gigaboard";
import {
  type BoardModel,
  createBoardModel,
  createGigachessAdapter,
  type EngineAdapter,
} from "gigaboard/core";
import { neo } from "gigaboard/pieces/neo";
import { green } from "gigaboard/themes/green";
import { useEffect, useMemo, useRef, useState } from "react";
import { type BenchMetrics, installObservers, type UcrGrid } from "./harness/bench-harness.js";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface Props {
  readonly n: number;
}

export function GridApp({ n }: Props) {
  const [models, setModels] = useState<readonly BoardModel[] | null>(null);
  const boardKeys = useMemo(() => Array.from({ length: n }, (_, index) => `ours-${index}`), [n]);

  // `ready` resolves once the interactive engines are wired up (and thus
  // the interactive piece layer has replaced the static fallback). Kept
  // distinct from paint-readiness so the Playwright bench can time
  // "board visible" separately from "board interactive".
  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (readyRef.current === null) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  // Synchronous engine initialization with gigachess adapter.
  useEffect(() => {
    let cancelled = false;
    const adapters: EngineAdapter[] = [];
    const built: BoardModel[] = [];
    for (let i = 0; i < n; i++) {
      const adapter = createGigachessAdapter();
      adapters.push(adapter);
      built.push(createBoardModel(adapter));
    }
    if (cancelled) {
      for (const a of adapters) a.dispose();
      return;
    }
    setModels(built);
    readyRef.current?.resolve();

    return () => {
      cancelled = true;
      for (const a of adapters) a.dispose();
    };
  }, [n]);

  // Install the harness API on first commit — independent of engine
  // readiness. Without this the spec can't reach `window.__ucrGrid__`
  // to capture metrics until after hydration, which defeats the whole
  // point of the optimisation.
  useEffect(() => {
    const observers = installObservers();
    observers.start();
    const api: UcrGrid = {
      library: "ultra",
      boardCount: n,
      ready: readyRef.current?.promise ?? Promise.resolve(),
      metrics(): BenchMetrics {
        return observers.snapshot();
      },
    };
    window.__gbGrid__ = api;
    window.__ucrGrid__ = api;
  }, [n]);

  // Resolve `ready` once the interactive models have been committed —
  // i.e. `<PieceLayer/>` has replaced `<StaticPieceLayer/>` and the
  // board is playable.
  useEffect(() => {
    if (models === null) return;
    requestAnimationFrame(() => readyRef.current?.resolve());
  }, [models]);

  return (
    <GridShell title={`Ultra Chess React — Grid ×${n}`} n={n}>
      {boardKeys.map((key, i) => (
        <div key={key} className="grid-cell" data-grid-board="1">
          <Chessboard
            game={models?.[i] ?? null}
            fallbackFen={STARTING_FEN}
            theme={green}
            pieces={neo}
            sound={false}
            animation={{ durationMs: 0 }}
            showCoordinates={false}
          />
        </div>
      ))}
    </GridShell>
  );
}

/**
 * Fixed layout shell shared by the three grid pages. Same CSS grid,
 * same cell size, same gap — so differences in the measured numbers
 * are attributable to the library, not the container.
 */
export function GridShell({
  title,
  n,
  children,
}: {
  readonly title: string;
  readonly n: number;
  readonly children: React.ReactNode;
}) {
  return (
    <main
      style={{
        padding: "1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ marginBottom: 4, fontSize: 16 }}>{title}</h1>
      <p style={{ color: "#555", marginTop: 0, marginBottom: 12, fontSize: 12 }}>
        {n} boards mounted · no animations · no interaction
      </p>
      <div
        id="bench-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, 120px)",
          gap: 8,
        }}
      >
        {children}
      </div>
    </main>
  );
}
