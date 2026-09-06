"use client";

/**
 * Built-in promotion dialog.
 *
 * Rendered only while a promotion is pending. Shows the four promotion
 * options (Queen, Rook, Bishop, Knight) stacked on the target square,
 * with the queen on the promoting side.
 *
 * ### UX contract
 *
 * - Primary pointer click on a choice resolves the promotion.
 * - <kbd>Q</kbd>, <kbd>R</kbd>, <kbd>B</kbd>, <kbd>N</kbd> keyboard
 *   shortcuts resolve without moving focus.
 * - <kbd>Escape</kbd> or a click outside the dialog cancels the move.
 * - `role="dialog"` with `aria-modal="true"` + labelled title, so screen
 *   readers announce the choice prompt.
 *
 * Rendered inside the Chessboard container so theme CSS variables (for
 * piece glyphs) are in scope.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type BoardCell,
  type Color,
  encodeBoardCell,
  PieceType,
  type SquareIndex,
} from "../core/index.js";
import { CSS_VARS } from "../default-theme.js";
import type { Orientation, PieceRenderer } from "../types.js";

/** Props for {@link PromotionOverlay}. */
export interface PromotionOverlayProps {
  readonly from: SquareIndex;
  readonly to: SquareIndex;
  readonly color: 0 | 1;
  readonly orientation: Orientation;
  readonly pieces: PieceRenderer;
  readonly onSelect: (piece: PieceType) => void;
  readonly onCancel: () => void;
  readonly getPromotionPieceAriaLabel?: ((piece: PieceType, color: Color) => string) | undefined;
}

/** Pixel position of a square within the board, as `{ x%, y% }`. */
function positionOf(
  index: SquareIndex,
  orientation: Orientation,
): {
  x: number;
  y: number;
} {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { x: col * 12.5, y: row * 12.5 };
}

/** Order pieces offer (Chess.com order: Queen, Knight, Rook, Bishop). */
const CHOICE_ORDER: readonly PieceType[] = [
  PieceType.Queen,
  PieceType.Knight,
  PieceType.Rook,
  PieceType.Bishop,
];

/** Map from keyboard shortcut to piece type. */
const SHORTCUTS: Readonly<Record<string, PieceType>> = {
  q: PieceType.Queen,
  r: PieceType.Rook,
  b: PieceType.Bishop,
  n: PieceType.Knight,
  Q: PieceType.Queen,
  R: PieceType.Rook,
  B: PieceType.Bishop,
  N: PieceType.Knight,
};

export function PromotionOverlay({
  from: _from,
  to,
  color,
  orientation,
  pieces,
  onSelect,
  onCancel,
  getPromotionPieceAriaLabel,
}: PromotionOverlayProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const getLabel = useCallback(
    (piece: PieceType): string =>
      getPromotionPieceAriaLabel
        ? getPromotionPieceAriaLabel(piece, color as Color)
        : pieceName(piece),
    [getPromotionPieceAriaLabel, color],
  );

  const [activeAnnouncement, setActiveAnnouncement] = useState<string>(() =>
    getLabel(CHOICE_ORDER[0] ?? PieceType.Queen),
  );

  // Auto-focus the primary promotion option on open
  useEffect(() => {
    buttonRefs.current[0]?.focus();
  }, []);

  // Keyboard navigation, shortcuts, Escape, and focus trapping
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const activeEl = document.activeElement as HTMLButtonElement | null;
        const currentIdx = buttonRefs.current.indexOf(activeEl);
        let nextIdx: number;
        if (e.shiftKey) {
          nextIdx = currentIdx <= 0 ? buttonRefs.current.length - 1 : currentIdx - 1;
        } else {
          nextIdx = currentIdx >= buttonRefs.current.length - 1 ? 0 : currentIdx + 1;
        }
        buttonRefs.current[nextIdx]?.focus();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const activeEl = document.activeElement as HTMLButtonElement | null;
        const currentIdx = buttonRefs.current.indexOf(activeEl);
        const nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % CHOICE_ORDER.length;
        buttonRefs.current[nextIdx]?.focus();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const activeEl = document.activeElement as HTMLButtonElement | null;
        const currentIdx = buttonRefs.current.indexOf(activeEl);
        const prevIdx = currentIdx <= 0 ? CHOICE_ORDER.length - 1 : currentIdx - 1;
        buttonRefs.current[prevIdx]?.focus();
        return;
      }

      if (e.key === "Home") {
        e.preventDefault();
        buttonRefs.current[0]?.focus();
        return;
      }

      if (e.key === "End") {
        e.preventDefault();
        buttonRefs.current[CHOICE_ORDER.length - 1]?.focus();
        return;
      }

      const choice = SHORTCUTS[e.key];
      if (choice !== undefined) {
        e.preventDefault();
        onSelect(choice);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect, onCancel]);

  const targetPos = positionOf(to, orientation);
  // Black-side promotion stacks upward; white-side stacks downward.
  // For a black pawn promoting on rank 0 in white orientation, the target
  // square visually sits at the bottom (row 7) — the dialog grows upward so
  // rook/bishop/knight don't fall off-board.
  const promotingColorIsBlack = color === 1;
  const stackUpward = orientation === "white" ? promotingColorIsBlack : !promotingColorIsBlack;

  return (
    <div
      role="presentation"
      data-layer="promotion-overlay"
      onClick={onCancel}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(0, 0, 0, 0.35)",
        zIndex: 30,
        cursor: "pointer",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Choose promotion piece at ${algebraicOf(to)}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: `${targetPos.x}%`,
          top: `${stackUpward ? targetPos.y - 12.5 * 3 : targetPos.y}%`,
          width: "12.5%",
          height: `${12.5 * 4}%`,
          display: "flex",
          flexDirection: stackUpward ? "column-reverse" : "column",
          background: "#ffffff",
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.28)",
          borderRadius: "4px",
          overflow: "hidden",
        }}
      >
        {CHOICE_ORDER.map((piece, index) => {
          const cell = encodeBoardCell(color as Color, piece) as BoardCell;
          const label = getLabel(piece);
          return (
            <button
              key={piece}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              onClick={() => onSelect(piece)}
              onFocus={() => setActiveAnnouncement(label)}
              aria-label={label}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                margin: 0,
                font: "inherit",
                containerType: "size",
              }}
              data-promotion-piece={pieceName(piece)}
            >
              {pieces({ cell, square: to })}
            </button>
          );
        })}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true" style={srOnlyStyle}>
        {activeAnnouncement}
      </span>
      <span className="sr-only" style={srOnlyStyle}>
        Choose a promotion piece with Q, N, R, or B, or arrow keys. Press Escape to cancel.
      </span>
    </div>
  );
}

/** Ultra-minimal visually-hidden style for the sr-only announcement. */
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

function pieceName(t: PieceType): string {
  switch (t) {
    case PieceType.Queen:
      return "Queen";
    case PieceType.Rook:
      return "Rook";
    case PieceType.Bishop:
      return "Bishop";
    case PieceType.Knight:
      return "Knight";
    default:
      return "Piece";
  }
}

function algebraicOf(index: SquareIndex): string {
  const file = index & 7;
  const rank = index >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

// Prevent an unused-import warning when CSS_VARS is only referenced in docs.
void CSS_VARS;
