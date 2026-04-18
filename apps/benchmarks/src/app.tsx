/**
 * `apps/benchmarks` is primarily a **scripted** benchmark harness — the
 * real numbers come from:
 *
 *   bun run bench:core    # Node microbenchmarks vs chess.js
 *   bun run bench:render  # React Profiler vs react-chessboard
 *
 * This Vite app is a browser playground for manual profiling in Chrome
 * DevTools: mount a live board, record a Performance trace, and drill
 * into commits / long tasks / paint. It is intentionally minimal.
 */

import { neo } from "@ultrachess/pieces/neo";
import { Chessboard, useChessGame } from "@ultrachess/react";
import { green } from "@ultrachess/themes/green";

export function App() {
  const game = useChessGame();
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
      <Chessboard game={game} theme={green} pieces={neo} />
    </main>
  );
}
