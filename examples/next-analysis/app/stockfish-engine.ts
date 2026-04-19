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

/**
 * Thin driver wrapping a single Stockfish worker. Safe to construct
 * during SSR — the constructor short-circuits when `window` is
 * undefined, so every method becomes a no-op until the client-side
 * mount path runs.
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private messageHandler: ((msg: StockfishMessage) => void) | null = null;

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
      const parsed = parseUci(line);
      if (parsed && this.messageHandler) this.messageHandler(parsed);
    };

    this.worker.postMessage("uci");
    this.worker.postMessage("isready");
    this.worker.postMessage("ucinewgame");
  }

  /** Queue a fresh `go depth N` search for the given FEN. */
  evaluatePosition(fen: string, depth = 18): void {
    if (!this.worker) return;
    this.worker.postMessage("stop");
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  /** Abort the current search without terminating the engine. */
  stop(): void {
    this.worker?.postMessage("stop");
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
  }
}

/**
 * Parse a single UCI output line into the fields we actually render.
 *
 * Only two kinds of lines matter:
 *  - `info depth N score cp|mate X ... pv <moves>` — streamed during search.
 *  - `bestmove <uci> [ponder <uci>]` — emitted once the search finishes.
 *
 * Everything else (readyok, id, option banners, copyprotection) is dropped.
 */
function parseUci(line: string): StockfishMessage | null {
  if (line.startsWith("bestmove")) {
    const m = line.match(/^bestmove\s+(\S+)/);
    const bestMove = m?.[1];
    return bestMove ? { bestMove } : null;
  }

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
