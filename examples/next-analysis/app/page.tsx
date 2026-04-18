/**
 * Analysis board example — SSR-static board from a FEN.
 *
 * This whole page is a React Server Component: it imports
 * `@ultrachess/react/server` and ships **zero** client JavaScript for the
 * board itself.
 */

import { StaticChessboard } from "@ultrachess/react/server";

// Tactical puzzle: Scholar's-mate motif.
const POSITION = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";

export default function Page() {
  return (
    <main
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "2rem 1rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Static analysis board</h1>
      <p style={{ color: "#555" }}>
        This board is a React Server Component. No client JavaScript is sent to your browser for the
        board itself — only the prose and layout.
      </p>
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        <StaticChessboard fen={POSITION} />
      </div>
    </main>
  );
}
