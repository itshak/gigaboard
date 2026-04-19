/**
 * Board geometry helpers.
 *
 * Pure, framework-agnostic utilities for mapping between viewport pixel
 * coordinates and `SquareIndex` (LERF 0..63). Single source of truth
 * consumed by {@link useDrag}, {@link useArrowGesture}, the spare-piece
 * drag hook, and any consumer who wants to hit-test the board from
 * custom React code (analysis overlays, piece tooltips, screenshots).
 *
 * No DOM mutation; no side effects. Each call reads
 * `container.getBoundingClientRect()` once — cheap but not free, so
 * hot-path callers should batch calls per pointer event.
 */
import type { SquareIndex } from "@ultrachess/core";
import type { Orientation } from "../types.js";

/**
 * Resolve a viewport point to the `SquareIndex` it lies inside, or
 * `null` when the point is outside the board rect.
 *
 * The hit-test assumes the container has 1:1 geometry with the 8×8 grid
 * — i.e. the outer `<div>` of `<Chessboard/>`. Coordinates/edge padding
 * layers do **not** sit inside a smaller sub-rect; they're overlays on
 * the same box.
 *
 * @param container The board container element.
 * @param clientX   `MouseEvent.clientX` / `PointerEvent.clientX`.
 * @param clientY   `MouseEvent.clientY` / `PointerEvent.clientY`.
 * @param orientation Board orientation (flips file/rank derivation).
 * @returns The square under the point, or `null` if out of bounds.
 */
export function getSquareAtPoint(
  container: HTMLElement,
  clientX: number,
  clientY: number,
  orientation: Orientation,
): SquareIndex | null {
  const rect = container.getBoundingClientRect();
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  if (relX < 0 || relY < 0 || relX >= rect.width || relY >= rect.height) return null;
  const col = Math.floor((relX / rect.width) * 8);
  const row = Math.floor((relY / rect.height) * 8);
  const file = orientation === "white" ? col : 7 - col;
  const rank = orientation === "white" ? 7 - row : row;
  return (rank * 8 + file) as SquareIndex;
}

/**
 * Inverse of {@link getSquareAtPoint}: the viewport point at the centre
 * of a given square, expressed in client (viewport) coordinates.
 *
 * Useful for drawing tooltips, floating annotations, or anchoring DOM
 * nodes against a specific square without sampling the actual DOM child.
 *
 * @param container The board container element.
 * @param square    Square index in LERF order.
 * @param orientation Board orientation.
 * @returns `{ x, y }` in viewport pixel coordinates.
 */
export function getPointAtSquareCentre(
  container: HTMLElement,
  square: SquareIndex,
  orientation: Orientation,
): { readonly x: number; readonly y: number } {
  const rect = container.getBoundingClientRect();
  const sqW = rect.width / 8;
  const sqH = rect.height / 8;
  const file = square & 7;
  const rank = square >> 3;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  return {
    x: rect.left + sqW * col + sqW / 2,
    y: rect.top + sqH * row + sqH / 2,
  };
}

/** Algebraic name (`"a1"`, `"h8"`, …) for a square index. */
export function algebraicOf(square: SquareIndex): string {
  const file = square & 7;
  const rank = square >> 3;
  return `${String.fromCharCode(0x61 + file)}${rank + 1}`;
}
