/**
 * Analysis board example.
 *
 * A Stockfish-backed position explorer: drag or click to make moves, the
 * engine streams an evaluation, best line, and a green "best move" arrow
 * that repaints on every position change. Mirrors the react-chessboard
 * docs' "Analysis Board" story — see `./analysis-board.tsx` for details.
 */

import { AnalysisBoard } from "./analysis-board";

export default function Page() {
  return (
    <main
      style={{
        maxWidth: "1120px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
        fontFamily: "system-ui, sans-serif",
        color: "#cfd3da",
        background: "#0b0e14",
        minHeight: "100vh",
      }}
    >
      <header style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem" }}>Analysis board</h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>
          Stockfish-powered evaluation · drag to move · undo / redo supported
        </p>
      </header>
      <AnalysisBoard />
    </main>
  );
}
