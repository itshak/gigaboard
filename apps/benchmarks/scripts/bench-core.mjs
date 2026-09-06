#!/usr/bin/env node
/**
 * Node-side microbenchmarks — `gigaboard/core` (gigachess) vs
 * `chess.js` (pure JS, the engine `react-chessboard` uses internally).
 *
 * Each scenario runs a warmup + a measurement pass, emits ns/op and
 * ops/sec, and writes the combined report to `bench-results/core.json`.
 *
 * Usage:
 *   node scripts/bench-core.mjs                 # default iteration counts
 *   BENCH_ITERS=500000 node scripts/bench-core.mjs
 *
 * Design notes:
 * - We bench the underlying engines directly, not the React layer. That
 *   isolates engine cost from rendering cost and keeps the comparison
 *   fair with `chess.js`, which has no React integration of its own.
 * - Every scenario fixes the input (same FEN, same legal move) so the
 *   two engines do equivalent work.
 * - WASM initialisation cost is measured once and excluded from the
 *   per-call numbers — that's the honest way to present steady-state
 *   throughput after the first mount.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { createGigachessAdapter } from "gigaboard/core";
import { Chess } from "chess.js";

const here = dirname(fileURLToPath(import.meta.url));
const resultsDir = resolve(here, "..", "bench-results");
mkdirSync(resultsDir, { recursive: true });

const ITERS = Number(process.env.BENCH_ITERS ?? 200_000);
const WARMUP = Math.max(500, (ITERS / 20) | 0);

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const MID_FEN = "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4";

/** Run `fn` N times after a warmup, return ns/op (median of 3 passes). */
function bench(label, fn, { iters = ITERS, warmup = WARMUP } = {}) {
  for (let i = 0; i < warmup; i++) fn(i);
  const samples = [];
  for (let pass = 0; pass < 3; pass++) {
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) fn(i);
    const elapsedMs = performance.now() - t0;
    samples.push((elapsedMs * 1_000_000) / iters);
  }
  samples.sort((a, b) => a - b);
  const nsPerOp = samples[1];
  const opsPerSec = (1_000_000_000 / nsPerOp) | 0;
  return { label, iters, nsPerOp: Number(nsPerOp.toFixed(1)), opsPerSec };
}

/** Measure cold engine-init once (separate from the per-op numbers). */
async function initCost() {
  const t0 = performance.now();
  createGigachessAdapter();
  const ultraMs = performance.now() - t0;

  const t1 = performance.now();
  new Chess();
  const chessJsMs = performance.now() - t1;

  return {
    label: "engine-construction (cold)",
    gigachessMs: Number(ultraMs.toFixed(2)),
    chessJsMs: Number(chessJsMs.toFixed(3)),
  };
}

function benchTryMove() {
  return Promise.all([
    (async () => {
      const a = createGigachessAdapter();
      return bench("tryMove e2e4 + undo  (gigachess)", () => {
        a.makeMove(12, 28);
        a.undo();
      });
    })(),
    (() => {
      const c = new Chess();
      return bench("tryMove e2e4 + undo  (chess.js)", () => {
        c.move({ from: "e2", to: "e4" });
        c.undo();
      });
    })(),
  ]);
}

function benchLegalMoves() {
  return Promise.all([
    (async () => {
      const a = createGigachessAdapter(MID_FEN);
      return bench("legalMoves (all, mid-game)  (gigachess)", () => {
        a.legalMoves();
      });
    })(),
    (() => {
      const c = new Chess(MID_FEN);
      return bench("legalMoves (all, mid-game)  (chess.js)", () => {
        c.moves({ verbose: true });
      });
    })(),
  ]);
}

function benchIsCheckGameOver() {
  return Promise.all([
    (async () => {
      const a = createGigachessAdapter(MID_FEN);
      return bench("inCheck + isGameOver  (gigachess)", () => {
        a.inCheck();
        a.isGameOver();
      });
    })(),
    (() => {
      const c = new Chess(MID_FEN);
      return bench("inCheck + isGameOver  (chess.js)", () => {
        c.inCheck();
        c.isGameOver();
      });
    })(),
  ]);
}

function benchPositionKey() {
  return Promise.all([
    (async () => {
      const a = createGigachessAdapter(MID_FEN);
      return bench("position key: hash()  (gigachess)", () => {
        a.hash();
      });
    })(),
    (() => {
      const c = new Chess(MID_FEN);
      return bench("position key: fen()   (chess.js)", () => {
        c.fen();
      });
    })(),
  ]);
}

/**
 * Full 40-ply game replay — the realistic "how fast is an opening book
 * or an engine analysis loop" scenario. The move sequence is a valid
 * game (Sicilian Dragon).
 */
const GAME_40 = [
  "e2e4",
  "c7c5",
  "g1f3",
  "d7d6",
  "d2d4",
  "c5d4",
  "f3d4",
  "g8f6",
  "b1c3",
  "g7g6",
  "c1e3",
  "f8g7",
  "f2f3",
  "e8g8",
  "d1d2",
  "b8c6",
  "e1c1",
  "d8a5",
  "c1b1",
  "f8d8",
  "h2h4",
  "c8e6",
  "h4h5",
  "f6h5",
  "g2g4",
  "h5f6",
  "e3h6",
  "g7h8",
  "h6e3",
  "f6g4",
  "d2h2",
  "g4f6",
  "h2h7",
  "g8f8",
  "f3f4",
  "d8c8",
  "f4f5",
  "e6d7",
  "f5g6",
  "f7g6",
];

function benchFullGame() {
  return Promise.all([
    (async () => {
      const adapter = createGigachessAdapter();
      const fromIdx = (s) => (s.charCodeAt(0) - 97) + (Number(s[1]) - 1) * 8;
      const moves = GAME_40.map((m) => [fromIdx(m.slice(0, 2)), fromIdx(m.slice(2, 4))]);
      return bench(
        "replay 40-ply game + rewind  (gigachess)",
        () => {
          for (const [from, to] of moves) adapter.makeMove(from, to);
          for (let i = 0; i < moves.length; i++) adapter.undo();
        },
        { iters: Math.max(500, (ITERS / 100) | 0), warmup: 100 },
      );
    })(),
    (() => {
      const c = new Chess();
      return bench(
        "replay 40-ply game + rewind  (chess.js)",
        () => {
          for (const m of GAME_40) {
            c.move({ from: m.slice(0, 2), to: m.slice(2, 4) });
          }
          for (let i = 0; i < GAME_40.length; i++) c.undo();
        },
        { iters: Math.max(500, (ITERS / 100) | 0), warmup: 100 },
      );
    })(),
  ]);
}

function format(results) {
  const rows = [];
  for (const [name, pair] of Object.entries(results.scenarios)) {
    const [ultra, js] = pair;
    const speedup = (js.nsPerOp / ultra.nsPerOp).toFixed(1);
    rows.push(`  ${name}`);
    rows.push(`    gigachess:  ${ultra.nsPerOp.toFixed(1).padStart(10)} ns/op  (${ultra.opsPerSec.toLocaleString()} ops/sec)`);
    rows.push(`    chess.js:   ${js.nsPerOp.toFixed(1).padStart(10)} ns/op  (${js.opsPerSec.toLocaleString()} ops/sec)`);
    rows.push(`    speedup:    ${speedup}×`);
    rows.push("");
  }
  return rows.join("\n");
}

async function main() {
  const iters = ITERS;
  console.log(`bench-core — iters=${iters}, warmup=${WARMUP}, node=${process.version}\n`);

  const init = await initCost();

  const scenarios = {
    tryMove: await benchTryMove(),
    legalMoves: await benchLegalMoves(),
    positionKey: await benchPositionKey(),
    inCheckGameOver: await benchIsCheckGameOver(),
    fullGame: await benchFullGame(),
  };

  const report = {
    runtime: { node: process.version, platform: process.platform, iters },
    init,
    scenarios,
  };

  console.log(format(report));
  console.log(`engine construction (cold):`);
  console.log(`  gigachess: ${init.gigachessMs.toFixed(2)} ms`);
  console.log(`  chess.js:   ${init.chessJsMs.toFixed(3)} ms`);
  console.log("");

  const outPath = resolve(resultsDir, "core.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
