"use client";

/**
 * Visually-hidden screen-reader announcer.
 *
 * Subscribes to `snapshot.lastMove` and emits a concise, descriptive
 * announcement each time a move lands. Uses `aria-live="polite"` so the
 * announcement is queued after any critical output the user is already
 * reading, not interrupted mid-word.
 *
 * ### Why descriptive text instead of SAN?
 *
 * SAN ("Nf3", "exd5", "O-O") is concise but not pronounceable by screen
 * readers in a way players recognise. "Knight to f3" reads out as
 * "Knight to eff three", which is what a chess commentator would say.
 * We compose the announcement from the packed move + the post-move board
 * snapshot so no extra engine call is required.
 */

import { useMemo } from "react";
import { type BoardModel, decodePackedMove, type PackedMove } from "../core/index.js";
import { useBoardSlice } from "../hooks/use-board-subscription.js";

/** 0-indexed square → algebraic (`"e4"`). */
function algebraicOf(index: number): string {
  const file = index & 7;
  const rank = index >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

/** Readable piece name for a board cell. Empty cell returns `"piece"`. */
function pieceName(cell: number): string {
  if (cell === 0) return "piece";
  const color = cell > 6 ? "black" : "white";
  const type = (cell - 1) % 6;
  switch (type) {
    case 0:
      return `${color} pawn`;
    case 1:
      return `${color} knight`;
    case 2:
      return `${color} bishop`;
    case 3:
      return `${color} rook`;
    case 4:
      return `${color} queen`;
    case 5:
      return `${color} king`;
    default:
      return `${color} piece`;
  }
}

/** Build the announcement string from the last packed move + board state. */
function announcementFor(
  lastMove: PackedMove,
  board: Readonly<Uint8Array>,
  wasCapture: boolean,
): string {
  const { from, to, kind, promotion } = decodePackedMove(lastMove);

  if (kind === "castle") {
    const isKingside = (to & 7) > (from & 7);
    return isKingside ? "Castles kingside." : "Castles queenside.";
  }

  // Post-move board[to] holds the piece that just moved (or promoted to).
  const landed = board[to] ?? 0;
  const name = pieceName(landed);
  const fromSq = algebraicOf(from);
  const toSq = algebraicOf(to);

  if (kind === "promotion" && promotion !== null) {
    const promoted =
      promotion === 1 ? "knight" : promotion === 2 ? "bishop" : promotion === 3 ? "rook" : "queen";
    const action = wasCapture ? "captures and promotes" : "promotes";
    return `Pawn ${fromSq} ${action} to ${promoted} on ${toSq}.`;
  }

  if (kind === "en-passant") {
    return `${capitalise(name)} ${fromSq} captures en passant on ${toSq}.`;
  }

  if (wasCapture) {
    return `${capitalise(name)} ${fromSq} captures on ${toSq}.`;
  }

  return `${capitalise(name)} ${fromSq} to ${toSq}.`;
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}

/** Visually-hidden style block (the `sr-only` pattern). */
const srOnlyStyle = {
  position: "absolute" as const,
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap" as const,
  border: 0,
};

/** Props for {@link LiveRegion}. */
export interface LiveRegionProps {
  readonly model: BoardModel;
}

/**
 * Subscribes to `lastMove` + `board` + `lastAnimations` and renders a
 * visually-hidden `aria-live="polite"` region with a human-readable
 * description of the most recent move.
 */
export function LiveRegion({ model }: LiveRegionProps) {
  // Subscribe to `lastMove` only. The board bytes relevant to the
  // announcement (the `to` square) are read lazily inside the memo via
  // `getSnapshot()`, so we never wake on unrelated commits (arrow draw,
  // selection change, etc.) and never subscribe to a Uint8Array whose
  // identity is kept across commits — both of those were quiet no-ops
  // before and are gone now, one less thing for React to schedule.
  const lastMove = useBoardSlice(model, (s) => s.lastMove);

  const message = useMemo(() => {
    if (lastMove === null) return "";
    // Capture detection: inspect the just-emitted animation descriptors.
    // `lastAnimations` isn't part of the snapshot object but is stable
    // across the same commit, so reading it here is safe.
    const wasCapture = model.lastAnimations.some(
      (d) => d.kind === "capture" || d.kind === "en-passant",
    );
    return announcementFor(lastMove, model.getSnapshot().board, wasCapture);
  }, [lastMove, model]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-layer="live-region"
      style={srOnlyStyle}
    >
      {message}
    </div>
  );
}
