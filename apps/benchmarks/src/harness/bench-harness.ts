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
  /** Median (p50) requestAnimationFrame delta observed (ms). */
  readonly medianFrameMs: number;
  /** 75th percentile of rAF deltas — catches "sort of jumpy". */
  readonly p75FrameMs: number;
  /** 90th percentile of rAF deltas — catches "occasional stutter". */
  readonly p90FrameMs: number;
  /** 95th percentile of rAF deltas — the standard "tail latency" read. */
  readonly p95FrameMs: number;
  /**
   * 99th percentile of rAF deltas — the "once-per-storm hiccup" read.
   * Pair with p95 to distinguish "consistent jank" (p95 high) from
   * "occasional dropout" (p99 high, p95 fine).
   */
  readonly p99FrameMs: number;
  /** Number of rAF tick samples collected. */
  readonly frameSamples: number;
  /** Frames longer than 20 ms (missed 60 Hz deadline). */
  readonly droppedFrames: number;
  /**
   * LCP (Largest Contentful Paint) in ms since navigationStart, or null
   * if the observer hasn't fired yet.
   */
  readonly lcpMs: number | null;
  /**
   * `PerformanceObserver({ type: "event" })` Interaction-to-Next-Paint
   * entries recorded since the last reset. Populated on bench pages that
   * called `installInteractionObserver()`; an empty array otherwise.
   * Browser-native INP measurement — granular to 8 ms but authoritative.
   */
  readonly interactions: ReadonlyArray<{
    readonly name: string;
    readonly interactionId: number;
    readonly startTime: number;
    readonly duration: number;
    readonly processingStart: number;
    readonly processingEnd: number;
  }>;
  /**
   * Peak value of `performance.memory.usedJSHeapSize` (bytes) sampled
   * during the scenario window. Chromium-only; 0 when unavailable.
   * Sampled on each rAF tick so it reflects in-scenario usage, not
   * whatever the page holds at idle.
   */
  readonly heapPeakBytes: number;
  /** Value of `performance.memory.usedJSHeapSize` at the *end* of the
   *  scenario window. Diff between peak and end distinguishes "growing
   *  working set" from "transient spike that GC reclaimed". */
  readonly heapEndBytes: number;
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
  /**
   * Drive a continuous pointer drag along a polyline of square labels.
   * `pointerdown` on the first square, `pointermove` interpolated along
   * each leg (`stepsPerLeg` per leg), `pointerup` on the last square.
   * For a no-commit exercise of the drag hot path, loop back to the
   * start square so the gesture leaves no state change.
   */
  dragPath(squares: ReadonlyArray<string>, stepsPerLeg?: number): Promise<void>;
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

/**
 * Grid-mount scenario API. Installed by the three `grid-*` apps when a
 * page is loaded with `?grid=N`. Playwright waits on `ready` then
 * collects host-side metrics (JS heap, DOM nodes, long tasks) while the
 * in-page `metrics()` surfaces the same observer snapshot Ultra's
 * single-board pages use.
 */
export interface UcrGrid {
  readonly ready: Promise<void>;
  readonly library: "ultra" | "rcb" | "cg";
  readonly boardCount: number;
  metrics(): BenchMetrics;
}

declare global {
  interface Window {
    __ucrBench__?: UcrBench;
    __ucrGrid__?: UcrGrid;
    /**
     * Handle to the installed mutation-flash overlay. Set by each
     * bench page once its board mounts. Specs toggle visibility and
     * read the counter through this.
     */
    __ucrFlash__?: MutationFlashControl;
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
  interactions: Array<{
    name: string;
    interactionId: number;
    startTime: number;
    duration: number;
    processingStart: number;
    processingEnd: number;
  }>;
  heapPeakBytes: number;
  heapEndBytes: number;
}

/** Allocate an initial (empty) state. */
function newState(): HarnessState {
  return {
    longTasks: [],
    frameTimestamps: [],
    lcpMs: null,
    rafHandle: null,
    interactions: [],
    heapPeakBytes: 0,
    heapEndBytes: 0,
  };
}

/**
 * Chromium-only `performance.memory.usedJSHeapSize` accessor. `0` when
 * the API isn't present — caller can treat that as "not measured" and
 * omit from reports rather than conflate with a legitimate 0-byte
 * reading.
 */
function readHeapBytes(): number {
  // biome-ignore lint/suspicious/noExplicitAny: non-standard Chromium API
  const mem = (performance as any).memory as { usedJSHeapSize?: number } | undefined;
  return typeof mem?.usedJSHeapSize === "number" ? mem.usedJSHeapSize : 0;
}

/**
 * Compute percentile P over a *sorted* ascending array. Uses the
 * nearest-rank method (no interpolation) — matches what most tools
 * (including Chromium's internal percentile reporting) do. Returns 0
 * on an empty array so callers don't have to special-case.
 */
function percentileFromSorted(sorted: ReadonlyArray<number>, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
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

    // --- EventTiming observer: surfaces INP (Interaction to Next
    //     Paint) directly from the browser. `interactionId !== 0`
    //     filters out non-interaction events (mousemove, etc.).
    //     Chromium's PerformanceEventTiming `duration` IS INP rounded
    //     to 8 ms resolution — authoritative for the "did my click
    //     feel instant" metric.
    try {
      const eventObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // `interactionId` is Chromium's user-interaction tag; TS dom
          // lib doesn't ship the field on PerformanceEventTiming yet.
          // Cast — runtime is correct in Chromium 90+.
          const e = entry as PerformanceEventTiming & { interactionId?: number };
          const id = e.interactionId ?? 0;
          if (id === 0) continue;
          state.interactions.push({
            name: e.name,
            interactionId: id,
            startTime: e.startTime,
            duration: e.duration,
            processingStart: e.processingStart,
            processingEnd: e.processingEnd,
          });
        }
      });
      // `durationThreshold: 16` — the browser only reports events whose
      // duration exceeds 16 ms. Shorter interactions are fast enough to
      // be invisible in an INP metric.
      eventObserver.observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
    } catch {
      /* EventTiming unsupported — older Chromium, e.g. */
    }
  }

  // --- rAF frame-time sampler. We sample only while the harness is
  //     "running" (between start() and stop()) to avoid polluting idle
  //     periods with deltas that don't represent user work. Heap is
  //     sampled on the same cadence — cheap (one property read) and
  //     "peak heap during the scenario window" is more useful than
  //     whatever the page happens to hold when snapshot() is called.
  function loop(ts: number): void {
    state.frameTimestamps.push(ts);
    const h = readHeapBytes();
    if (h > state.heapPeakBytes) state.heapPeakBytes = h;
    state.heapEndBytes = h;
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
      state.interactions = [];
      state.heapPeakBytes = 0;
      state.heapEndBytes = 0;
    },
    snapshot(): BenchMetrics {
      const deltas: number[] = [];
      for (let i = 1; i < state.frameTimestamps.length; i++) {
        const delta = state.frameTimestamps[i]! - state.frameTimestamps[i - 1]!;
        deltas.push(delta);
      }
      deltas.sort((a, b) => a - b);
      const dropped = deltas.filter((d) => d > 20).length;
      const longTaskTotalMs = state.longTasks.reduce((acc, t) => acc + t.duration, 0);
      return {
        longTasks: state.longTasks.slice(),
        longTaskTotalMs,
        maxFrameMs: deltas.length === 0 ? 0 : (deltas[deltas.length - 1] ?? 0),
        medianFrameMs: percentileFromSorted(deltas, 50),
        p75FrameMs: percentileFromSorted(deltas, 75),
        p90FrameMs: percentileFromSorted(deltas, 90),
        p95FrameMs: percentileFromSorted(deltas, 95),
        p99FrameMs: percentileFromSorted(deltas, 99),
        frameSamples: deltas.length,
        droppedFrames: dropped,
        lcpMs: state.lcpMs,
        interactions: state.interactions.slice(),
        heapPeakBytes: state.heapPeakBytes,
        heapEndBytes: state.heapEndBytes,
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
 * Library-agnostic "what re-rendered" visualiser.
 *
 * Installs a `MutationObserver` on the board subtree that:
 *
 *   1. counts every DOM mutation (attributes, childList, characterData),
 *      so the harness can report a "mutations per move" metric that's
 *      downstream of whatever reconciliation strategy the library uses,
 *      and
 *   2. optionally draws a short-lived red rectangle over each mutated
 *      element's bounding box — outside the board in a separate overlay
 *      root, so we can't observe our own paint.
 *
 * The overlay root is a sibling of the board under `document.body`, so
 * mutations we cause never feed back into the observer. Each rectangle
 * is a single absolutely-positioned `<div>` with a CSS animation and a
 * `setTimeout` self-removal — no React, no other library involvement.
 *
 * The visual is off by default; callers toggle it with `setVisible(true)`
 * only for the commit-trace scenario. Measurement specs use the counter
 * alone.
 */
export interface MutationFlashControl {
  resetCount(): void;
  getCount(): number;
  setVisible(on: boolean): void;
  dispose(): void;
}

export function installMutationFlash(board: HTMLElement): MutationFlashControl {
  let count = 0;
  let visible = false;

  // Separate overlay container, parented to body so observer on `board`
  // never sees our insertions.
  const overlayRoot = document.createElement("div");
  overlayRoot.id = "__ucr_flash_overlay__";
  Object.assign(overlayRoot.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "9998",
  });
  document.body.appendChild(overlayRoot);

  // Inject the animation keyframes once. A CSS animation (not transition)
  // so we don't need to poke an intermediate style value.
  const style = document.createElement("style");
  style.textContent = `
    @keyframes __ucr_flash__ {
      0%   { background: rgba(239,68,68,0.55); outline: 2px solid rgba(239,68,68,0.95); }
      100% { background: rgba(239,68,68,0);    outline: 2px solid rgba(239,68,68,0);    }
    }
    .__ucr_flash_cell__ {
      position: absolute;
      border-radius: 3px;
      animation: __ucr_flash__ 320ms ease-out forwards;
    }
  `;
  document.head.appendChild(style);

  function flashRect(rect: DOMRect): void {
    if (!visible) return;
    // Ignore degenerate rects (elements that are hidden / not laid out).
    if (rect.width === 0 || rect.height === 0) return;
    const el = document.createElement("div");
    el.className = "__ucr_flash_cell__";
    Object.assign(el.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    overlayRoot.appendChild(el);
    setTimeout(() => el.remove(), 360);
  }

  const observer = new MutationObserver((records) => {
    // Deduplicate by element — a single React commit can emit many
    // mutation records against the same node (attribute + childList +
    // text). Flash each distinct element once per batch.
    const seen = new Set<Element>();
    for (const r of records) {
      count++;
      let el: Element | null = null;
      if (r.type === "childList") {
        // Flash the parent + any added nodes that are elements.
        el = r.target instanceof Element ? r.target : null;
        for (const added of r.addedNodes) {
          if (added instanceof Element && !seen.has(added)) {
            seen.add(added);
            flashRect(added.getBoundingClientRect());
          }
        }
      } else {
        el = r.target instanceof Element ? r.target : r.target.parentElement;
      }
      if (el !== null && !seen.has(el)) {
        seen.add(el);
        flashRect(el.getBoundingClientRect());
      }
    }
  });

  observer.observe(board, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });

  return {
    resetCount(): void {
      count = 0;
    },
    getCount(): number {
      return count;
    },
    setVisible(on: boolean): void {
      visible = on;
    },
    dispose(): void {
      observer.disconnect();
      overlayRoot.remove();
      style.remove();
    },
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

/**
 * Fire a *continuous* drag along a polyline: one `pointerdown` at the
 * first point, `stepsPerLeg` interpolated `pointermove`s along each
 * subsequent leg, then `pointerup` at the last point. No drop-commit
 * happens unless the start and end points resolve to the same square;
 * callers typically close the loop so the gesture leaves no state change.
 *
 * This is the primitive behind the `drag-continuous` scenario — it
 * isolates the drag hot path (pointermove handling, drag-layer
 * transform updates) from the commit path so "zero re-renders per drag
 * frame" can be measured directly.
 */
export async function pointerDragPath(
  points: ReadonlyArray<{ x: number; y: number }>,
  stepsPerLeg: number,
): Promise<void> {
  if (points.length < 2) return;
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

  const start = points[0];
  if (start === undefined) return;
  dispatch("pointerdown", start.x, start.y);
  await new Promise((r) => window.requestAnimationFrame(() => r(null)));

  let moveCounter = 0;
  for (let leg = 1; leg < points.length; leg++) {
    const prev = points[leg - 1];
    const next = points[leg];
    if (prev === undefined || next === undefined) continue;
    for (let i = 1; i <= stepsPerLeg; i++) {
      const t = i / stepsPerLeg;
      dispatch("pointermove", prev.x + (next.x - prev.x) * t, prev.y + (next.y - prev.y) * t);
      moveCounter++;
      if (moveCounter % 4 === 0) {
        await new Promise((r) => window.requestAnimationFrame(() => r(null)));
      }
    }
  }

  const end = points[points.length - 1];
  if (end === undefined) return;
  dispatch("pointerup", end.x, end.y);
  await new Promise((r) => window.requestAnimationFrame(() => r(null)));
}
