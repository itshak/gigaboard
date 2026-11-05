/**
 * FeelLab's test-build-only instrumentation. Only imported by apps/benchmarks;
 * never imported by or bundled in the published gigaboard library.
 * Times are browser event/DOM-write proxies, NOT physical input-to-photon latency.
 */
import { createDragController, type BoardModel, type SquareIndex } from "gigaboard/core";

export interface FeelEvent {
  readonly kind: string;
  readonly t: number;
  readonly x?: number;
  readonly y?: number;
  readonly value?: string;
}

export interface FeelLabAPI {
  readonly ready: true;
  events(): FeelEvent[];
  fen(): string;
  reset(fen?: string): void;
  resetEvents(): void;
  setCallbackDelay(ms: number): void;
  onMove(): void;
  moveCount(): number;
  /** Pure state-machine probe, not a rendered A/B test. */
  thresholdProbe(distancePx: number, samples: number[]): number | null;
  dispose(): void;
}

declare global {
  interface Window {
    __gbFeelLab__?: FeelLabAPI;
  }
}

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function installFeelLab(model: BoardModel, board: HTMLElement): FeelLabAPI {
  let events: FeelEvent[] = [];
  let moves = 0;
  let callbackDelay = 0;
  const now = () => performance.now();
  const record = (kind: string, extra: Partial<FeelEvent> = {}): void => {
    events.push({ kind, t: now(), ...extra });
  };
  const pointer = (e: PointerEvent): void => {
    const kind = e.type === "pointerdown" ? "pointer:down" :
      e.type === "pointerup" ? "pointer:up" :
      e.type === "pointercancel" ? "pointer:cancel" : "pointer:move";
    // Store only the most recent 4096 samples to prevent unbounded test memory.
    if (events.length > 4096) events = events.slice(-2048);
    record(kind, { x: e.clientX, y: e.clientY });
  };
  const pointerEvents = ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const;
  for (const name of pointerEvents) window.addEventListener(name, pointer, { capture: true, passive: true });

  const observer = new MutationObserver((changes) => {
    for (const change of changes) {
      if (change.type !== "attributes") continue;
      const target = change.target;
      if (!(target instanceof HTMLElement)) continue;
      if (target.matches('[data-layer="drag"]')) {
        if (change.attributeName === "style") {
          record("drag:style", { value: target.style.transform + "|" + target.style.opacity });
        } else if (change.attributeName === "data-active") {
          record("drag:active", { value: target.dataset["active"] ?? "" });
        }
      }
      if (target.hasAttribute("data-gb-square") && change.attributeName === "data-gb-selection") {
        record("selection:changed");
      }
    }
  });
  observer.observe(board, { subtree: true, attributes: true, attributeFilter: ["style", "data-active", "data-gb-selection"] });

  const api: FeelLabAPI = {
    ready: true,
    events: () => events.slice(),
    fen: () => model.engine.fen(),
    moveCount: () => moves,
    thresholdProbe(distancePx, samples) {
      const controller = createDragController({ activationDistance: distancePx });
      controller.pointerDown(12 as SquareIndex, 1, 0, 0);
      for (let i = 0; i < samples.length; i++) {
        const event = controller.pointerMove(1, samples[i] ?? 0, 0);
        if (event?.kind === "drag-start") return i;
      }
      return null;
    },
    resetEvents() { events = []; moves = 0; },
    setCallbackDelay(ms) {
      if (!Number.isFinite(ms) || ms < 0 || ms > 100) throw new RangeError("callback delay must be in [0,100]");
      callbackDelay = ms;
    },
    reset(fen = START_FEN) {
      model.load(fen);
      events = [];
      moves = 0;
      callbackDelay = 0;
    },
    onMove() {
      moves++;
      record("callback:start");
      const start = now();
      while (now() - start < callbackDelay) { /* controlled test-only synchronous callback */ }
      record("callback:end");
    },
    dispose() {
      observer.disconnect();
      for (const name of pointerEvents) window.removeEventListener(name, pointer, true);
      if (window.__gbFeelLab__ === api) delete window.__gbFeelLab__;
    },
  };
  return api;
}
