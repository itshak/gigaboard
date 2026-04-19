/**
 * Minimal Stockfish UCI driver.
 *
 * Loads the official WebAssembly build of Stockfish 18 (lite, single-
 * threaded) from same-origin `public/stockfish/`. The `postinstall`
 * script (`scripts/copy-stockfish.mjs`) lifts the binary out of the
 * `stockfish` npm package so nothing ever hits a CDN at runtime.
 *
 * ### Why this variant
 *
 * - **Lite** (~7 MB) instead of full (~108 MB): still NNUE-backed and
 *   comfortably super-grandmaster strength; load time matters more than
 *   the extra Elo for an in-browser demo.
 * - **Single-threaded** instead of multi-threaded: the multi-threaded
 *   build depends on `SharedArrayBuffer`, which requires cross-origin
 *   isolation headers (`COOP: same-origin`, `COEP: require-corp`).
 *   Configuring those in a Next.js example is a footgun; the
 *   single-threaded build runs on every modern browser with no header
 *   surgery.
 *
 * ### Why the worker URL is passed directly
 *
 * Stockfish's Emscripten module resolves its sibling `.wasm` via
 * `new URL("...wasm", import.meta.url)` — equivalent to the script's
 * own URL. Fronting the loader behind a blob worker (`importScripts`)
 * breaks that resolution because the blob URL has no meaningful
 * `location` for the Emscripten helpers to anchor against.
 *
 * Since the loader lives under `public/stockfish/` (same origin), we
 * can construct `new Worker("/stockfish/...js")` directly — modern
 * browsers allow same-origin classic worker URLs without ceremony, and
 * the `.wasm` fetch inside the worker resolves to the correct sibling.
 *
 * ### Serialising the search lifecycle
 *
 * Stockfish's single-threaded build processes UCI commands on one
 * cooperative thread. Blindly firing `stop; position fen; go depth N`
 * back-to-back for every position change eventually wedges the engine:
 * each `stop` needs to unwind the current search and emit `bestmove`
 * before the next `position`/`go` pair can be consumed cleanly, and
 * letting those pairs pile up races the engine's internal state.
 *
 * We avoid that entirely by **pairing every `go` with the `bestmove`
 * reply before sending the next `go`**. If a new `evaluatePosition`
 * arrives while a search is in flight, it replaces the single
 * "pending" slot and waits — when the current search's `bestmove`
 * arrives, we kick off the pending one. Redundant requests for the
 * same FEN at the same depth are dropped.
 */

"use client";

/** The subset of UCI info fields the analysis UI renders. */
export interface StockfishMessage {
  /** Centipawn score from the side-to-move's POV (e.g. "25" = +0.25). */
  readonly positionEvaluation?: string;
  /** Signed mate distance (e.g. "3" = mate in 3 for side-to-move). */
  readonly possibleMate?: string;
  /** Principal variation — space-separated UCI moves. */
  readonly pv?: string;
  /** Current search depth. */
  readonly depth?: number;
  /** Emitted once, when the engine decides on its best move. */
  readonly bestMove?: string;
}

/**
 * Path prefix for the copied Stockfish assets. The loader script
 * fetches its sibling `.wasm` via `importScripts`-relative resolution,
 * so these two files must sit next to each other.
 */
const ENGINE_LOADER_URL = "/stockfish/stockfish-18-lite-single.js";

/** Search-lifecycle state. Owned entirely by the driver. */
interface PendingSearch {
  readonly fen: string;
  readonly depth: number;
}

/**
 * Thin driver wrapping a single Stockfish worker. Safe to construct
 * during SSR — the constructor short-circuits when `window` is
 * undefined, so every method becomes a no-op until the client-side
 * mount path runs.
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private messageHandler: ((msg: StockfishMessage) => void) | null = null;

  /**
   * The currently-running search, or `null` when the engine is idle.
   * A search is considered "running" from the moment we post `go` to
   * the moment we receive the matching `bestmove`.
   */
  private activeSearch: PendingSearch | null = null;

  /**
   * At most one search waiting behind the active one. New requests
   * overwrite this slot — we only care about the latest position, so
   * older queued searches become irrelevant the moment a newer one
   * lands.
   */
  private pendingSearch: PendingSearch | null = null;

  constructor() {
    if (typeof window === "undefined") return;

    try {
      this.worker = new Worker(ENGINE_LOADER_URL);
    } catch (err) {
      console.error("[stockfish] worker failed to start", err);
      return;
    }

    this.worker.onmessage = (ev: MessageEvent<string>) => {
      const line = typeof ev.data === "string" ? ev.data : String(ev.data);
      this.handleLine(line);
    };

    // Standard UCI handshake. Replies (`uciok`, `readyok`) are ignored —
    // the engine queues commands reliably, and search start is gated by
    // `activeSearch` tracking, not by the handshake completing.
    this.worker.postMessage("uci");
    this.worker.postMessage("isready");
    this.worker.postMessage("ucinewgame");
  }

  /**
   * Request a fresh search for `fen`. Safe to call at any rate — the
   * driver serialises against the engine's `bestmove` acknowledgements
   * so rapid-fire invocations can't wedge the UCI pipeline. Repeat
   * requests for an in-flight position/depth are no-ops.
   */
  evaluatePosition(fen: string, depth = 18): void {
    if (!this.worker) return;
    const next: PendingSearch = { fen, depth };

    // De-dupe against whatever's already running or queued — no point
    // asking the engine to re-search the same position at the same
    // depth twice.
    if (searchEquals(this.activeSearch, next)) return;
    if (searchEquals(this.pendingSearch, next)) return;

    this.pendingSearch = next;
    if (this.activeSearch === null) {
      this.startPending();
    } else {
      // A search is already running. Ask the engine to abort it; the
      // `bestmove` reply will dispatch `pendingSearch`.
      this.worker.postMessage("stop");
    }
  }

  /**
   * Abort the current search (if any) and drop any queued request.
   * Used when the caller knows there's no new search coming — e.g.
   * the game ended — so we don't leave the engine running an
   * irrelevant analysis.
   */
  stop(): void {
    if (!this.worker) return;
    this.pendingSearch = null;
    if (this.activeSearch !== null) this.worker.postMessage("stop");
  }

  /** Replace the single current subscriber. Pass `null` to unsubscribe. */
  onMessage(handler: ((msg: StockfishMessage) => void) | null): void {
    this.messageHandler = handler;
  }

  /** Kill the worker. Idempotent. */
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.messageHandler = null;
    this.activeSearch = null;
    this.pendingSearch = null;
  }

  /**
   * Route a raw UCI line from the worker. `bestmove` drives the
   * search-lifecycle state machine; `info` lines are parsed and
   * forwarded to the current subscriber.
   */
  private handleLine(line: string): void {
    if (line.startsWith("bestmove")) {
      // Whatever was running is done. Immediately start the queued
      // search if there is one — this is the *only* place we advance
      // from one search to the next, which is what makes the pipeline
      // non-racy.
      this.activeSearch = null;
      this.startPending();
      return;
    }

    const msg = parseUci(line);
    if (msg && this.messageHandler) this.messageHandler(msg);
  }

  /**
   * Promote `pendingSearch` to `activeSearch` and send the UCI
   * `position`/`go` pair. No-op when no search is queued or the
   * worker has already been terminated.
   */
  private startPending(): void {
    if (!this.worker || this.pendingSearch === null) return;
    const next = this.pendingSearch;
    this.pendingSearch = null;
    this.activeSearch = next;
    this.worker.postMessage(`position fen ${next.fen}`);
    this.worker.postMessage(`go depth ${next.depth}`);
  }
}

/** Structural equality for search requests. Null-safe on both sides. */
function searchEquals(a: PendingSearch | null, b: PendingSearch): boolean {
  return a !== null && a.fen === b.fen && a.depth === b.depth;
}

/**
 * Parse a single UCI output line into the fields we actually render.
 *
 * Only two kinds of lines matter:
 *  - `info depth N score cp|mate X ... pv <moves>` — streamed during search.
 *  - `bestmove <uci> [ponder <uci>]` — handled by the caller, not here.
 *
 * Everything else (readyok, id, option banners, copyprotection) is dropped.
 */
function parseUci(line: string): StockfishMessage | null {
  if (!line.startsWith("info")) return null;

  const msg: Mutable<StockfishMessage> = {};

  const depth = line.match(/\bdepth\s+(\d+)/);
  if (depth?.[1]) msg.depth = Number(depth[1]);

  const cp = line.match(/\bscore\s+cp\s+(-?\d+)/);
  if (cp?.[1]) msg.positionEvaluation = cp[1];

  const mate = line.match(/\bscore\s+mate\s+(-?\d+)/);
  if (mate?.[1]) msg.possibleMate = mate[1];

  // `pv` is always the last field in an `info` line by UCI spec — match to EOL.
  const pv = line.match(/\bpv\s+(.+)$/);
  if (pv?.[1]) msg.pv = pv[1].trim();

  return Object.keys(msg).length > 0 ? msg : null;
}

/** Drop `readonly` so we can assemble the message incrementally. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
