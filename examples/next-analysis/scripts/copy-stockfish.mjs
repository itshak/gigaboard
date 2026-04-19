#!/usr/bin/env node
/**
 * Copies the Stockfish 18 "lite + single-threaded" WASM build from the
 * `stockfish` npm package into `public/stockfish/` with stable filenames.
 *
 * Why lite + single-threaded:
 *  - Full Stockfish 18 ships a 108 MB NNUE weights blob. The lite build
 *    (~7 MB) is still NNUE-backed and plenty strong for an analysis
 *    demo.
 *  - The multi-threaded build uses `SharedArrayBuffer`, which requires
 *    cross-origin isolation (`Cross-Origin-Opener-Policy: same-origin`
 *    + `Cross-Origin-Embedder-Policy: require-corp`). That's a footgun
 *    for an example app — the single-threaded build Just Works on a
 *    plain Next.js dev server with no header surgery.
 *
 * Runs at postinstall + `bun run copy-assets`.
 */
import { createRequire } from "node:module";
import { cpSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public", "stockfish");

/**
 * Files shipped in `stockfish/bin/` that we care about. The loader JS
 * expects to find `stockfish-18-lite-single.wasm` next to itself, so
 * keep the filenames verbatim.
 */
const WANTED = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

function main() {
  let pkgJsonPath;
  try {
    pkgJsonPath = require.resolve("stockfish/package.json");
  } catch {
    console.warn("[copy-stockfish] skipped: `stockfish` package not installed.");
    return;
  }
  const binDir = join(dirname(pkgJsonPath), "bin");

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const name of WANTED) {
    const src = join(binDir, name);
    try {
      statSync(src);
    } catch {
      console.warn(`[copy-stockfish] missing ${name} — is the package build complete?`);
      continue;
    }
    cpSync(src, join(outDir, name));
  }
  console.log(`[copy-stockfish] copied Stockfish 18 (lite, single-threaded) → ${outDir}`);
}

main();
