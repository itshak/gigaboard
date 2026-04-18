/**
 * Shared in-page benchmark harness.
 *
 * Both board pages (`/` and `/rcb.html`) install the SAME
 * `window.__ucrBench__` object. Playwright drives every scenario through
 * this uniform API so the only thing that differs between runs is which
 * library actually rendered the board. That keeps the comparison fair.
 *
 * ### Contract
 *
 * ```ts
 * interface UcrBench {
 *   readonly ready: Promise<void>;               // resolves once the board is mounted
 *   readonly library: "ultra" | "rcb";
 *   playMove(from: string, to: string): Promise<void>;
 *   dragFromTo(from: string, to: string, steps?: number): Promise<void>;
 *   reset(fen?: string): Promise<void>;
 *   metrics(): BenchMetrics;   // pull the current accumulators
 *   resetMetrics(): void;      // clear counters before starting a scenario
 * }
 * ```
 *
 * Because Playwright's `page.evaluate(...)` runs in-page, driving moves
 * through this harness means zero WebDriver round-trips between a user
 * gesture and a paint — we get input-to-paint latency that matches what
 * a real user would observe.
 */

/** Exposed per-scenario metrics. */
export interface BenchMetrics {
  /** `longtask` observer hits since the last reset. */
  readonly longTasks: ReadonlyArray<{ startTime: number; duration: number }>;
  /** Sum of `longtask.duration` (ms). */
  readonly longTaskTotalMs: number;
  /** Max requestAnimationFrame delta observed (ms). Lower = smoother. */
  readonly maxFrameMs: number;
  /** Median requestAnimationFrame delta observed (ms). */
  readonly medianFrameMs: number;
  /** Number of rAF tick samples collected. */
  readonly frameSamples: number;
  /** Frames longer than 20 ms (missed 60 Hz deadline). */
  readonly droppedFrames: number;
  /**
   * LCP (Largest Contentful Paint) in ms since navigationStart, or null
   * if the observer hasn't fired yet.
   */
  readonly lcpMs: number | null;
}

/** Viewport-pixel centre of a named square on the current board. */
export interface SquareCentre {
  readonly x: number;
  readonly y: number;
}

/** Global API shape. */
export interface UcrBench {
  readonly ready: Promise<void>;
  readonly library: "ultra" | "rcb" | "cg";
  playMove(from: string, to: string): Promise<void>;
  dragFromTo(from: string, to: string, steps?: number): Promise<void>;
  reset(fen?: string): Promise<void>;
  metrics(): BenchMetrics;
  resetMetrics(): void;
  /**
   * Locate the pixel centre of a named square (e.g. `"e4"`). Each
   * library implements this for its own DOM layout — Ultra and
   * react-chessboard both put `data-square="<label>"` attributes on
   * their squares, but `chessground` positions pieces via coordinate
   * transforms without per-square markup, so it derives the centre
   * from the board rect.
   */
  squareCentre(label: string): SquareCentre | null;
}

declare global {
  interface Window {
    __ucrBench__?: UcrBench;
  }
}

/**
 * Snapshot of mutable state tracked by the harness. Kept in a plain
 * object so `metrics()` can clone it cheaply without leaking references
 * Playwright might retain across calls.
 */
interface HarnessState {
  longTasks: Array<{ startTime: number; duration: number }>;
  frameTimestamps: number[];
  lcpMs: number | null;
  rafHandle: number | null;
}

/** Allocate an initial (empty) state. */
function newState(): HarnessState {
  return {
    longTasks: [],
    frameTimestamps: [],
    lcpMs: null,
    rafHandle: null,
  };
}

/**
 * Per-harness observer bundle. Installs the `longtask` and `LCP`
 * observers exactly once per page load and returns a handle that the
 * caller uses to snapshot + reset the accumulators.
 */
export function installObservers(): {
  state: HarnessState;
  snapshot(): BenchMetrics;
  reset(): void;
  start(): void;
  stop(): void;
} {
  const state = newState();

  // --- Long-task observer: any main-thread block > 50 ms is a smoking
  //     gun for dropped interactions. Supported in Chromium.
  if ("PerformanceObserver" in window) {
    try {
      const longObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          state.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      longObserver.observe({ type: "longtask", buffered: true });
    } catch {
      /* longtask unsupported in this env — observers stay empty */
    }

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last !== undefined) state.lcpMs = last.startTime;
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      /* LCP unsupported */
    }
  }

  // --- rAF frame-time sampler. We sample only while the harness is
  //     "running" (between start() and stop()) to avoid polluting idle
  //     periods with deltas that don't represent user work.
  function loop(ts: number): void {
    state.frameTimestamps.push(ts);
    state.rafHandle = window.requestAnimationFrame(loop);
  }

  return {
    state,
    start(): void {
      if (state.rafHandle !== null) return;
      state.rafHandle = window.requestAnimationFrame(loop);
    },
    stop(): void {
      if (state.rafHandle !== null) {
        window.cancelAnimationFrame(state.rafHandle);
        state.rafHandle = null;
      }
    },
    reset(): void {
      state.longTasks = [];
      state.frameTimestamps = [];
    },
    snapshot(): BenchMetrics {
      const deltas: number[] = [];
      for (let i = 1; i < state.frameTimestamps.length; i++) {
        // biome-ignore lint/style/noNonNullAssertion: bounds-checked above
        const delta = state.frameTimestamps[i]! - state.frameTimestamps[i - 1]!;
        deltas.push(delta);
      }
      deltas.sort((a, b) => a - b);
      const median = deltas.length === 0 ? 0 : (deltas[Math.floor(deltas.length / 2)] ?? 0);
      const max = deltas.length === 0 ? 0 : (deltas[deltas.length - 1] ?? 0);
      const dropped = deltas.filter((d) => d > 20).length;
      const longTaskTotalMs = state.longTasks.reduce((acc, t) => acc + t.duration, 0);
      return {
        longTasks: state.longTasks.slice(),
        longTaskTotalMs,
        maxFrameMs: max,
        medianFrameMs: median,
        frameSamples: deltas.length,
        droppedFrames: dropped,
        lcpMs: state.lcpMs,
      };
    },
  };
}

/**
 * Default `squareCentre` for libraries that mark their squares with
 * `data-square="<label>"` attributes (Ultra + react-chessboard).
 */
export function squareCentreByDataAttr(label: string): SquareCentre | null {
  const el = document.querySelector<HTMLElement>(`[data-square="${label}"]`);
  if (el === null) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * `squareCentre` for libraries that lay out squares via a single
 * container with an 8×8 grid but without per-square markup (chessground).
 *
 * `orientation` is `"white"` when white is at the bottom. The board is
 * assumed square; if the container is non-square we still compute based
 * on its bounding rect, which is what a user actually sees.
 */
export function squareCentreByGrid(
  container: HTMLElement,
  orientation: "white" | "black" = "white",
): (label: string) => SquareCentre | null {
  return (label) => {
    if (label.length !== 2) return null;
    const file = label.charCodeAt(0) - 0x61;
    const rank = Number(label[1]) - 1;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    const rect = container.getBoundingClientRect();
    const col = orientation === "white" ? file : 7 - file;
    const row = orientation === "white" ? 7 - rank : rank;
    const sqW = rect.width / 8;
    const sqH = rect.height / 8;
    return {
      x: rect.left + sqW * col + sqW / 2,
      y: rect.top + sqH * row + sqH / 2,
    };
  };
}

/**
 * Fire a standards-compliant pointer gesture sequence on the given
 * target. We dispatch `pointerdown` → N × `pointermove` → `pointerup`
 * on the *document* so the events bubble identically to a real user
 * drag. `steps` controls how many intermediate `pointermove` events
 * are fired; larger values exercise the drag hot-path harder.
 */
export async function pointerDrag(
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number,
): Promise<void> {
  const dispatch = (type: string, x: number, y: number): void => {
    const ev = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      pointerId: 1,
      isPrimary: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    const target = document.elementFromPoint(x, y) ?? document.documentElement;
    target.dispatchEvent(ev);
  };

  dispatch("pointerdown", from.x, from.y);
  // Yield one frame so the library's drag initiator (e.g. pointercapture
  // activation) lands before we start moving.
  await new Promise((r) => window.requestAnimationFrame(() => r(null)));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    dispatch("pointermove", x, y);
    // Yield every 4 frames so the browser can repaint — otherwise the
    // whole drag is compressed into a single task and `longtask`
    // observers under-report.
    if (i % 4 === 0) {
      await new Promise((r) => window.requestAnimationFrame(() => r(null)));
    }
  }
  dispatch("pointerup", to.x, to.y);
  await new Promise((r) => window.requestAnimationFrame(() => r(null)));
}
