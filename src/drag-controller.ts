/**
 * Pointer-driven drag state machine.
 *
 * States: `idle → pending → dragging → idle`.
 *
 * - `pointerDown` on a source square moves us from `idle` to `pending`. We
 *   don't commit to "this is a drag" yet — a tap that releases without moving
 *   should remain a click.
 * - Once the pointer has moved more than `activationDistance` pixels (default
 *   `4`), we transition to `dragging` and emit a `drag-start` event. From
 *   there, every `pointerMove` updates the live `(x, y)`.
 * - `pointerUp` in `dragging` emits a `drop` event and returns to `idle`.
 *   `pointerUp` in `pending` (no drag happened) returns to `idle` silently.
 * - `cancel()` at any time returns to `idle` and emits a `cancel` event if a
 *   drag or pending pick was in flight.
 *
 * Events other than `pointerDown` that arrive with the "wrong" `pointerId`
 * are ignored — necessary on touch devices where multiple pointers may be
 * live simultaneously.
 *
 * The controller is a pure reducer that returns its output events. It does
 * **not** subscribe to the board model, and it performs zero DOM reads or
 * writes. The React layer is responsible for wiring `PointerEvent`s to these
 * methods and reacting to the returned events.
 */

import type { DragState, SquareIndex } from "./types.js";

/** The "activation" threshold: if the pointer hasn't moved this many pixels,
 *  releasing is treated as a click, not a drop. */
const DEFAULT_ACTIVATION_DISTANCE = 4;

/** Emitted when the pointer crosses `activationDistance` from its origin. */
export interface DragStartEvent {
  readonly kind: "drag-start";
  readonly from: SquareIndex;
}

/** Emitted while dragging, on every `pointerMove`. Coordinates are whatever
 *  the caller passed in (no DOM awareness — typically `clientX`/`clientY`). */
export interface DragMoveEvent {
  readonly kind: "drag-move";
  readonly from: SquareIndex;
  readonly x: number;
  readonly y: number;
}

/** Emitted on `pointerUp` in `dragging`. `wasDrag` is always `true` here. */
export interface DropEvent {
  readonly kind: "drop";
  readonly from: SquareIndex;
  readonly x: number;
  readonly y: number;
  readonly wasDrag: true;
}

/** Emitted on `pointerUp` in `pending` — the user clicked without dragging. */
export interface ClickEvent {
  readonly kind: "click";
  readonly from: SquareIndex;
}

/** Emitted by `cancel()` when a pending pick or an in-flight drag existed. */
export interface CancelEvent {
  readonly kind: "cancel";
  readonly from: SquareIndex;
}

/** Any event emitted by the drag controller. */
export type DragEvent =
  | DragStartEvent
  | DragMoveEvent
  | DropEvent
  | ClickEvent
  | CancelEvent;

/** Controller options. */
export interface DragControllerOptions {
  /** Distance threshold (in CSS pixels) for `pending → dragging`. Default 4. */
  readonly activationDistance?: number;
}

/** Public controller API. */
export interface DragController {
  /** The current drag state. Read-only. */
  readonly state: DragState;
  /**
   * Handle a pointer-down on a source square. Returns `true` if the event was
   * consumed (i.e. we were `idle` and are now `pending`); `false` otherwise.
   */
  pointerDown(from: SquareIndex, pointerId: number, x: number, y: number): boolean;
  /**
   * Handle a pointer-move. Returns the emitted event (`drag-start` on the
   * first crossing of the threshold, `drag-move` afterwards) or `null` if
   * the move did not produce one.
   */
  pointerMove(pointerId: number, x: number, y: number): DragStartEvent | DragMoveEvent | null;
  /**
   * Handle a pointer-up. Returns `drop` when a drag was in flight, `click`
   * when the user released without crossing the threshold, or `null` if the
   * event does not concern us.
   */
  pointerUp(pointerId: number, x: number, y: number): DropEvent | ClickEvent | null;
  /** Abort any pending or in-flight drag. Returns the emitted event, or
   *  `null` if there was nothing to cancel. */
  cancel(): CancelEvent | null;
}

/** Construct a fresh drag controller. */
export function createDragController(options: DragControllerOptions = {}): DragController {
  const activationDistance = options.activationDistance ?? DEFAULT_ACTIVATION_DISTANCE;
  if (!Number.isFinite(activationDistance) || activationDistance < 0) {
    throw new RangeError(
      `DragController: activationDistance must be a non-negative number, got ${activationDistance}`,
    );
  }
  const thresholdSq = activationDistance * activationDistance;
  let state: DragState = { kind: "idle" };

  const pointerDown = (from: SquareIndex, pointerId: number, x: number, y: number): boolean => {
    if (state.kind !== "idle") return false;
    state = { kind: "pending", from, pointerId, originX: x, originY: y };
    return true;
  };

  const pointerMove = (
    pointerId: number,
    x: number,
    y: number,
  ): DragStartEvent | DragMoveEvent | null => {
    if (state.kind === "idle") return null;
    if (state.pointerId !== pointerId) return null;

    if (state.kind === "pending") {
      const dx = x - state.originX;
      const dy = y - state.originY;
      if (dx * dx + dy * dy < thresholdSq) {
        return null;
      }
      const from = state.from;
      state = { kind: "dragging", from, pointerId, x, y };
      return { kind: "drag-start", from };
    }

    state = { kind: "dragging", from: state.from, pointerId, x, y };
    return { kind: "drag-move", from: state.from, x, y };
  };

  const pointerUp = (
    pointerId: number,
    x: number,
    y: number,
  ): DropEvent | ClickEvent | null => {
    if (state.kind === "idle") return null;
    if (state.pointerId !== pointerId) return null;

    if (state.kind === "dragging") {
      const event: DropEvent = { kind: "drop", from: state.from, x, y, wasDrag: true };
      state = { kind: "idle" };
      return event;
    }

    const event: ClickEvent = { kind: "click", from: state.from };
    state = { kind: "idle" };
    return event;
  };

  const cancel = (): CancelEvent | null => {
    if (state.kind === "idle") return null;
    const event: CancelEvent = { kind: "cancel", from: state.from };
    state = { kind: "idle" };
    return event;
  };

  return {
    get state() {
      return state;
    },
    pointerDown,
    pointerMove,
    pointerUp,
    cancel,
  };
}
