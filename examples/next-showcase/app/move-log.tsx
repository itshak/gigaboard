"use client";

import type { PackedMove, SquareIndex } from "@gigaboard/core";

interface Props {
  readonly moves: readonly PackedMove[];
}

export function MoveLog({ moves }: Props) {
  return (
    <div
      style={{
        background: "#151821",
        border: "1px solid #232836",
        borderRadius: "8px",
        padding: "0.85rem 1rem",
      }}
    >
      <h3
        style={{
          margin: "0 0 0.5rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#8a92a3",
        }}
      >
        Moves ({moves.length})
      </h3>
      {moves.length === 0 ? (
        <div style={{ color: "#6b7280", fontSize: "0.85rem" }}>
          Make a move to see it logged here.
        </div>
      ) : (
        <ol
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "auto 1fr 1fr",
            columnGap: "0.6rem",
            rowGap: "0.2rem",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "0.82rem",
            maxHeight: "260px",
            overflowY: "auto",
          }}
        >
          {pairUp(moves).map(([white, black], idx) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
            <li key={idx} style={rowStyle}>
              <span style={{ color: "#6b7280" }}>{idx + 1}.</span>
              <span style={{ color: "#cfd3da" }}>{white}</span>
              <span style={{ color: "#9aa0a6" }}>{black ?? ""}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const rowStyle = {
  display: "contents",
} as const;

function pairUp(moves: readonly PackedMove[]): Array<[string, string | null]> {
  const pairs: Array<[string, string | null]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    const w = moves[i];
    const b = moves[i + 1];
    pairs.push([formatMove(w as PackedMove), b === undefined ? null : formatMove(b)]);
  }
  return pairs;
}

/**
 * Fallback "long algebraic" formatter (e2-e4). The engine doesn't expose SAN
 * here, so we show from→to squares; enough to verify moves in the log.
 *
 * PackedMove layout (from @gigaboard/core): bits 0–5 = from, bits 6–11 = to.
 */
function formatMove(move: PackedMove): string {
  const from = (move & 0x3f) as SquareIndex;
  const to = ((move >>> 6) & 0x3f) as SquareIndex;
  return `${toAlgebraic(from)}${toAlgebraic(to)}`;
}

function toAlgebraic(index: SquareIndex): string {
  const file = index & 7;
  const rank = index >>> 3;
  return `${String.fromCharCode(97 + file)}${rank + 1}`;
}
