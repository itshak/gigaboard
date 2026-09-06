"use client";

/**
 * A single static board square.
 *
 * Static in content — dynamic highlights and pieces live on sibling
 * overlays (piece layer, arrows canvas, drag ghost), so a square
 * renders exactly once per mount except when its `isFocused` prop
 * flips. This preserves the "0 re-renders per hover" budget in
 * PERFORMANCE.md.
 *
 * ### ARIA grid pattern
 *
 * - `role="gridcell"` with algebraic `aria-label` so screen readers
 *   announce "square e4".
 * - `aria-rowindex` / `aria-colindex` let assistive tech describe the
 *   cell's grid position without relying on row groups in the DOM.
 * - Roving tabindex: the one focused cell has `tabindex=0`, every other
 *   cell has `tabindex=-1`. Tab steps into the board once, then out.
 * - When the `isFocused` prop flips to `true` **and the board already
 *   owns DOM focus** (arrow-key nav), the cell programmatically focuses
 *   itself. The initial "seed" of `focusedSquare` on mount does **not**
 *   move DOM focus, so the board stays dormant until the user engages.
 *
 * ### Focus ring is painted via `:focus-visible`, not inline
 *
 * The amber focus ring used to ship as an always-on inline `boxShadow`
 * keyed off the `isFocused` prop, which meant the square that held the
 * roving `tabindex=0` showed the ring on page load — even when the user
 * had never touched the board. The ring now ships as a CSS rule that
 * only matches `:focus-visible`, so browser heuristics keep it hidden
 * for mouse / pointer interaction and surface it only when the user is
 * actually navigating with the keyboard.
 *
 * ### Selection + legal-target highlights are NOT rendered here
 *
 * Chessground-style: a `useSelectionController` hook sets the
 * `data-gb-selection` attribute on this `<div>` imperatively, and the
 * CSS shipped by `injectSelectionStyles()` paints a `::before`
 * pseudo-element overlay. That bypasses React reconciliation entirely
 * on selection changes — critical for the drag-start peak frame.
 *
 * To support that, the square uses `backgroundColor` (the `color` part
 * of the CSS `background` shorthand) rather than the full `background`
 * shorthand — which would otherwise reset `background-image` to `none`
 * and wipe out any CSS-set gradient overlay.
 */

import type { BoardCell, BoardModel, SquareIndex } from "../core/index.js";
import { memo, type ReactNode, useCallback, useEffect, useRef } from "react";
import { CSS_VARS } from "../default-theme.js";
import { useSquareCell } from "../hooks/use-board-subscription.js";
import type { SquareContext } from "../types.js";

/** Singleton id used to dedupe the injected focus-ring style element. */
const FOCUS_STYLE_ID = "gb-focus-ring-styles";

/**
 * Inject the keyboard-focus ring CSS once per document. SSR-safe
 * (early-returns when there's no `document`). The rule uses
 * `:focus-visible` so the ring only appears for genuine keyboard
 * navigation — page-load hydration, programmatic focus without prior
 * keyboard activity, and pointer clicks all keep it hidden.
 */
function injectFocusRingStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(FOCUS_STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = FOCUS_STYLE_ID;
  style.textContent = `
[data-gb-square]:focus-visible {
  box-shadow: inset 0 0 0 3px rgba(255, 206, 76, 0.95);
}
`;
  document.head.appendChild(style);
}

/** Algebraic name (`"a1"`, `"h8"`, …) for a square index. */
function algebraicOf(index: SquareIndex): string {
  const file = index & 7;
  const rank = index >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}

/** Props for {@link Square}. */
export interface SquareProps {
  readonly index: SquareIndex;
  readonly onClick: (index: SquareIndex) => void;
  readonly renderSquare?: ((ctx: SquareContext) => ReactNode) | undefined;
  /**
   * `true` for the single square that currently owns the roving tabindex.
   * When this flips to `true`, the cell focuses itself programmatically.
   */
  readonly isFocused: boolean;
  /**
   * Stable setter called with `(index, element | null)` whenever the
   * square's DOM node mounts or unmounts. Consumers (the selection
   * controller) use this to build a 64-entry refs array so they can
   * write `data-gb-selection` imperatively on the right square.
   */
  readonly setSquareRef?: ((index: SquareIndex, el: HTMLElement | null) => void) | undefined;
  readonly model?: BoardModel | null | undefined;
  readonly getSquareAriaLabel?: ((square: SquareIndex, cell: BoardCell) => string) | undefined;
  readonly onFocus?: ((square: SquareIndex, cell: BoardCell) => void) | undefined;
}

function SquareImpl({
  index,
  onClick,
  renderSquare,
  isFocused,
  setSquareRef,
  model,
  getSquareAriaLabel,
  onFocus,
}: SquareProps) {
  const file = index & 7;
  const rank = index >> 3;
  const isLight = (file + rank) % 2 === 1;
  const cell = useSquareCell(model, index) as BoardCell;
  const label = getSquareAriaLabel ? getSquareAriaLabel(index, cell) : algebraicOf(index);

  const internalRef = useRef<HTMLDivElement | null>(null);
  const lastReportedFocusRef = useRef<boolean>(false);

  // Stable ref-setter: React only calls it when the DOM node
  // mounts/unmounts, not per render, so `memo`'s prop-diff stays valid.
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      internalRef.current = el;
      setSquareRef?.(index, el);
    },
    [index, setSquareRef],
  );

  // One-time CSS injection for the `:focus-visible` ring. Idempotent
  // across remounts via a singleton `<style>` id.
  useEffect(() => {
    injectFocusRingStyles();
  }, []);

  // When focus state flips to `true`, move DOM focus to this cell — but
  // ONLY if the board already contains focus. That gate prevents the
  // initial roving-tabindex seed (which happens after mount) from
  // stealing page focus on load. Once the user has actually entered the
  // board via Tab or click, this effect takes over for arrow-key nav.
  useEffect(() => {
    if (!isFocused) {
      lastReportedFocusRef.current = false;
      return;
    }
    const el = internalRef.current;
    if (el === null) return;
    const grid = el.closest('[role="grid"]');
    if (grid === null) return;
    if (!grid.contains(document.activeElement)) return;
    // Only focus if we aren't already, to avoid thrashing.
    if (document.activeElement !== el) el.focus();
    if (!lastReportedFocusRef.current) {
      lastReportedFocusRef.current = true;
      onFocus?.(index, cell);
    }
  }, [isFocused, index, cell, onFocus]);

  const handleFocus = useCallback(() => {
    lastReportedFocusRef.current = true;
    onFocus?.(index, cell);
  }, [index, cell, onFocus]);

  const handleClick = (): void => onClick(index);

  return (
    <div
      ref={setRef}
      role="gridcell"
      aria-label={label}
      aria-rowindex={rank + 1}
      aria-colindex={file + 1}
      tabIndex={isFocused ? 0 : -1}
      data-square={algebraicOf(index)}
      data-gb-square=""
      data-light={isLight ? "true" : "false"}
      onClick={handleClick}
      onFocus={handleFocus}
      style={{
        position: "relative",
        // `backgroundColor` (not the `background` shorthand) so the
        // CSS `background-image` set by `useSelectionController` can
        // layer on top without clobbering this base colour.
        backgroundColor: `var(${isLight ? CSS_VARS.SQ_LIGHT : CSS_VARS.SQ_DARK})`,
        // Cursor is managed by `useCursorController` via injected CSS so
        // it can flip between `pointer` / `grab` / `grabbing` without a
        // React re-render per hover.
        userSelect: "none",
        // Suppress the browser's default focus ring; the keyboard focus
        // indicator ships via `:focus-visible` (see `injectFocusRingStyles`).
        outline: "none",
        // Squares carry the container-query context so pieces inside can
        // size relative to this cell (85cqh glyph sizing).
        containerType: "size",
      }}
    >
      {renderSquare !== undefined ? renderSquare({ index, isLight, label }) : null}
    </div>
  );
}

/**
 * Memoised square. All props are primitives or stable callbacks — memo
 * skips re-render for every square whose `isFocused` flag didn't flip,
 * so arrow-key navigation re-renders exactly 2 squares (old + new).
 */
export const Square = memo(SquareImpl);
Square.displayName = "Square";
