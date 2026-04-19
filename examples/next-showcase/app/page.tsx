import { Showcase } from "./showcase";

/**
 * Comprehensive integration: a single page that exercises every configurable
 * knob on `<Chessboard/>` — themes, piece sets, sound, premoves, arrows,
 * animations, illegal-move feedback, orientation, and live move logging.
 */
export default function Page() {
  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
      }}
    >
      <header style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.75rem", letterSpacing: "-0.01em" }}>
          Ultra Chess React — showcase
        </h1>
        <p
          style={{
            margin: "0.5rem 0 0",
            color: "#9aa0a6",
            fontSize: "0.95rem",
            lineHeight: 1.5,
          }}
        >
          Every knob exposed by <code>&lt;Chessboard/&gt;</code>, wired to live controls. Play a few
          moves, flip the theme, queue a premove, or paste in a FEN.
        </p>
      </header>
      <Showcase />
    </main>
  );
}
