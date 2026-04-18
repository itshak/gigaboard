"use client";

/**
 * Highlight overlays: selection rings, legal-target markers, last-move tint.
 *
 * Two sibling layers so each re-renders only when its own slice changes:
 *
 * - {@link SelectionLayer}: subscribes to `selected` + `legalTargets`.
 *   Changes together on every `selectSquare` / `tryMove`.
 * - {@link LastMoveLayer}: subscribes to `lastMove`. Changes only on a
 *   successful `tryMove` or history navigation.
 *
 * Both layers are absolute-positioned and declared `pointer-events: none`
 * so they never intercept clicks — the square grid beneath owns that.
 */

import type { BoardModel, SquareIndex } from "@ultrachess/core";
import { CSS_VARS } from "../default-theme.js";
import type { LegalTargetStyle, Orientation } from "../types.js";
import { useBoardSlice } from "../hooks/use-board-subscription.js";

/** Pack the `(selected, legalTargets)` pair into a referentially-stable slice. */
function selectSelection(snapshot: {
  selected: SquareIndex | null;
  legalTargets: ReadonlySet<SquareIndex>;
}): { selected: SquareIndex | null; legalTargets: ReadonlySet<SquareIndex> } {
  return { selected: snapshot.selected, legalTargets: snapshot.legalTargets };
}

/** Convert a square index to `(x%, y%)` top-left within the board. */
function positionOf(index: SquareIndex, orientation: Orientation): { x: number; y: number } {
  const file = index & 7;
  const rank = index >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return { x: col * 12.5, y: row * 12.5 };
}

/** Props shared by every highlight layer. */
interface LayerProps {
  readonly model: BoardModel;
  readonly orientation: Orientation;
}

/* ============================================================ SelectionLayer */

/** Props for {@link SelectionLayer}. */
export interface SelectionLayerProps extends LayerProps {
  readonly style: LegalTargetStyle;
}

/**
 * Renders the "selected" square tint and legal-target rings/dots.
 *
 * Subscribes to `(selected, legalTargets)`. When neither is present (no
 * active selection), renders nothing and adds no DOM. When a piece is
 * picked up, draws one tint under the origin square and one marker per
 * legal target.
 */
export function SelectionLayer({ model, orientation, style }: SelectionLayerProps) {
  // The snapshot guarantees a stable `(selected, legalTargets)` pair when the
  // selection didn't change — but we still build a fresh object in the
  // selector, so we narrow on the primitive `selected` and avoid re-renders
  // on other commits by reading each field independently.
  const selected = useBoardSlice(model, (s) => s.selected);
  const legalTargets = useBoardSlice(model, (s) => s.legalTargets);
  const board = useBoardSlice(model, (s) => s.board);

  if (selected === null || style === false) return null;

  const originPos = positionOf(selected, orientation);

  return (
    <div
      data-layer="selection"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {/* Selected-square tint */}
      <div
        style={{
          position: "absolute",
          left: `${originPos.x}%`,
          top: `${originPos.y}%`,
          width: "12.5%",
          height: "12.5%",
          background: `var(${CSS_VARS.SELECTED})`,
        }}
      />
      {Array.from(legalTargets).map((target) => {
        const { x, y } = positionOf(target, orientation);
        const isCapture = (board[target] ?? 0) !== 0;
        return (
          <div
            key={target}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: "12.5%",
              height: "12.5%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {style === "rings" ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  boxSizing: "border-box",
                  borderRadius: "50%",
                  border: isCapture
                    ? `10% solid var(${CSS_VARS.LEGAL_TARGET_CAPTURE})`
                    : "none",
                  // Non-capture: small inner dot; capture: full-size ring.
                  background: isCapture
                    ? "transparent"
                    : `radial-gradient(var(${CSS_VARS.LEGAL_TARGET}) 22%, transparent 24%)`,
                }}
              />
            ) : (
              // "dots" style: small filled dot, capture shows a larger one.
              <div
                style={{
                  width: isCapture ? "40%" : "28%",
                  height: isCapture ? "40%" : "28%",
                  borderRadius: "50%",
                  background: isCapture
                    ? `var(${CSS_VARS.LEGAL_TARGET_CAPTURE})`
                    : `var(${CSS_VARS.LEGAL_TARGET})`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================= LastMoveLayer */

/** Props for {@link LastMoveLayer}. */
export interface LastMoveLayerProps extends LayerProps {}

/**
 * Renders a translucent tint on the from / to squares of the last move.
 *
 * Subscribes only to `lastMove`. When it's null (initial position or after
 * a reset / load), renders nothing.
 */
export function LastMoveLayer({ model, orientation }: LastMoveLayerProps) {
  const lastMove = useBoardSlice(model, (s) => s.lastMove);
  if (lastMove === null) return null;

  const from = (lastMove & 0x3f) as SquareIndex;
  const to = ((lastMove >> 6) & 0x3f) as SquareIndex;
  const fromPos = positionOf(from, orientation);
  const toPos = positionOf(to, orientation);

  return (
    <div
      data-layer="last-move"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${fromPos.x}%`,
          top: `${fromPos.y}%`,
          width: "12.5%",
          height: "12.5%",
          background: `var(${CSS_VARS.LAST_MOVE})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${toPos.x}%`,
          top: `${toPos.y}%`,
          width: "12.5%",
          height: "12.5%",
          background: `var(${CSS_VARS.LAST_MOVE})`,
        }}
      />
    </div>
  );
}

// Reference for shape-only compatibility checkers.
void selectSelection;
