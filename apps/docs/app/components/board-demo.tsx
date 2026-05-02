"use client";

/**
 * Client leaf rendering the interactive board.
 *
 * Hosted inside a plain Next.js server page — the `"use client"` directive
 * here keeps the interactive JS scoped to this component. The surrounding
 * page stays RSC and ships zero JS for the prose.
 */

import { Chessboard, useChessGame } from "@ultrachess/react";
import { useState } from "react";

export function BoardDemo() {
  const game = useChessGame();
  const [orientation, setOrientation] = useState<"white" | "black">("white");

  return (
    <div>
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto 1rem auto",
        }}
      >
        <Chessboard game={game} orientation={orientation} />
      </div>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
        >
          Flip
        </button>
        <button type="button" onClick={() => game?.undo()}>
          Undo
        </button>
        <button type="button" onClick={() => game?.reset()}>
          Reset
        </button>
      </div>
    </div>
  );
}
