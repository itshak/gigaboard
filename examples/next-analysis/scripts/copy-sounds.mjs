#!/usr/bin/env node
// Copies hashed .mp3 assets shipped with gigaboard into public/sounds/
// with stable filenames so the showcase can reference them as /sounds/*.mp3.
//
// Runs at postinstall + `bun run copy-sounds`.
import { createRequire } from "node:module";
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public", "sounds");

// The package is a workspace dep; its dist/ folder sits next to package.json.
const pkgJson = require.resolve("gigaboard/package.json");
const distDir = join(dirname(pkgJson), "dist", "sounds");

/** Strip the tsup content hash (e.g. `move-self-66AY7WGX.mp3` -> `move-self.mp3`). */
function stripHash(filename) {
  return filename.replace(/-[A-Z0-9]{8}(?=\.mp3$)/, "");
}

function main() {
  let files;
  try {
    files = readdirSync(distDir).filter((f) => f.endsWith(".mp3"));
  } catch (err) {
    console.warn(
      `[copy-sounds] skipped: gigaboard dist/sounds not found at ${distDir}. ` +
        `Run \`bun run -F gigaboard build\` first.`,
    );
    return;
  }

  if (files.length === 0) {
    console.warn(`[copy-sounds] no .mp3 files found in ${distDir}`);
    return;
  }

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  for (const file of files) {
    cpSync(join(distDir, file), join(outDir, stripHash(file)));
  }
  console.log(`[copy-sounds] copied ${files.length} files → ${outDir}`);
}

main();
