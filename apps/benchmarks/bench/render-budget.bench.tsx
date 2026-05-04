/**
 * Render-budget benchmark — Ultra Chess React vs `react-chessboard`.
 *
 * Runs inside vitest + happy-dom. For each library, we mount its board,
 * drive a sequence of moves, and record React Profiler commits +
 * total-actual-duration via the `<Profiler/>` onRender callback.
 *
 * The comparison is intentionally charitable to `react-chessboard`:
 * animations are disabled on both boards and we feed each one the
 * minimum set of props needed to play a move. What we measure is the
 * **steady-state React cost** — how much work each library does to
 * reflect a new board state, once the engine has been told about it.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act, render } from "@testing-library/react";
import {
  type BoardModel,
  createBoardModel,
  createUltrachessAdapter,
  type SquareIndex,
} from "@ultrachess/core";
import { Chessboard as UltraChessboard } from "@ultrachess/react";
import { Chess } from "chess.js";
import {
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactNode,
  StrictMode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Chessboard as RcbChessboard } from "react-chessboard";
import { describe, expect, test } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = resolve(here, "..", "bench-results");
mkdirSync(resultsDir, { recursive: true });

/** A short sequence of moves to drive both boards through identical work. */
const GAME_40: Array<[string, string]> = [
  ["e2", "e4"],
  ["c7", "c5"],
  ["g1", "f3"],
  ["d7", "d6"],
  ["d2", "d4"],
  ["c5", "d4"],
  ["f3", "d4"],
  ["g8", "f6"],
  ["b1", "c3"],
  ["g7", "g6"],
  ["c1", "e3"],
  ["f8", "g7"],
  ["f2", "f3"],
  ["e8", "g8"],
  ["d1", "d2"],
  ["b8", "c6"],
  ["e1", "c1"],
  ["d8", "a5"],
  ["c1", "b1"],
  ["f8", "d8"],
  ["h2", "h4"],
  ["c8", "e6"],
  ["h4", "h5"],
  ["f6", "h5"],
  ["g2", "g4"],
  ["h5", "f6"],
  ["e3", "h6"],
  ["g7", "h8"],
  ["h6", "e3"],
  ["f6", "g4"],
  ["d2", "h2"],
  ["g4", "f6"],
  ["h2", "h7"],
  ["g8", "f8"],
  ["f3", "f4"],
  ["d8", "c8"],
  ["f4", "f5"],
  ["e6", "d7"],
  ["f5", "g6"],
  ["f7", "g6"],
];

function sqIndex(s: string): SquareIndex {
  return (s.charCodeAt(0) - 97 + (Number(s[1]) - 1) * 8) as SquareIndex;
}

/** Collected commits for one bench run. */
interface ProfileLog {
  commits: number;
  actualDurationMs: number;
  baseDurationMs: number;
}

function newLog(): ProfileLog {
  return { commits: 0, actualDurationMs: 0, baseDurationMs: 0 };
}

function profile(log: ProfileLog): ProfilerOnRenderCallback {
  return (_id, _phase, actualDuration, baseDuration) => {
    log.commits += 1;
    log.actualDurationMs += actualDuration;
    log.baseDurationMs += baseDuration;
  };
}

/** Wrapper that hosts ultra-chess-react and exposes an imperative advance handle. */
function UltraHarness({
  onReady,
  profiler,
}: {
  onReady: (advance: (from: SquareIndex, to: SquareIndex) => void) => void;
  profiler: ProfilerOnRenderCallback;
}): ReactNode {
  const [model, setModel] = useState<BoardModel | null>(null);
  const readyRef = useRef(false);
  useEffect(() => {
    let disposed = false;
    createUltrachessAdapter().then((adapter) => {
      if (disposed) {
        adapter.dispose();
        return;
      }
      const m = createBoardModel(adapter);
      setModel(m);
    });
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (model !== null && !readyRef.current) {
      readyRef.current = true;
      onReady((from, to) => {
        model.tryMove(from, to);
      });
    }
  }, [model, onReady]);
  return (
    <Profiler id="ultra" onRender={profiler}>
      <UltraChessboard game={model} sound={false} animation={{ durationMs: 0 }} />
    </Profiler>
  );
}

/** Wrapper that hosts react-chessboard and exposes an imperative advance handle. */
function RcbHarness({
  onReady,
  profiler,
}: {
  onReady: (advance: (from: string, to: string) => void) => void;
  profiler: ProfilerOnRenderCallback;
}): ReactNode {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const readyRef = useRef(false);
  const advance = useCallback((from: string, to: string) => {
    chessRef.current.move({ from, to, promotion: "q" });
    setFen(chessRef.current.fen());
  }, []);
  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onReady(advance);
    }
  }, [advance, onReady]);
  return (
    <Profiler id="rcb" onRender={profiler}>
      <RcbChessboard options={{ position: fen, showAnimations: false }} />
    </Profiler>
  );
}

/** Wait for onReady to fire by polling the ref — simpler than event plumbing. */
async function waitFor(cond: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error("timeout waiting for harness ready");
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function runUltra(): Promise<{ mount: ProfileLog; play: ProfileLog }> {
  const mount = newLog();
  const play = newLog();
  let currentLog = mount;
  const profiler: ProfilerOnRenderCallback = (a, b, c, d, e, f) =>
    profile(currentLog)(a, b, c, d, e, f);

  let advanceRef: ((f: SquareIndex, t: SquareIndex) => void) | null = null;
  render(
    <StrictMode>
      <UltraHarness
        onReady={(advance) => {
          advanceRef = advance;
        }}
        profiler={profiler}
      />
    </StrictMode>,
  );
  await waitFor(() => advanceRef !== null);
  // Switch the accumulator — everything after this is "play" cost.
  currentLog = play;
  for (const [from, to] of GAME_40) {
    await act(async () => {
      advanceRef?.(sqIndex(from), sqIndex(to));
    });
  }
  return { mount, play };
}

async function runRcb(): Promise<{ mount: ProfileLog; play: ProfileLog }> {
  const mount = newLog();
  const play = newLog();
  let currentLog = mount;
  const profiler: ProfilerOnRenderCallback = (a, b, c, d, e, f) =>
    profile(currentLog)(a, b, c, d, e, f);

  let advanceRef: ((f: string, t: string) => void) | null = null;
  render(
    <StrictMode>
      <RcbHarness
        onReady={(advance) => {
          advanceRef = advance;
        }}
        profiler={profiler}
      />
    </StrictMode>,
  );
  await waitFor(() => advanceRef !== null);
  currentLog = play;
  for (const [from, to] of GAME_40) {
    await act(async () => {
      advanceRef?.(from, to);
    });
  }
  return { mount, play };
}

describe("render-budget bench — UltraChessReact vs react-chessboard", () => {
  test("measure and emit bench-results/render.json", async () => {
    const ultra = await runUltra();
    const rcb = await runRcb();

    const plys = GAME_40.length;
    const report = {
      runtime: "vitest + happy-dom",
      plys,
      mount: {
        ultra: ultra.mount,
        rcb: rcb.mount,
      },
      play: {
        ultra: {
          ...ultra.play,
          commitsPerMove: Number((ultra.play.commits / plys).toFixed(2)),
          msPerMove: Number((ultra.play.actualDurationMs / plys).toFixed(3)),
        },
        rcb: {
          ...rcb.play,
          commitsPerMove: Number((rcb.play.commits / plys).toFixed(2)),
          msPerMove: Number((rcb.play.actualDurationMs / plys).toFixed(3)),
        },
      },
    };

    const outPath = resolve(resultsDir, "render.json");
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

    process.stdout.write(
      `\n\nrender-budget results (40-ply game replay):\n${JSON.stringify(report, null, 2)}\n`,
    );

    // Light assertions so CI fails loudly on regressions.
    expect(report.play.ultra.commitsPerMove).toBeLessThanOrEqual(8);
    expect(report.play.ultra.actualDurationMs).toBeLessThan(report.play.rcb.actualDurationMs);
  }, 60_000);
});
