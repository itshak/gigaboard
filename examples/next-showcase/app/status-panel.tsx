"use client";

import { useBoardSnapshot } from "gigaboard";
import type { BoardModel } from "gigaboard/core";
import { buttonGhostStyle, buttonPrimaryStyle } from "./showcase";

interface Props {
  readonly game: BoardModel | null;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly onReset: () => void;
}

export function StatusPanel({ game, onUndo, onRedo, onReset }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        background: "#151821",
        border: "1px solid #232836",
        borderRadius: "8px",
        padding: "0.75rem 1rem",
        flexWrap: "wrap",
      }}
    >
      {game ? <LiveStatus game={game} /> : <span style={{ color: "#6b7280" }}>Loading…</span>}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button type="button" onClick={onUndo} style={buttonGhostStyle} disabled={!game}>
          Undo
        </button>
        <button type="button" onClick={onRedo} style={buttonGhostStyle} disabled={!game}>
          Redo
        </button>
        <button type="button" onClick={onReset} style={buttonPrimaryStyle}>
          Reset
        </button>
      </div>
    </div>
  );
}

function LiveStatus({ game }: { readonly game: BoardModel }) {
  // Subscribe to the full snapshot; this panel is cheap to re-render.
  const snap = useBoardSnapshot(game);

  const turn = snap.turn === 0 ? "White" : "Black";
  const state = snap.isGameOver
    ? "Game over"
    : snap.inCheck
      ? `${turn} in check`
      : `${turn} to move`;

  return (
    <div
      style={{
        display: "flex",
        gap: "0.85rem",
        alignItems: "center",
        flexWrap: "wrap",
        fontSize: "0.85rem",
        color: "#cfd3da",
      }}
    >
      <Dot color={snap.isGameOver ? "#ef4444" : snap.inCheck ? "#f59e0b" : "#22c55e"} />
      <span>{state}</span>
      <span style={{ color: "#6b7280" }}>
        ply {snap.historyPly}/{snap.historyLength}
      </span>
      {snap.premoves.length > 0 ? (
        <span style={{ color: "#60a5fa" }}>
          premove{snap.premoves.length === 1 ? "" : "s"} queued: {snap.premoves.length}
        </span>
      ) : null}
    </div>
  );
}

function Dot({ color }: { readonly color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: color,
      }}
    />
  );
}
